import { useSyncExternalStore } from 'react'
import {
  collection,
  query,
  orderBy,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { track } from '@/lib/syncStatus'
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

/**
 * Mints the id locally and does NOT await the server.
 *
 * This used to be addDoc, whose promise resolves only on acknowledgement. With
 * the line down it never resolves at all — and because ProductForm.submit awaits
 * ensureCategory and ensureSupplier BEFORE createProduct, that one unresolved
 * promise made adding a product offline completely impossible. The try/catch
 * around the call could not help: the promise was not rejecting, it was hanging.
 *
 * The document is durable in IndexedDB the moment setDoc is called, so the id
 * returned here is safe to reference immediately. Returning it synchronously,
 * rather than as an already-resolved promise, is deliberate: a promise that
 * resolves before the write lands would invite exactly the misreading that
 * caused this bug.
 */
export function createSupplier(input: SupplierInput): string {
  const now = Date.now()
  const ref = doc(collection(db, shopPath(COL)))
  void track(
    setDoc(ref, {
      name: input.name.trim(),
      phone: input.phone || undefined,
      note: input.note || undefined,
      createdAt: now,
      updatedAt: now,
    }),
  ).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
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
