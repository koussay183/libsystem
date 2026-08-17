import { useSyncExternalStore } from 'react'
import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  doc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { createLiveCollection } from '@/lib/liveCollection'
import type { Category } from '@/types/models'

const COL = 'categories'
const PRODUCTS = 'products'

/** Firestore caps a batch at 500 writes; stay clear of the edge. */
const BATCH_LIMIT = 400

/** Live list of managed product categories, ordered by name. */
const categoriesStore = createLiveCollection<Category>(() =>
  query(collection(db, shopPath(COL)), orderBy('name')),
)

export function useCategories() {
  const state = useSyncExternalStore(
    categoriesStore.subscribe,
    categoriesStore.getSnapshot,
    categoriesStore.getSnapshot,
  )
  // The error is surfaced, not swallowed: a permissions failure used to render
  // as "no categories yet", and the owner would retype the ones he already had.
  return { categories: state.data, loading: state.loading, error: state.error }
}

export async function createCategory(name: string): Promise<string> {
  const ref = await addDoc(collection(db, shopPath(COL)), {
    name: name.trim(),
    createdAt: Date.now(),
  })
  return ref.id
}

/**
 * Renames the category and re-tags every product that referenced it.
 * Products store the category *name*, so skipping this step would orphan them
 * under a category that no longer exists.
 */
export async function renameCategory(id: string, from: string, to: string) {
  const next = to.trim()
  if (next === '' || next === from) return

  await updateDoc(doc(db, shopPath(COL), id), { name: next })

  const affected = await getDocs(
    query(collection(db, shopPath(PRODUCTS)), where('category', '==', from)),
  )
  for (let i = 0; i < affected.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const d of affected.docs.slice(i, i + BATCH_LIMIT)) {
      batch.update(d.ref, { category: next, updatedAt: Date.now() })
    }
    await batch.commit()
  }
}

/** How many products currently sit in this category. */
export async function countProductsInCategory(name: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, shopPath(PRODUCTS)), where('category', '==', name)),
  )
  return snap.size
}

/** Removes the category. Products keep their label; they just stop matching. */
export async function removeCategory(id: string) {
  await deleteDoc(doc(db, shopPath(COL), id))
}
