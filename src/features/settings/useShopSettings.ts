import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, deleteField } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { track } from '@/lib/syncStatus'
import type { ShopSettings } from '@/types/models'

const REF = () => doc(db, shopPath('settings'), 'shop')

export const DEFAULT_SHOP: ShopSettings = {
  name: 'Librairie',
  footer: 'Merci et à bientôt !',
}

/**
 * The last settings document this device has seen, mirrored out of the live
 * subscription below.
 *
 * `carryCategoryMargin` has to know which margins already exist before it can
 * move one, and it must not ask the server for them: `getDoc` does not fall
 * back to the cache on a line that is up but dead, so an awaited read there
 * would hang the very rename it is meant to complete. AppShell subscribes to
 * `useShopSettings` for the whole session (AppShell.tsx:82), so by the time any
 * screen can rename a category this mirror is warm.
 *
 * `null` means "no screen has read the document yet", which is different from
 * "the document does not exist" — the latter is recorded as DEFAULT_SHOP, i.e.
 * a known answer with no margins in it.
 */
let latest: ShopSettings | null = null

/**
 * The shop identity printed at the top of every ticket. A single document, so
 * one live subscription is enough and the till always prints the current name
 * without a reload.
 */
export function useShopSettings() {
  const [shop, setShop] = useState<ShopSettings>(DEFAULT_SHOP)
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        REF(),
        (snap) => {
          // Mirrored on both branches: a document that does not exist yet is
          // still an answer, and carryCategoryMargin needs to tell that apart
          // from never having looked.
          const next = snap.exists()
            ? { ...DEFAULT_SHOP, ...(snap.data() as ShopSettings) }
            : DEFAULT_SHOP
          latest = next
          if (snap.exists()) setShop(next)
          setLoading(false)
        },
        // An unreadable settings doc must not stop the shop from selling.
        () => setLoading(false),
      ),
    [],
  )

  return { shop, loading }
}

/**
 * The write is NOT awaited.
 *
 * Firestore only resolves a write once the server has acknowledged it, so with
 * the line down `await` never returns and the Enregistrer button spins for
 * ever — while the change is in fact already durable in IndexedDB and will go
 * up by itself. The sync badge in the header is what reports the journey; this
 * reports only that the shop has taken the change, which it has.
 */
export function saveShopSettings(settings: ShopSettings): void {
  patchShopSettings(settings)
}

/**
 * Writes only the fields named, leaving the rest of the document alone.
 *
 * For the settings that ARE the switch — the dinars/millimes mode, the sidebar
 * toggles — where a Save button would be a lie: the sidebar redraws the moment
 * the switch moves, so pretending the change is pending would leave the screen
 * and the setting disagreeing.
 *
 * The point of the narrow patch is what it does NOT carry. Those switches sit
 * on the same screen as the shop's name and address, so writing the whole form
 * would push a half-typed address to the server — and to the other machine —
 * because somebody flipped an unrelated switch. merge:true means every field
 * absent from `patch` keeps whatever it already had.
 */
export function patchShopSettings(patch: Partial<ShopSettings>): void {
  void track(
    setDoc(REF(), { ...patch, updatedAt: Date.now() }, { merge: true }),
  ).catch(() => {})
}

/**
 * Moves a category's margin when the category is renamed.
 *
 * `shop.categoryMargins` is keyed by category NAME (models.ts), and
 * `renameCategory` used to rewrite that name on the category document and on
 * every product while leaving this map untouched. So the owner set 50 % on
 * "Cahiers", renamed it to "Cahiers scolaires", and every article created in it
 * afterwards was priced from `shop.defaultMargin` instead — `defaultMarginFor`
 * (pricing.ts) simply found no key and fell through. Nothing on screen said so;
 * the shelf prices were just quietly wrong from then on. Any future code that
 * renames a category must come through here.
 *
 * The three awkward cases, decided rather than left to chance:
 *
 *   · The old name carries no margin — there is nothing to move and no write at
 *     all, which is also the honest answer when the settings document does not
 *     exist yet.
 *   · The destination name already carries one — it wins, because articles are
 *     already priced with it. Merging "Cahiers" into an existing "Papeterie"
 *     must not reprice Papeterie. The source key is still dropped: no category
 *     answers to that name any more.
 *   · Nothing is awaited, for the reason given on `saveShopSettings` above.
 *
 * The patch is a nested object, never a dotted field path: category names are
 * free text, so `updateDoc(ref, 'categoryMargins.Cahiers 24x32.', …)` would be
 * split on every dot in the name and write a map several levels deeper than
 * intended. Object keys are literal segments and need no escaping here.
 */
export function carryCategoryMargin(from: string, to: string): void {
  if (from === to) return
  const margins = latest?.categoryMargins
  const moving = margins?.[from]
  if (typeof moving !== 'number' || !Number.isFinite(moving)) return

  const patch: Record<string, unknown> = { [from]: deleteField() }
  const destination = margins?.[to]
  if (typeof destination !== 'number' || !Number.isFinite(destination)) {
    patch[to] = moving
  }

  // merge:true so the other margins and the rest of the shop identity survive;
  // deleteField() inside the nested map is what actually removes the old key,
  // since a merge would otherwise leave it sitting there forever.
  void track(
    setDoc(REF(), { categoryMargins: patch, updatedAt: Date.now() }, { merge: true }),
  ).catch(() => {})
}
