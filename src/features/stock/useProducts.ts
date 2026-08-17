import { useSyncExternalStore } from 'react'
import {
  collection,
  setDoc,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  deleteField,
  writeBatch,
  increment,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { createLiveCollection } from '@/lib/liveCollection'
import { track } from '@/lib/syncStatus'
import { codeOf, loose } from './barcode'
import type { Product, ProductInput } from '@/types/models'

const COL = 'products'

/** Firestore caps a batch at 500 writes; stay clear of the edge. */
const BATCH_LIMIT = 400


/**
 * The stock, live and ordered by name. Shared across every screen: the till,
 * the stock table and the dialogs on top of it all read the same subscription
 * instead of opening one each.
 */
const productsStore = createLiveCollection<Product>(() =>
  query(collection(db, shopPath(COL)), orderBy('name')),
)

export function useProducts() {
  const state = useSyncExternalStore(
    productsStore.subscribe,
    productsStore.getSnapshot,
    productsStore.getSnapshot,
  )
  return { products: state.data, loading: state.loading, error: state.error }
}

/**
 * Creates the product and returns its new document id — the till adds the
 * freshly created article to the open ticket without waiting for the snapshot
 * to come round.
 *
 * The id is minted locally and the write is NOT awaited, because Firestore
 * resolves a write only when the server acknowledges it: with the line down,
 * awaiting addDoc never returns, and the cashier who scanned an unknown book
 * would watch the dialog spin forever with a customer at the counter. The
 * document is already durable in IndexedDB the moment setDoc is called, and
 * the SDK sends it when the connection is back.
 */
export function createProduct(input: ProductInput): string {
  const now = Date.now()
  const ref = doc(collection(db, shopPath(COL)))
  void track(
    setDoc(ref, { ...input, createdAt: now, updatedAt: now }),
  ).catch(() => {
    /* replayed by the SDK; a hard rejection surfaces on the stock list */
  })
  return ref.id
}

export async function updateProduct(id: string, input: ProductInput) {
  // deleteField() removes cleared optional text fields; undefined would be
  // silently ignored (ignoreUndefinedProperties) and keep the stale value.
  // The lifetime aggregates (soldQty/soldRevenue/soldCost/boughtQty/boughtCost/
  // lastSoldAt) are deliberately absent: the till and the purchase flow own
  // them, and writing them here would destroy the profit report.
  await updateDoc(doc(db, shopPath(COL), id), {
    barcode: input.barcode,
    name: input.name,
    category: input.category ?? deleteField(),
    supplier: input.supplier ?? deleteField(),
    family: input.family ?? deleteField(),
    variant: input.variant ?? deleteField(),
    unit: input.unit ?? deleteField(),
    costPriceHT: input.costPriceHT ?? deleteField(),
    vatRate: input.vatRate ?? deleteField(),
    costPrice: input.costPrice,
    margin: input.margin ?? deleteField(),
    salePrice: input.salePrice,
    // `quantity` is deliberately NOT written here. The form captured it when
    // the dialog opened, so saving would blind-write a stale count and undo
    // every sale rung up in the meantime. Stock moves only through the till,
    // a purchase, or addStock/setStock — all of which are race-free.
    lowStockThreshold: input.lowStockThreshold,
    updatedAt: Date.now(),
  })
}

/**
 * Creates several products in one go — the "one pen, many kinds" flow.
 * Each kind stays its own document (own barcode, price, stock and profit);
 * only the write is shared. Chunked so a big family never trips the 500-write
 * batch cap.
 */
export async function createProducts(inputs: ProductInput[]): Promise<number> {
  const now = Date.now()
  for (let i = 0; i < inputs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const input of inputs.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(collection(db, shopPath(COL))), { ...input, createdAt: now, updatedAt: now })
    }
    await batch.commit()
  }
  return inputs.length
}

/**
 * Adds units received from a supplier. Atomic increment, so a sale rung up on
 * the till at the same moment is never overwritten.
 */
export async function addStock(id: string, delta: number) {
  const units = Math.trunc(delta)
  if (!Number.isFinite(units) || units === 0) return
  await updateDoc(doc(db, shopPath(COL), id), {
    quantity: increment(units),
    updatedAt: Date.now(),
  })
}

/** Corrects the count to what was actually found on the shelf (inventory). */
export async function setStock(id: string, quantity: number) {
  await updateDoc(doc(db, shopPath(COL), id), {
    quantity: Math.max(0, Math.trunc(quantity)),
    updatedAt: Date.now(),
  })
}

export async function removeProduct(id: string) {
  await deleteDoc(doc(db, shopPath(COL), id))
}

/** The product a barcode already belongs to — enough to name it in an error. */
export interface BarcodeOwner {
  id: string
  name: string
}

/**
 * The product already carrying this barcode, compared the way the rest of the
 * app compares codes.
 *
 * IT USED TO ASK THE SERVER FOR AN EXACT STRING MATCH, and that was wrong twice
 * over.
 *
 * Wrong on the comparison: everything else in this codebase decides two codes
 * are the same article through loose() — the till indexes both spellings,
 * sharedCodes() counts loosely, the pack form clashes loosely, and catalogKey()
 * is built on it. Only this check, the one whose whole job is to say "you
 * already have this", compared raw. So saving 978-2-07-036822-8 against an
 * existing 9782070368228 reported the code as free, created a second document,
 * and the owner discovered it later as a purple "code partage" badge in the
 * stock list and a chooser dialog on every scan of that book.
 *
 * Wrong on the transport: it was an awaited getDocs, so with the line down the
 * product form hung on a duplicate check instead of saving.
 *
 * Now it reads the snapshot already resident on the device — the same one the
 * till sells from. The contract weakens honestly from "authoritative" to "as
 * fresh as the subscription", which is the right trade: the alternative needs a
 * normalised field on every product, a migration, and an index, to answer a
 * question that only ever guards a warning.
 */
export async function findProductByBarcode(barcode: string): Promise<BarcodeOwner | null> {
  const key = loose(codeOf(barcode))
  if (key === '') return null
  for (const p of productsStore.getSnapshot().data) {
    if (loose(codeOf(p.barcode)) === key) return { id: p.id, name: p.name }
  }
  return null
}

/**
 * The same question for a whole batch, in one pass over the resident snapshot.
 *
 * The returned map is keyed by the spelling the CALLER passed in, not by the
 * spelling stored on the product. VariantsDialog asks `owners.has(c)` with its
 * own strings, so keying by the stored barcode reintroduced the very mismatch
 * this function exists to catch: the clash was found and then looked up under
 * a key the caller had never heard of.
 */
export async function findProductsByBarcodes(
  barcodes: string[],
): Promise<Map<string, BarcodeOwner>> {
  const owners = new Map<string, BarcodeOwner>()
  const wanted = new Map<string, string>()
  for (const raw of barcodes) {
    const spelling = codeOf(raw)
    const key = loose(spelling)
    if (key !== '' && !wanted.has(key)) wanted.set(key, spelling)
  }
  if (wanted.size === 0) return owners
  for (const p of productsStore.getSnapshot().data) {
    const spelling = wanted.get(loose(codeOf(p.barcode)))
    if (spelling === undefined) continue
    if (!owners.has(spelling)) owners.set(spelling, { id: p.id, name: p.name })
  }
  return owners
}
