import { fold, foldCode, foldedOf } from '@/lib/textIndex'
import type { Pack, Product, QuickService } from '@/types/models'

/**
 * The search behind the till's suggestion list.
 *
 * It only ever runs for something a human typed — a scan goes straight onto
 * the ticket — so it is tuned for half-remembered names rather than codes:
 * accents and Arabic diacritics are ignored, and an article whose name STARTS
 * with what was typed beats one that merely contains it.
 *
 * The folding itself lives in lib/textIndex, shared with the stock search, so
 * both agree on what "the same word" means and neither re-folds the whole shop
 * on every keystroke.
 */

export { fold }

/** Lower is better. Anything above this is not shown at all. */
const NO_MATCH = 99

function rank(p: Product, needle: string, needleCode: string): number {
  const f = foldedOf(p)
  if (needleCode !== '' && f.code === needleCode) return 0
  if (f.name.startsWith(needle)) return 1
  if (f.family.startsWith(needle)) return 2
  if (f.name.includes(needle)) return 3
  if (f.family.includes(needle)) return 4
  if (needleCode !== '' && f.code.includes(needleCode)) return 5
  return NO_MATCH
}

/**
 * Best matches first, at most `limit` of them.
 *
 * Ties are broken by how much of the article has sold: what the shop moves is
 * what the cashier is most likely reaching for. Products arrive ordered by
 * name and the sort is stable, so equal sellers stay alphabetical.
 */
export function searchProducts(products: Product[], term: string, limit = 8): Product[] {
  const needle = fold(term)
  if (needle.length < 2) return []
  const needleCode = foldCode(term)

  const scored: { p: Product; score: number }[] = []
  for (const p of products) {
    const score = rank(p, needle, needleCode)
    if (score !== NO_MATCH) scored.push({ p, score })
  }
  scored.sort((a, b) => a.score - b.score || (b.p.soldQty ?? 0) - (a.p.soldQty ?? 0))
  return scored.slice(0, limit).map((s) => s.p)
}

// ---------------------------------------------------------------------------
// Packs are searched alongside the articles
// ---------------------------------------------------------------------------

/**
 * What a code or a typed word can turn out to be.
 *
 * A pack carries a barcode of its own and a name of its own, so from the scan
 * field it is indistinguishable from an article until it resolves. Everything
 * downstream — the suggestion list, the "which one?" dialog, the ticket —
 * works on this union rather than on two parallel paths that can drift apart.
 */
export type ScanChoice =
  | { kind: 'product'; product: Product }
  | { kind: 'pack'; pack: Pack }
  | { kind: 'service'; service: QuickService }

export function choiceId(c: ScanChoice): string {
  if (c.kind === 'pack') return `pack:${c.pack.id}`
  if (c.kind === 'service') return `service:${c.service.id}`
  return `product:${c.product.id}`
}

export function choiceName(c: ScanChoice): string {
  if (c.kind === 'pack') return c.pack.name
  if (c.kind === 'service') return c.service.name
  return c.product.name
}

/**
 * What the row shows as a price. A service has none until the job is done, so
 * its suggested price stands in — and null is what tells the UI to say so
 * rather than print a confident 0.000.
 */
export function choicePrice(c: ScanChoice): number | null {
  if (c.kind === 'pack') return c.pack.price
  // `|| null`, not `?? null`: a stored 0 is not a price the till should
  // print next to the service as though it were the charge.
  if (c.kind === 'service') return c.service.defaultPrice || null
  return c.product.salePrice
}

export function choiceCode(c: ScanChoice): string | null | undefined {
  if (c.kind === 'pack') return c.pack.barcode
  if (c.kind === 'service') return c.service.code
  return c.product.barcode
}

function rankService(service: QuickService, needle: string, needleCode: string): number {
  const code = foldCode(service.code)
  if (needleCode !== '' && code !== '' && code === needleCode) return 0
  const name = fold(service.name)
  if (name.startsWith(needle)) return 1
  if (name.includes(needle)) return 3
  if (needleCode !== '' && code !== '' && code.includes(needleCode)) return 5
  return NO_MATCH
}

function rankPack(pack: Pack, needle: string, needleCode: string): number {
  const code = foldCode(pack.barcode)
  if (needleCode !== '' && code !== '' && code === needleCode) return 0
  const name = fold(pack.name)
  if (name.startsWith(needle)) return 1
  if (name.includes(needle)) return 3
  if (needleCode !== '' && code !== '' && code.includes(needleCode)) return 5
  return NO_MATCH
}

/**
 * The suggestion list: services, packs and articles together.
 *
 * At equal relevance the things the owner defined by hand come first — a
 * service or a pack exists because he made it, and the articles inside a pack
 * are one row further down anyway.
 */
export function searchChoices(
  products: Product[],
  packs: Pack[],
  services: QuickService[],
  term: string,
  limit = 8,
): ScanChoice[] {
  const needle = fold(term)
  if (needle.length < 2) return []
  const needleCode = foldCode(term)

  const scored: { choice: ScanChoice; score: number; sold: number }[] = []
  for (const service of services) {
    const score = rankService(service, needle, needleCode)
    if (score !== NO_MATCH) {
      scored.push({
        choice: { kind: 'service', service },
        score,
        sold: Number.MAX_SAFE_INTEGER,
      })
    }
  }
  for (const pack of packs) {
    const score = rankPack(pack, needle, needleCode)
    if (score !== NO_MATCH) {
      scored.push({ choice: { kind: 'pack', pack }, score, sold: Number.MAX_SAFE_INTEGER })
    }
  }
  for (const product of products) {
    const score = rank(product, needle, needleCode)
    if (score !== NO_MATCH) {
      scored.push({
        choice: { kind: 'product', product },
        score,
        sold: product.soldQty ?? 0,
      })
    }
  }
  scored.sort((a, b) => a.score - b.score || b.sold - a.sold)
  return scored.slice(0, limit).map((x) => x.choice)
}
