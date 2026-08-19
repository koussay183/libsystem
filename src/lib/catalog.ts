import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { shopPath } from './tenant'
import { catalogKey, contributableKey, loose } from '@/features/stock/barcode'
import { contributableName, MAX_NAME } from './catalogName'
import { track } from './syncStatus'
import { withDeadline } from './deadline'

/**
 * The shared barcode catalogue: what an EAN is called, according to everybody.
 *
 * WHY IT EXISTS. Every bookshop that installs this spends its first week doing
 * the same work the last one did — standing at a shelf with a scanner, typing
 * "Le Petit Prince" against 9782070408504 for the four hundredth time in the
 * country. The codes are the same everywhere because the publishers print them;
 * only the prices differ. So the names are worth pooling and the prices are not.
 *
 * WHY THERE IS NO PRICE IN HERE, AND NEVER WILL BE. Each shop sets its own, and
 * it is not squeamishness: the receiving shop derives its selling price from ITS
 * OWN margin on the cost IT paid, and the till defaults an unknown cost to zero.
 * A borrowed sale price with no cost behind it would mint a 100 %-margin phantom
 * into that shop's profitability report — an article that appears to be its most
 * lucrative line precisely because nobody knows what it cost. Name and unit,
 * nothing else. Category is excluded for a duller reason: it is free text
 * pointing into the contributing shop's own list, and means nothing outside it.
 *
 * HOW ISOLATION SURVIVES A SHARED COLLECTION. /catalog is the only path in this
 * system outside shops/{shopId}/…, and clients CANNOT WRITE TO IT AT ALL. The
 * rules grant `get` and nothing else — not even `list`, because list would let
 * one account walk the whole catalogue, and a competitor's stock list is not on
 * offer here.
 *
 * A shop contributes by writing into its OWN subtree, at
 * shops/{shopId}/catalog_contributions/{code}, which the existing tenant rules
 * already cover; the back office promotes those into /catalog with
 * `catalog:harvest`. That indirection is what buys the whole feature for free,
 * security-wise: there is no client-writable root collection, so there is
 * nothing to flood, nothing to poison, and no new attack surface to reason
 * about. It costs immediacy — a name one shop enters today reaches another after
 * a harvest, not instantly — and immediacy was never the point. The names being
 * there at all is.
 */

/**
 * What the catalogue knows about a code — the PRODUCT MASTER.
 *
 * The split this whole module rests on: identity is global, commerce is local.
 *
 *   global   name, brand, category, unit — what the article IS
 *   local    purchase price, sale price, margin, stock, supplier — what it is
 *            worth in THIS shop
 *
 * A shop scanning a BIC it has never stocked should be told it is a BIC. What it
 * paid for it, and what it sells it for, is nobody else's business and would be
 * actively harmful to borrow — see the note above on the 100 %-margin phantom.
 */
export interface CatalogEntry {
  name: string
  unit?: string
  /** BIC, Maped, Clairefontaine… display only, not stored on the product yet. */
  brand?: string
  /**
   * A suggestion, not a fact. Categories are each shop's own vocabulary, so this
   * is offered into the form where the owner can accept or change it, and it
   * creates the category locally if he keeps it.
   */
  category?: string
}

/**
 * Look up one code. Null for "no answer", whatever the reason.
 *
 * THIS MUST NEVER BE PUT ON THE SCAN PATH, and the reason is in the shape of the
 * caller, not of this function: `lookup()` at the till receives raw typed text
 * and pasted strings dozens of times a minute, and an article the shop already
 * stocks needs no catalogue at all. It belongs on "create this product", which
 * is a deliberate act, once per unknown article.
 *
 * Every failure is the same answer — null — and that is deliberate too. Offline,
 * refused, not found, malformed, a plan that lapsed: none of them is worth a
 * word to a shopkeeper who is halfway through creating a product. He types the
 * name himself, which is exactly what he did before this existed. The one
 * outcome that would be unacceptable is this function making him wait, so it is
 * bounded by a deadline and it swallows everything.
 */
