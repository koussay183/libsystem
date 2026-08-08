import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Supplier } from '@/types/models'

const COL = 'suppliers'

export interface SupplierInput {
  name: string
  phone?: string
  note?: string
}

/** Live list of managed suppliers (fournisseurs), ordered by name. */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('name'))
    return onSnapshot(
      q,
      (snap) => {
        setSuppliers(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Supplier, 'id'>) })),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [])

  return { suppliers, loading, error }
}

export async function createSupplier(input: SupplierInput): Promise<string> {
  const now = Date.now()
  const ref = await addDoc(collection(db, COL), {
    name: input.name.trim(),
    phone: input.phone || undefined,
    note: input.note || undefined,
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

export async function updateSupplier(id: string, input: SupplierInput) {
  await updateDoc(doc(db, COL, id), {
    name: input.name.trim(),
    phone: input.phone ? input.phone : deleteField(),
    note: input.note ? input.note : deleteField(),
    updatedAt: Date.now(),
  })
}

export async function removeSupplier(id: string) {
  await deleteDoc(doc(db, COL, id))
}
