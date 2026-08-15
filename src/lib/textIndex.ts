import type { Product } from '@/types/models'

/**
 * One folded, cached index of the product text, shared by every search in the
 * app.
 *
 * Searching used to lowercase four fields of every article on every keystroke.
 * On a shop with a few thousand articles that is tens of thousands of string
 * allocations per letter typed, and it is what made the stock search lag
 * behind the keyboard. Folding is done once per article and kept until that
 * article's text actually changes.
 */

/**
 * Strips what a tired cashier will not type: Latin accents, Arabic short
 * vowels and tatweel, and the alef/ya/ta-marbuta spellings that vary from one
 * supplier's label to the next.
 */
export function fold(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
}

/**
 * A code folded the way the index folds it. Both sides of every comparison go
 * through this, so a needle can never be folded differently from the haystack —
 * which is exactly how "Enter says no such article" used to happen for a row
 * visible on screen.
 */
export const foldCode = (value: unknown): string =>
  fold(String(value ?? '')).replace(/[\s-]/g, '')

/** The folded pieces of one article, plus the raw fields they came from. */
export interface FoldedProduct {
  name: string
  family: string
  code: string
  category: string
  /** Everything at once — what a plain "does it contain this?" search reads. */
  all: string

  // The raw values this was folded from. Compared field by field to decide
  // whether the entry is still good: four reference comparisons, against the
  // one concatenated string this used to build for every article every time.
  rawName: string
  rawFamily?: string
  rawVariant?: string
  rawBarcode?: string | null
  rawCategory?: string
}

/**
 * Keyed by document id rather than by object identity: Firestore rebuilds every
 * product object on every snapshot, and a sale is a snapshot, so an
 * identity-keyed cache would be empty again after every ticket.
 */
const cache = new Map<string, FoldedProduct>()

export function foldedOf(p: Product): FoldedProduct {
  const hit = cache.get(p.id)
  if (
    hit &&
    hit.rawName === p.name &&
    hit.rawFamily === p.family &&
    hit.rawVariant === p.variant &&
    hit.rawBarcode === p.barcode &&
    hit.rawCategory === p.category
  ) {
    return hit
  }

  const name = fold(p.name)
  const family = fold(`${p.family ?? ''} ${p.variant ?? ''}`)
  const code = foldCode(p.barcode)
  const category = fold(p.category ?? '')
  const value: FoldedProduct = {
    name,
    family,
    code,
    category,
    all: `${name} ${family} ${code} ${category}`,
    rawName: p.name,
    rawFamily: p.family,
    rawVariant: p.variant,
    rawBarcode: p.barcode,
    rawCategory: p.category,
  }
  cache.set(p.id, value)
  return value
}

/**
 * A deleted article would otherwise keep its entry for the life of the tab.
 * Called from the product subscription, which is the only place that knows the
 * full set still exists.
 */
export function pruneFoldCache(products: { id: string }[]) {
  // The common case costs one comparison: nothing was deleted, so the cache
  // cannot be holding more entries than there are articles.
  if (cache.size <= products.length) return
  const live = new Set(products.map((p) => p.id))
  for (const id of cache.keys()) if (!live.has(id)) cache.delete(id)
}

// ---------------------------------------------------------------------------
// Searching for several words at once
// ---------------------------------------------------------------------------

/** A typed search, taken apart once so it is not re-parsed per article. */
export interface Query {
  /** Every word that must be found somewhere. Empty means "match all". */
  tokens: string[]
  /** The whole term with separators stripped, for matching a barcode. */
  code: string
}

/**
 * Takes a search apart into the words it is really made of.
 *
 * Nobody types an article's name the way the label spells it. They type two
 * fragments they remember, in whatever order — "bic bleu", "bleu bic", "cah
 * 96" — and expect the article. Matching the whole string as one substring
 * finds none of those, which is what makes a search feel broken when the thing
 * being looked for is plainly in the list.
 */
export function buildQuery(term: string): Query {
  const folded = fold(term)
  return {
    tokens: folded.split(/\s+/).filter((w) => w !== ''),
    code: foldCode(term),
  }
}

/**
 * True when every word of the query is somewhere in this article, or when the
 * query reads as a code this article carries.
 *
 * The code is checked as a whole rather than word by word: a barcode typed
 * with the separators off a shelf label is one thing, not several.
 */
export function matchesQuery(p: Product, q: Query): boolean {
  if (q.tokens.length === 0) return true
  const f = foldedOf(p)
  if (q.code !== '' && f.code !== '' && f.code.includes(q.code)) return true
  for (const token of q.tokens) {
    if (!f.all.includes(token)) return false
  }
  return true
}
