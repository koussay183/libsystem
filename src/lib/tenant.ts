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
