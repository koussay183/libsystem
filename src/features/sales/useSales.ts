import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  doc,
  writeBatch,
  increment,
} from 'firebase/firestore'
import dayjs from 'dayjs'
import { db } from '@/lib/firebase'
import { track } from '@/lib/syncStatus'
import type { Sale, SaleItem, PaymentMode } from '@/types/models'

const SALES = 'sales'
const PRODUCTS = 'products'
const CUSTOMERS = 'customers'
const ENTRIES = 'credit_entries'

export type SaleItemInput = SaleItem

export interface RecordSaleInput {
  items: SaleItemInput[]
  /** Sum of the lines, before the whole-ticket discount. */
  subtotal: number
  /** Whole-ticket discount in millimes (0 when there is none). */
  discount: number
  /** Net total = subtotal - discount. Negative on a pure return. */
  total: number
  /** Amount applied to this ticket now. Never more than `total`. */
  paid: number
  /** Cash the client actually handed over, when more than the total. */
  received?: number
  mode: PaymentMode
  customerId?: string | null
  customerName?: string | null
  kind?: 'ticket' | 'invoice'
}

export interface RecordedSale {
  id: string
  ticketNo: string
  date: number
  /**
   * True when the shop was offline: the ticket is safely written to this
   * device and will reach the server on its own, but is not there yet.
   */
  pending: boolean
}

/**
 * How long to wait for the server before telling the cashier the ticket is in.
 *
 * Firestore resolves a commit only when the server acknowledges it, so with the
 * line down the promise below never settles: the till would spin forever with
 * no ticket and no error, and a cashier who reloads and rings the sale again
 * would have it recorded twice once the connection returned. By then the write
 * is already durable on this device, so after this delay we say so and let him
 * carry on serving.
 */
const OFFLINE_ACK_MS = 3500

/** Live list of sales, newest first. Capped so the till stays fast. */
export function useSales(max = 200) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, SALES), orderBy('date', 'desc'), limit(max))
    return onSnapshot(
      q,
      (snap) => {
        setSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) })))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [max])

  return { sales, loading, error }
}

/**
 * Only today's tickets. The home screen shows "sales so far today" and nothing
 * else, and downloading the last few hundred tickets to add up two numbers is
 * a lot of documents to pull over a shop connection. A range filter on the same
 * field it is ordered by needs no composite index.
 */
export function useTodaySales() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const q = query(
      collection(db, SALES),
      where('date', '>=', start.getTime()),
      orderBy('date', 'desc'),
    )
    return onSnapshot(
      q,
      (snap) => {
        setSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) })))
        setLoading(false)
      },
      // The day's total is a nicety; it must never block the home screen.
      () => setLoading(false),
    )
  }, [])

  return { sales, loading }
}

/**
 * Ticket reference derived from the timestamp — no counter contention.
 * The two-character suffix keeps two tickets rung up inside the same second
 * distinguishable: this string is printed on the receipt and copied into the
 * client's carnet line, so a collision makes a debt impossible to trace back.
 */
export function makeTicketNo(ts: number): string {
  const suffix = Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, '0')
    .toUpperCase()
  return `${dayjs(ts).format('YYMMDD-HHmmss')}-${suffix}`
}

/**
 * Records a ticket in ONE atomic batch:
 *  - writes the sale
 *  - moves each product's stock (a return line has a negative qty, so the very
 *    same arithmetic puts the goods back)
 *  - moves each product's lifetime sold qty / revenue / cost, which is what
 *    makes the profitability report instant instead of replaying every ticket
 *  - for credit/partial, writes the client's debit line and bumps their balance
 *
 * Either everything lands or nothing does; there is no half-recorded sale.
 * Lines with a null productId are free "article divers" lines (a photocopy,
 * say) — they count towards the money but touch no stock.
 */
export async function recordSale(input: RecordSaleInput): Promise<RecordedSale> {
  const unpaid = input.total - input.paid

  // Refusing here beats silently losing the debt: an unpaid balance with
  // nobody attached to it is money the shop can never chase.
  if (unpaid > 0 && !input.customerId) {
    throw new Error('recordSale: unpaid balance requires a customer')
  }

  const now = Date.now()
  const ticketNo = makeTicketNo(now)
  const batch = writeBatch(db)

  const saleRef = doc(collection(db, SALES))
  batch.set(saleRef, {
    ticketNo,
    items: input.items,
    subtotal: input.subtotal,
    discount: input.discount,
    total: input.total,
    paid: input.paid,
    received: input.received ?? input.paid,
    mode: input.mode,
    onCredit: unpaid > 0,
    customerId: input.customerId ?? null,
    customerName: input.customerName ?? null,
    kind: input.kind ?? 'ticket',
    hasReturn: input.items.some((it) => it.qty < 0),
    date: now,
    createdAt: now,
  })

  // One update per product, even if the same product appears on both a sale
  // line and a return line — Firestore rejects two writes to one document in
  // a single batch.
  const perProduct = new Map<string, { qty: number; revenue: number; cost: number }>()
  for (const it of input.items) {
    if (!it.productId) continue
    const agg = perProduct.get(it.productId) ?? { qty: 0, revenue: 0, cost: 0 }
    agg.qty += it.qty
    agg.revenue += it.qty * it.unitPrice
    agg.cost += it.qty * it.unitCost
    perProduct.set(it.productId, agg)
  }

  for (const [productId, agg] of perProduct) {
    batch.update(doc(db, PRODUCTS, productId), {
      quantity: increment(-agg.qty),
      soldQty: increment(agg.qty),
      soldRevenue: increment(agg.revenue),
      soldCost: increment(agg.cost),
      // Only a real sale refreshes "last sold" — a return must not make a
      // dead product look like it is moving again.
      ...(agg.qty > 0 ? { lastSoldAt: now } : {}),
      updatedAt: now,
    })
  }

  if (unpaid > 0 && input.customerId) {
    batch.set(doc(collection(db, ENTRIES)), {
      customerId: input.customerId,
      type: 'debit',
      amount: unpaid,
      label: `Ticket ${ticketNo}`,
      saleId: saleRef.id,
      ticketNo,
      date: now,
      createdAt: now,
    })
    batch.update(doc(db, CUSTOMERS, input.customerId), {
      balance: increment(unpaid),
      updatedAt: now,
    })
  }

  // Counted while it is in flight, so the header can say whether the shop's
  // tickets have actually reached the server.
  const commit = track(batch.commit())
  // A rejection that arrives after the race below has already been decided
  // still needs a handler, or it surfaces as an unhandled rejection.
  commit.catch(() => {})

  let pending = false
  await Promise.race([
    commit,
    new Promise<void>((resolve) => {
      setTimeout(() => {
        pending = true
        resolve()
      }, OFFLINE_ACK_MS)
    }),
  ])
  return { id: saleRef.id, ticketNo, date: now, pending }
}
