/**
 * How the whole app compares barcodes.
 *
 * Two articles may legitimately carry the same printed code, so matching has
 * to be consistent everywhere: if the till thinks two codes are the same and
 * the stock form thinks they differ, the owner is warned about the wrong
 * things and the purchase flow restocks the wrong article.
 */

/**
 * A barcode as text, trimmed. Coerced through String() because a code
 * restored from a JSON backup can come back as a number, and a number never
 * matches the scanned text.
 */
export const codeOf = (value: unknown): string => String(value ?? '').trim()

/**
 * The same code without the separators catalogues print inside ISBNs. A shelf
 * label reading 978-2-07-036822-8 has to match the 9782070368228 the scanner
 * reads off the very same book.
 */
export const loose = (code: string): string => code.replace(/[\s-]/g, '')

/** True when two codes are the same article as far as this shop is concerned. */
export function sameCode(a: unknown, b: unknown): boolean {
  const left = loose(codeOf(a))
  return left !== '' && left === loose(codeOf(b))
}

/**
 * Codes carried by more than one product. The stock list uses it to mark the
 * pairs, so a deliberate duplicate can be told from last month's typo.
 */
export function sharedCodes(products: { barcode?: string | null }[]): Set<string> {
  const seen = new Map<string, number>()
  for (const p of products) {
    const key = loose(codeOf(p.barcode))
    if (key === '') continue
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const shared = new Set<string>()
  for (const [key, count] of seen) if (count > 1) shared.add(key)
  return shared
}

/**
 * Does this look like a scanned code rather than words the owner typed?
 * Used to decide whether an unknown search term should pre-fill the barcode
 * field or the name field — filling the wrong one poisons the till's index.
 */
export function looksLikeCode(term: string): boolean {
  return /^[0-9][0-9\s-]{3,}$/.test(term.trim())
}

/**
 * A 13-digit code the shop can print on a pack it made up itself.
 *
 * The leading 2 is the GS1 range reserved for in-store use, so a generated
 * code can never collide with a manufacturer's barcode on a real product. The
 * caller passes every code already in use and gets one that is not among them.
 */
export function generateInStoreCode(taken: Iterable<unknown>): string {
  const used = new Set<string>()
  for (const value of taken) {
    const key = loose(codeOf(value))
    if (key !== '') used.add(key)
  }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '2'
    for (let i = 0; i < 12; i += 1) code += Math.floor(Math.random() * 10)
    if (!used.has(code)) return code
  }
  // 50 collisions against a shop's worth of codes is not a real outcome; the
  // fallback simply never returns nothing.
  return `2${Date.now()}`.slice(0, 13)
}

/**
 * The id a barcode gets in the SHARED catalogue, or null when it may not have
 * one.
 *
 * Deliberately far stricter than {@link looksLikeCode}, for three separate
 * reasons, each of which has already bitten something:
 *
 *  - It becomes a Firestore document id. An empty string, a '/', a '.' or a
 *    name like "cahier 100p/24x32" makes doc() throw synchronously — and the
 *    call sites that would use this sit on the scan path, where a throw takes
 *    the whole till down with no error boundary to catch it.
 *  - Codes minted by {@link generateInStoreCode} start with 2 and are checked
 *    for collisions against ONE shop's codes only, so by construction two
 *    shops mint the same one. They must never enter a shared namespace.
 *  - Case: Firestore ids are byte-exact, and an ISBN-10 check digit is
 *    literally the letter X. Numeric-only sidesteps the question entirely.
 *
 * 8 to 14 digits covers EAN-8, UPC-A, EAN-13 and ITF-14, which is every code
 * a real supplier prints.
 */
export function catalogKey(value: unknown): string | null {
  const key = loose(codeOf(value))
  if (cnpKey(key) !== null) return cnpKey(key)
  return gtinKey(key)
}

/**
 * The id for a real manufacturer's barcode: 8 to 14 digits, never one from the
 * in-store range.
 *
 * This is the only shape a SHOP may contribute, and the restriction is the whole
 * reason the two functions are separate — see {@link cnpKey}.
 *
 * WHY THE IN-STORE TEST IS NOT SIMPLY /^2[0-9]{12}$/, WHICH IS WHAT IT WAS.
 * GS1 reserves the prefix 2 for restricted circulation: codes a shop prints for
 * itself, checked for collisions against ITS OWN stock only, so two shops mint
 * the same one by construction. The old test recognised that at exactly thirteen
 * digits, which is what generateInStoreCode() below happens to produce — so it
 * caught this app's own codes and nothing else. Another till printing a
 * 2-prefixed EAN-8 or UPC-A would have walked straight into the shared
 * namespace and started overwriting a real book.
 *
 * The one length where a leading 2 is innocent is 14: an ITF-14 carton code is a
 * packaging indicator digit followed by a GTIN-13, and that indicator is
 * allowed to be 2 while the code inside it is an ordinary product. So 14-digit
 * codes are judged on the GTIN they carry, not on their first digit.
 *
 * Deciding this now rather than later is deliberate: widening it after the first
 * seed would leave entries stranded under ids nothing would look up again.
 */
function gtinKey(key: string): string | null {
  if (!/^[0-9]{8,14}$/.test(key)) return null
  // EAN-8, UPC-A and EAN-13: a leading 2 means in-store, so it is not shareable.
  if (key.length !== 14 && key.startsWith('2')) return null
  // ITF-14: strip the packaging indicator and judge the GTIN-13 underneath.
  if (key.length === 14 && key.slice(1).startsWith('2')) return null
  return key
}

/**
 * Tunisian school-book codes — the CNP article number printed on every
 * "manuel scolaire" — under an id namespace of their own.
 *
 * These are six digits, so they cannot be a GTIN and cannot go through
 * {@link gtinKey}. They earn their place anyway: they are nationally
 * standardised, every bookshop in the country sells the same titles under the
 * same numbers, and they are the single most valuable thing a new shop can be
 * handed on its first day. In the shop this was built for, all 52 six-digit
 * codes are Manuels scolaires and not one of them is anything else.
 *
 * The `cnp-` prefix keeps them out of the GTIN space, because six digits are
 * short enough that a shop could plausibly have minted its own — and a shop's
 * private numbering must never be able to answer for a national one.
 *
 * NO SHOP MAY CONTRIBUTE ONE. Contributions go through {@link gtinKey}, so this
 * namespace is written only by the back office, from a list somebody has
 * actually checked. That asymmetry is the point: a national standard should be
 * curated, and it is the one part of the catalogue where a wrong name would be
 * wrong for everybody at once.
 */
function cnpKey(key: string): string | null {
  return /^[0-9]{6}$/.test(key) ? `cnp-${key}` : null
}

/**
 * The id this shop is allowed to PUBLISH for a code, or null.
 *
 * Deliberately narrower than {@link catalogKey}, which is what a shop may look
 * UP. Reading a curated CNP entry is a gift; writing one is not a shop's to do.
 */
export function contributableKey(value: unknown): string | null {
  return gtinKey(loose(codeOf(value)))
}
