import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  deleteField,
  writeBatch,
  increment,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Product, ProductInput } from '@/types/models'

const COL = 'products'

/** Firestore caps a batch at 500 writes; stay clear of the edge. */
const BATCH_LIMIT = 400

/** Firestore caps an `in` filter at 30 values. */
const IN_LIMIT = 30

/** Live-subscribes to the products collection, ordered by name. */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('name'))
    return onSnapshot(
      q,
      (snap) => {
        setProducts(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) })),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [])

  return { products, loading, error }
}

/** Creates the product and returns its new document id — the till adds the
 *  freshly created article to the open ticket without waiting for the
 *  snapshot to come round. */
export async function createProduct(input: ProductInput): Promise<string> {
  const now = Date.now()
  const ref = await addDoc(collection(db, COL), {
    ...input,
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

export async function updateProduct(id: string, input: ProductInput) {
  // deleteField() removes cleared optional text fields; undefined would be
  // silently ignored (ignoreUndefinedProperties) and keep the stale value.
  // The lifetime aggregates (soldQty/soldRevenue/soldCost/boughtQty/boughtCost/
  // lastSoldAt) are deliberately absent: the till and the purchase flow own
  // them, and writing them here would destroy the profit report.
  await updateDoc(doc(db, COL, id), {
    barcode: input.barcode,
    name: input.name,
    category: input.category ?? deleteField(),
    supplier: input.supplier ?? deleteField(),
    family: input.family ?? deleteField(),
    variant: input.variant ?? deleteField(),
    unit: input.unit ?? deleteField(),
    costPrice: input.costPrice,
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
      batch.set(doc(collection(db, COL)), { ...input, createdAt: now, updatedAt: now })
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
  await updateDoc(doc(db, COL, id), {
    quantity: increment(units),
    updatedAt: Date.now(),
  })
}

/** Corrects the count to what was actually found on the shelf (inventory). */
export async function setStock(id: string, quantity: number) {
  await updateDoc(doc(db, COL, id), {
    quantity: Math.max(0, Math.trunc(quantity)),
    updatedAt: Date.now(),
  })
}

export async function removeProduct(id: string) {
  await deleteDoc(doc(db, COL, id))
}

/** The product a barcode already belongs to — enough to name it in an error. */
export interface BarcodeOwner {
  id: string
  name: string
}

/** Returns the product already using this barcode, or null. */
export async function findProductByBarcode(barcode: string): Promise<BarcodeOwner | null> {
  const code = barcode.trim()
  if (code === '') return null
  const snap = await getDocs(
    query(collection(db, COL), where('barcode', '==', code), limit(1)),
  )
  const found = snap.docs[0]
  if (!found) return null
  return { id: found.id, name: (found.data() as Omit<Product, 'id'>).name }
}

/**
 * Same check for a whole batch of barcodes, keyed by barcode.
 * Chunked at 30 because that is Firestore's ceiling for an `in` filter.
 */
export async function findProductsByBarcodes(
  barcodes: string[],
): Promise<Map<string, BarcodeOwner>> {
  const codes = [...new Set(barcodes.map((b) => b.trim()).filter((b) => b !== ''))]
  const owners = new Map<string, BarcodeOwner>()
  for (let i = 0; i < codes.length; i += IN_LIMIT) {
    const snap = await getDocs(
      query(collection(db, COL), where('barcode', 'in', codes.slice(i, i + IN_LIMIT))),
    )
    for (const d of snap.docs) {
      const data = d.data() as Omit<Product, 'id'>
      if (data.barcode) owners.set(data.barcode, { id: d.id, name: data.name })
    }
  }
  return owners
}
