/**
 * Which shop this browser is looking at.
 *
 * Every collection the app owns lives under `shops/{shopId}/…`. That is a
 * deliberate choice over keeping a `shopId` field on root documents: a
 * subcollection path makes the security rule structural — one shop's documents
 * are simply not inside another shop's path — where a field would make it
 * conventional, enforced only by every single query remembering to filter.
 * There are around forty query sites in this app. One of them forgetting is
 * one shop reading another's books.
 *
 * WHAT THIS VALUE IS NOT: it is not a security boundary. It is read from
 * localStorage, so anyone can edit it. That is fine, and it is why the rules
 * compare the path against the `shopId` custom claim on the ID token, which is
 * signed by Firebase and cannot be edited here. A tampered value in this
 * module produces permission-denied, not a leak.
 *
 * WHY IT IS READ SYNCHRONOUSLY: the shop opens the till first thing in the
 * morning, sometimes before the line is up. Waiting for a token round trip
 * before the first Firestore listen would mean no stock, no scanning, and no
 * selling until the network answered. The claim is verified in the background
 * instead; the rules are what decide the truth.
 */

const KEY = 'lib.shop.v1'

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

let shopId = read()

export function currentShopId(): string {
  return shopId
}

export function hasShop(): boolean {
  return shopId !== ''
}

export function setShopId(id: string): void {
  if (id === shopId) return
  shopId = id
  try {
    if (id === '') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, id)
  } catch {
    /* private mode — the value still holds for this session */
  }
}

/**
 * Forget which shop this browser is looking at — logout, and nothing else.
 *
 * This clears the id and only the id. Every row the shop's screens have already
 * read is still held twice over: in the shared live collection stores, which keep
 * their last snapshot on purpose so a route change is instant, and in Firestore's
 * IndexedDB cache. Clearing the id without emptying those is how the next account
 * to sign in on the same machine gets a frame of somebody else's stock, so the
 * caller pairs this with `resetLiveCollections()` from '@/lib/liveCollection' —
 * called AFTER this function, never before, because that reset re-arms whatever
 * is still mounted against the tenant as it stands at that moment.
 */
export function clearShopId(): void {
  setShopId('')
}

/**
 * The full path of one of the shop's collections.
 *
 * Throws rather than falling back to a root path. A silent fallback is the
 * failure this whole module exists to prevent: it would write one shop's sale
 * into the shared root, where the old permissive world used to live, and no
 * error would ever be raised. Every caller runs behind RequireAuth, which does
 * not render until a shop is known, so reaching this is a bug and should say so.
 *
 * There is exactly one caller that must never let this throw reach React, and it
 * is not fixed by softening this function. `createLiveCollection` builds its
 * query inside a subscription, so during the window between `clearShopId()` and
 * the redirect the throw came out of a render, and the app went to a blank page
 * instead of to the login screen. That is caught in `start()`
 * (liveCollection.ts), which publishes a "not subscribed" state and lets the
 * router do its job — a better outcome than the error boundary that now stands
 * over the tree, which would at least explain the crash but would still have
 * taken the screen away from a shop that is merely signing out. Anyone tempted to make this
 * return a fallback path instead should read the paragraph above again: a
 * shopPath() that answers with no shop selected is a shopPath() that can file one
 * shop's sale in another shop's books, silently, for as long as it takes somebody
 * to notice.
 */
export function shopPath(collectionName: string): string {
  if (shopId === '') {
    throw new Error(
      `shopPath("${collectionName}") called with no shop selected — ` +
        'a Firestore path was built before the account finished signing in.',
    )
  }
  return `shops/${shopId}/${collectionName}`
}
