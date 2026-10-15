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
import { isLiveProduct } from '@/features/stock/useProducts'
import type { LiveFatalReason } from '@/lib/liveCollection'
import type { Product, Purchase, Supplier } from '@/types/models'

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
  // `fatal` is forwarded rather than dropped: a listener that has given up leaves
  // the supplier list frozen at whatever it last knew, and an empty or stale list
  // reads on screen as "this shop has no suppliers" — so the owner retypes one he
  // already has, and the purchases he records against it never join up with the
  // rest of his history. `fatalReason` says whether he was refused or merely lost
  // the line, and `retry` re-arms without a reload.
  return {
    suppliers: state.data,
    loading: state.loading,
    error: state.error,
    fatal: state.fatal,
    fatalReason: state.fatalReason,
    retry: suppliersStore.retry,
  }
}

/**
 * The give-up on its own, for the one banner in the app shell. See
 * useProductsFatal in src/features/stock/useProducts.ts for why the snapshot is
 * narrowed to a reason string rather than the whole state.
 */
const suppliersFatal = (): LiveFatalReason | null => {
  const state = suppliersStore.getSnapshot()
  return state.fatal ? state.fatalReason : null
}

export function useSuppliersFatal(): LiveFatalReason | null {
  return useSyncExternalStore(suppliersStore.subscribe, suppliersFatal, suppliersFatal)
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

/**
 * Not awaited, for the same reason as createSupplier above.
 *
 * `await updateDoc` never returns with the line down — and it does not reject
 * either, so SupplierForm's `finally setBusy(false)` never ran and the dialog
 * sat spinning on an edit the device had already accepted and stored. Cancel is
 * not disabled while busy, so the owner closed the dialog and did it again,
 * queueing a second write of the same fields. The function stays `async` and
 * keeps returning a promise so the form is unchanged; it now resolves once the
 * change is durable in IndexedDB.
 *
 * deleteField() rather than undefined: `ignoreUndefinedProperties` (firebase.ts)
 * would silently drop the key and keep the old phone number on the supplier.
 */
export async function updateSupplier(
  id: string,
  input: SupplierInput,
  rename?: { from: string; purchases: Purchase[]; products: Product[] },
): Promise<void> {
  const name = input.name.trim()
  const now = Date.now()
  void track(
    updateDoc(doc(db, shopPath(COL), id), {
      name,
      phone: input.phone ? input.phone : deleteField(),
      note: input.note ? input.note : deleteField(),
      updatedAt: now,
    }),
  ).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
  })

  /*
    A RENAME CARRIES THE HISTORY WITH IT.

    Purchases and articles hold the supplier's NAME, not his id. Renaming
    "Hachette" to "Hachette TN" used to leave every facture d'achat under the
    old name: his "total acheté" dropped to zero, the Achats filter still
    offered the old name, and nothing tied the two back together. They are
    re-tagged here, from the caller's live lists — the same choice, and the
    same honest limit, as renameCategory: what this device knows about.
  */
  if (!rename || rename.from === name) return
  /*
    One write per document, not batches of 400. A batch is all or nothing, and
    one invoice or article deleted on the other till while this one was offline
    got its whole batch refused: the supplier was renamed and every purchase
    stayed under the old name. Re-tagging needs no atomicity — each document
    is right on its own — so a stale reference now fails alone.
  */
  const writes = [
    ...rename.purchases
      .filter((p) => p.supplier === rename.from)
      .map((p) => doc(db, shopPath('purchases'), p.id)),
    ...rename.products
      // Known deleted: not even tried, it would only raise the red badge.
      .filter((p) => p.supplier === rename.from && isLiveProduct(p.id) !== false)
      .map((p) => doc(db, shopPath('products'), p.id)),
  ]
  for (const ref of writes) {
    void track(updateDoc(ref, { supplier: name, updatedAt: now })).catch(() => {
      /* replayed by the SDK; a refusal surfaces through the sync badge */
    })
  }
}

/**
 * Not awaited either: the row is already gone from the local cache when this
 * returns, and awaiting the server would leave the list frozen mid-delete with
 * the line down. Purchases keep the supplier *name* they were recorded with, so
 * removing the supplier never rewrites history.
 */
export async function removeSupplier(id: string): Promise<void> {
  void track(deleteDoc(doc(db, shopPath(COL), id))).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
  })
}
