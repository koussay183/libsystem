import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  writeBatch,
  updateDoc,
  deleteDoc,
  increment,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { track } from '@/lib/syncStatus'
import type { Purchase } from '@/types/models'

const PURCHASES = 'purchases'
const PRODUCTS = 'products'

/** Firestore caps a batch at 500 writes; stay clear of the edge. */
const BATCH_LIMIT = 400

export interface PurchaseItemInput {
  productId?: string
  name: string
  qty: number
  unitCost: number // millimes
}

export interface RecordPurchaseInput {
  supplier?: string
  reference?: string
  items: PurchaseItemInput[]
  total: number // millimes
  /** What was handed to the supplier now. The rest is owed. */
  paid: number
  /** Invoice date — often not today, so it is chosen in the form. */
  date?: number
  note?: string
}

/** What is still owed to the supplier on this invoice. */
export function purchaseOwed(p: Purchase): number {
  return Math.max(0, p.total - (p.paid ?? 0))
}

export type PurchaseStatus = 'paid' | 'partial' | 'unpaid'

export function purchaseStatus(p: Purchase): PurchaseStatus {
  const paid = p.paid ?? 0
  if (paid >= p.total) return 'paid'
  return paid > 0 ? 'partial' : 'unpaid'
}

/** Live list of purchases, newest first. */
export function usePurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, shopPath(PURCHASES)), orderBy('date', 'desc'))
    return onSnapshot(
      q,
      (snap) => {
        setPurchases(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Purchase, 'id'>) })),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [])

  return { purchases, loading, error }
}

/**
 * Records a purchase atomically: writes the purchase and, for each line linked
 * to a product, increments its stock and refreshes its cost price.
 *
 * The commit is deliberately NOT awaited. Firestore resolves a write only when
 * the server acknowledges it, so with the line down `await batch.commit()` never
 * settled — and it never rejected either, so the try/catch in NewPurchase.save
 * could not help and its `finally setBusy(false)` never ran. The owner watched a
 * spinner on a delivery that was in fact already durable in IndexedDB, cancelled,
 * re-entered the whole invoice, and on reconnect the shop had two facture d'achat
 * documents for one delivery and twice the stock: an inventory error that looks
 * exactly like theft when the shelves are counted.
 *
 * Everything below is applied to the local cache the moment commit() is called
 * and is replayed, in order, on reconnect. track() puts it in the header's
 * pending count, which is the only honest place to answer "has my facture
 * actually gone up".
 *
 * It stays `async` so callers keep awaiting exactly what they awaited before —
 * the batch-size refusal below and a shopPath() throw still surface as a
 * rejection, and those two are the only failures a caller can act on.
 */
export async function recordPurchase(input: RecordPurchaseInput) {
  const now = Date.now()
  const batch = writeBatch(db)

  const purchaseRef = doc(collection(db, shopPath(PURCHASES)))
  batch.set(purchaseRef, {
    supplier: input.supplier || undefined,
    reference: input.reference || undefined,
    note: input.note || undefined,
    items: input.items,
    total: input.total,
    paid: input.paid,
    // All three stamps are client clock values, and must stay that way. The
    // listener above orders by `date`, and serverTimestamp() reads back as null
    // in the local cache until the server fills it in — so an invoice entered
    // offline would drop out of the Achats list, out of the supplier's history
    // and out of the dashboard's supplier debt until the line came back, which
    // is precisely when the owner needs to see it.
    date: input.date ?? now,
    createdAt: now,
    updatedAt: now,
  })

  // Merge duplicate lines for the same product: one write per document.
  const perProduct = new Map<string, { qty: number; cost: number; unitCost: number }>()
  for (const it of input.items) {
    if (!it.productId) continue
    const agg = perProduct.get(it.productId) ?? { qty: 0, cost: 0, unitCost: it.unitCost }
    agg.qty += it.qty
    agg.cost += it.qty * it.unitCost
    agg.unitCost = it.unitCost // the last line wins as the new cost price
    perProduct.set(it.productId, agg)
  }

  // The invoice and the stock it brings in must land together, so this stays
  // one batch — which means it is bounded. Refuse loudly rather than have
  // Firestore reject a 600-line invoice with an opaque error.
  if (perProduct.size >= BATCH_LIMIT) {
    throw new Error(
      `recordPurchase: ${perProduct.size} produits distincts — divisez la facture`,
    )
  }

  for (const [productId, agg] of perProduct) {
    batch.update(doc(db, shopPath(PRODUCTS), productId), {
      quantity: increment(agg.qty),
      // Only a real price refreshes the cost. A blank or zero cost field would
      // otherwise wipe it permanently, and every later sale would snapshot
      // unitCost 0 — making the product look like 100% pure profit forever.
      ...(agg.unitCost > 0 ? { costPrice: agg.unitCost } : {}),
      // Lifetime "bought" totals, for the profitability report.
      boughtQty: increment(agg.qty),
      boughtCost: increment(agg.cost),
      updatedAt: now,
    })
  }

  void track(batch.commit()).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
  })
}

