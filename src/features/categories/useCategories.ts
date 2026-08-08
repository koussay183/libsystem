import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
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
import type { Category } from '@/types/models'

const COL = 'categories'
const PRODUCTS = 'products'

/** Firestore caps a batch at 500 writes; stay clear of the edge. */
const BATCH_LIMIT = 400

/** Live list of managed product categories, ordered by name. */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('name'))
    return onSnapshot(
      q,
      (snap) => {
        setCategories(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) })),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  return { categories, loading }
}

export async function createCategory(name: string): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
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

  await updateDoc(doc(db, COL, id), { name: next })

  const affected = await getDocs(
    query(collection(db, PRODUCTS), where('category', '==', from)),
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
    query(collection(db, PRODUCTS), where('category', '==', name)),
  )
  return snap.size
}

/** Removes the category. Products keep their label; they just stop matching. */
export async function removeCategory(id: string) {
  await deleteDoc(doc(db, COL, id))
}
