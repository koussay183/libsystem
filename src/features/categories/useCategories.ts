import { useSyncExternalStore } from 'react'
import {
  collection,
  query,
  orderBy,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  doc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { track } from '@/lib/syncStatus'
import { createLiveCollection } from '@/lib/liveCollection'
import type { LiveFatalReason } from '@/lib/liveCollection'
import { carryCategoryMargin } from '@/features/settings/useShopSettings'
import type { Category, Product } from '@/types/models'

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
  // `fatal` says the stronger thing — the listener has stopped for good and will
  // not come back on its own — which on this collection is what turns "no
  // categories yet" into a product form that quietly offers none, so every
  // article saved from then on lands uncategorised and out of the margin rules.
  // `fatalReason` distinguishes a refusal from a worn-out line, and `retry` is
  // the only recovery that does not require a page reload.
  return {
    categories: state.data,
    loading: state.loading,
    error: state.error,
    fatal: state.fatal,
    fatalReason: state.fatalReason,
    retry: categoriesStore.retry,
  }
}

/**
 * The give-up on its own, for the one banner in the app shell. See
 * useProductsFatal in src/features/stock/useProducts.ts for why the snapshot is
 * narrowed to a reason string rather than the whole state.
 */
const categoriesFatal = (): LiveFatalReason | null => {
  const state = categoriesStore.getSnapshot()
  return state.fatal ? state.fatalReason : null
}

export function useCategoriesFatal(): LiveFatalReason | null {
  return useSyncExternalStore(categoriesStore.subscribe, categoriesFatal, categoriesFatal)
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
export function createCategory(name: string): string {
  const ref = doc(collection(db, shopPath(COL)))
  void track(
    setDoc(ref, { name: name.trim(), createdAt: Date.now() }),
  ).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
  })
  return ref.id
}

/**
 * Renames the category, re-tags every product that referenced it, and carries
 * the category's margin across with the name.
 *
 * Products store the category *name*, so skipping the re-tag would orphan them
 * under a category that no longer exists.
 *
 * NOTHING HERE IS AWAITED ANY MORE. Firestore resolves a write only when the
 * server acknowledges it, so with the line down `await updateDoc` and
 * `await batch.commit()` never returned — they did not reject either, so the
 * try/catch in SettingsPage could not help and its `finally setBusy(false)`
 * never ran. The rename had in fact already been applied to the local cache and
 * the list behind the dialog already showed the new name, while the dialog sat
 * on a dead spinner. The function stays `async` and keeps returning a promise so
 * the call site is unchanged; that promise now settles once the device has taken
 * the change, which is the only thing this screen can honestly report.
 *
 * The products come from the caller's live snapshot instead of a
 * `where('category','==',from)` query. Offline that query was a second hang:
 * `getDocs` does not fall back to the cache on a line that is up but dead, which
 * is the same reason `findProductByBarcode` (useProducts.ts) was converted to
 * read the resident snapshot. The honest consequence: A RENAME NOW COVERS THE
 * PRODUCTS THIS DEVICE KNOWS ABOUT. On a machine whose product subscription is
 * warm — the settings page holds one open for exactly this reason — that is all
 * of them; an article created on another till and not yet replicated here keeps
 * the old label and has to be re-tagged by hand. Not answering at all was worse.
 */
export async function renameCategory(
  id: string,
  from: string,
  to: string,
  products: Product[],
): Promise<void> {
  const next = to.trim()
  if (next === '' || next === from) return

  void track(updateDoc(doc(db, shopPath(COL), id), { name: next })).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
  })

  // The per-category margin is keyed by NAME, so it has to travel with the
  // rename or every article priced in this category afterwards silently falls
  // back to shop.defaultMargin. See carryCategoryMargin for the collision rules.
  carryCategoryMargin(from, next)

  const affected = products.filter((p) => p.category === from)
  const now = Date.now()
  for (let i = 0; i < affected.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const p of affected.slice(i, i + BATCH_LIMIT)) {
      batch.update(doc(db, shopPath(PRODUCTS), p.id), { category: next, updatedAt: now })
    }
    void track(batch.commit()).catch(() => {
      /* replayed by the SDK; a refusal surfaces through the sync badge */
    })
  }
}

/**
 * How many products currently sit in this category, counted in the caller's
 * live snapshot.
 *
 * This used to be an awaited `getDocs`, so with the line down the delete
 * confirmation could not even be put on screen: the owner was unable to remove a
 * category offline at all. Counting the snapshot answers instantly and is only
 * as fresh as the subscription, which is the right trade for a number that
 * decorates a confirm dialog.
 */
export async function countProductsInCategory(
  name: string,
  products: Product[],
): Promise<number> {
  return products.filter((p) => p.category === name).length
}

/**
 * Removes the category. Products keep their label; they just stop matching.
 *
 * Not awaited, for the reason spelled out on renameCategory: offline a
 * `deleteDoc` never settles, and the row is already gone from the local cache by
 * the time the click returns.
 *
 * `shop.categoryMargins` is deliberately left alone here. The margin is keyed by
 * category NAME and the products that were in this category keep that name, so
 * `defaultMarginFor` (pricing.ts) goes on pricing them exactly as the owner set
 * it up. Dropping the key would reintroduce the silent repricing that
 * renameCategory now prevents, only triggered by a delete instead of a rename —
 * the same wrong shelf prices with nothing on screen to explain them. The key
 * stops being listed in the margin editor (it shows live categories only), costs
 * a few bytes, and comes back to life if the category is recreated under the
 * same name.
 */
export async function removeCategory(id: string): Promise<void> {
  void track(deleteDoc(doc(db, shopPath(COL), id))).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
  })
}