/**
 * Records money handed to the supplier against an existing invoice.
 *
 * Not awaited, for the reason spelled out on recordPurchase. The consequence
 * here was its own kind of bad: the payment dialog hung, the owner cancelled and
 * settled the invoice again, and increment() applied both amounts on reconnect.
 * purchaseOwed() floors the result at 0, so nothing but the Payé column — hidden
 * on a narrow screen — ever showed that the supplier had been paid twice. Now the
 * increment reaches the local cache immediately, owed goes to 0 on the spot and
 * PurchasesTab stops rendering the Payer button for that row at all.
 */
export async function settlePurchase(id: string, amount: number) {
  if (amount <= 0) return
  void track(
    updateDoc(doc(db, shopPath(PURCHASES), id), {
      paid: increment(amount),
      updatedAt: Date.now(),
    }),
  ).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
  })
}

/**
 * Deletes the invoice and UNDOES everything it did: the stock it added and the
 * lifetime `boughtQty`/`boughtCost` it incremented.
 *
 * Reversing the aggregates is not optional. The Achats page sums the purchase
 * documents while the Rentabilité page sums `boughtCost` on the products; if
 * only the document went away the two pages would disagree forever, with no
 * way to correct it from the UI. The cost price is deliberately NOT rolled
 * back — there is no record of what it was before, and guessing is worse.
 *
 * Nothing here is awaited either, and this one was the nastiest of the three.
 * The reversal batch was awaited BEFORE the deleteDoc, so with the line down the
 * stock was rolled back in the local cache while the invoice never left the list
 * — the delete was never even reached. The row still sitting there with its
 * Supprimer button invites exactly one thing, and every extra click subtracted
 * the delivery from the shelf again. Queued mutations are replayed in the order
 * they were enqueued, so dropping the awaits changes nothing about what the
 * server ends up doing.
 */
export async function removePurchase(purchase: Purchase) {
  const now = Date.now()

  const perProduct = new Map<string, { qty: number; cost: number }>()
  for (const it of purchase.items ?? []) {
    if (!it.productId) continue
    const agg = perProduct.get(it.productId) ?? { qty: 0, cost: 0 }
    agg.qty += it.qty
    agg.cost += it.qty * it.unitCost
    perProduct.set(it.productId, agg)
  }

  const entries = [...perProduct]
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const [productId, agg] of entries.slice(i, i + BATCH_LIMIT)) {
      batch.update(doc(db, shopPath(PRODUCTS), productId), {
        quantity: increment(-agg.qty),
        boughtQty: increment(-agg.qty),
        boughtCost: increment(-agg.cost),
        updatedAt: now,
      })
    }
    void track(batch.commit()).catch(() => {
      /* replayed by the SDK; a refusal surfaces through the sync badge */
    })
  }

  void track(deleteDoc(doc(db, shopPath(PURCHASES), purchase.id))).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
  })
}