export async function lookupCatalog(code: unknown): Promise<CatalogEntry | null> {
  const key = catalogKey(code)
  // Not a shareable code — an in-store 2… prefix, a name typed into the barcode
  // field, or an empty string. The empty string matters more than it looks:
  // doc(db, 'catalog', '') THROWS SYNCHRONOUSLY, and this is called from a
  // dialog on the till.
  if (key === null) return null

  try {
    const snap = await withDeadline(getDoc(doc(db, 'catalog', key)), LOOKUP_MS)
    if (!snap || !snap.exists()) return null
    const data = snap.data() as Record<string, unknown>
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    if (name === '' || name.length > MAX_NAME) return null
    // Every optional field is mapped to undefined rather than passed through,
    // because the CLI writes `unit: p.unit ?? null` and firebase.ts drops
    // undefined, not null — a null reaching ProductInput writes a null onto the
    // product, which is not the same as leaving the field alone.
    const text = (v: unknown) =>
      typeof v === 'string' && v.trim() !== '' && v.length <= MAX_NAME ? v.trim() : undefined
    return {
      name,
      unit: text(data.unit),
      brand: text(data.brand),
      category: text(data.category),
    }
  } catch {
    // Including the synchronous throws: an offline getDoc on a document the
    // cache has never seen rejects rather than resolving empty.
    return null
  }
}

/**
 * Shorter than READ_DEADLINE_MS, because this one is optional.
 *
 * A prefill that arrives after the owner has started typing the name is worse
 * than no prefill — it either fights him for the field or arrives too late to
 * save him anything. Two thirds of a second is enough for a shop line that
 * works and short enough to be invisible when it does not.
 */
const LOOKUP_MS = 700

/**
 * Offer this shop's name for a code to the catalogue, for a later harvest.
 *
 * Fire-and-forget into the shop's own subtree, so it queues offline like every
 * other write and needs no network at the moment of creation. Nothing is
 * promised to the owner and nothing is shown to him: from where he stands he has
 * created a product, which is all he asked to do.
 *
 * `by` is not written. The harvest knows which shop a contribution came from
 * from the path it read it out of, and writing the shop id into a document that
 * may one day be promoted into a shared collection is how a shop's identity ends
 * up somewhere a shop can read it.
 */
export function contributeToCatalog(
  code: unknown,
  name: string,
  unit?: string,
  category?: string,
): void {
  const key = contributableKey(code)
  if (key === null) return

  /*
    TWO GATES, NOT ONE, AND THIS IS THE SECOND.

    `contributableKey` above decided the code is a real manufacturer's barcode.
    This decides the name is a real name — until it existed, any string of one
    to eighty characters was offered to the catalogue as the definitive name of
    a code every bookshop in the country scans, so "test", "aaa", "sans nom" and
    a phone number typed into the wrong field all went in. Rejecting withholds
    nothing from this shop: the product is created with exactly that name on its
    own shelf. See lib/catalogName.ts for why that asymmetry lets it be strict.
  */
  const clean = contributableName(name)
  if (clean === null) return
  // A name that is just the barcode again teaches the catalogue nothing, and it
  // is a real thing that gets typed — bug 5.2 was the till doing it by itself.
  if (loose(clean) === key) return

  try {
    void track(
      setDoc(doc(db, shopPath('catalog_contributions'), key), {
        name: clean,
        ...(unit && unit.trim() !== '' ? { unit: unit.trim() } : {}),
        ...(category && category.trim() !== '' ? { category: category.trim() } : {}),
        at: serverTimestamp(),
      }),
    ).catch(() => {
      /* replayed by the SDK; a refusal surfaces through the sync badge */
    })
  } catch {
    // shopPath() throws with no shop selected. Contributing is the least
    // important thing happening on this screen and must never be what breaks it.
  }
}
