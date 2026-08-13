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
