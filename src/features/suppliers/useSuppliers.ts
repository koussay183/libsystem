import { useSyncExternalStore } from 'react'
import {
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { createLiveCollection } from '@/lib/liveCollection'
import type { Supplier } from '@/types/models'

const COL = 'suppliers'

export interface SupplierInput {
  name: string
  phone?: string
  note?: string
}

/** Live list of managed suppliers (fournisseurs), ordered by name. */
const suppliersStore = createLiveCollection<Supplier>(() =>
  query(collection(db, shopPath(COL)), orderBy('name')),
)

export function useSuppliers() {
  const state = useSyncExternalStore(
    suppliersStore.subscribe,
    suppliersStore.getSnapshot,
    suppliersStore.getSnapshot,
  )
  return { suppliers: state.data, loading: state.loading, error: state.error }
}

export async function createSupplier(input: SupplierInput): Promise<string> {
  const now = Date.now()
  const ref = await addDoc(collection(db, shopPath(COL)), {
    name: input.name.trim(),
    phone: input.phone || undefined,
    note: input.note || undefined,
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

export async function updateSupplier(id: string, input: SupplierInput) {
  await updateDoc(doc(db, shopPath(COL), id), {
    name: input.name.trim(),
    phone: input.phone ? input.phone : deleteField(),
    note: input.note ? input.note : deleteField(),
    updatedAt: Date.now(),
  })
}

export async function removeSupplier(id: string) {
  await deleteDoc(doc(db, shopPath(COL), id))
}
