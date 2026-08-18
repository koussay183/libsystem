import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot, QueryConstraint } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { withDeadline } from '@/lib/deadline'

/**
 * Reading the shared catalogue, in pages.
 *
 * ONE-SHOT QUERIES, NOT A LIVE SUBSCRIPTION, and that is the whole design
 * decision here. Everything else in this app hangs off onSnapshot, because the
 * shop's own stock changing under the owner's hands is the point. The catalogue
 * is the opposite: tens of thousands of documents that change when the operator
 * runs a command, browsed for a minute while somebody stocks a shelf. A listener
 * over it would bill the platform for every document on every reconnect, keep a
 * stream open on a till that has walked away, and answer a question nobody asked.
 *
 * The rules cap `list` at 120 documents per query — see the note in
 * firestore.rules — so PAGE_SIZE is not a nicety. A query without a limit at or
 * under the cap is refused before it reads anything.
 */
const PAGE_SIZE = 60

/** What one row of the catalogue browser knows. */
export interface CatalogItem {
  /** The document id: a GTIN, or `cnp-` + a six-digit CNP article number. */
  id: string
  /** The barcode to put on the product — the id without the cnp- namespace. */
  code: string
  name: string
  brand?: string
  category?: string
  unit?: string
  /** A state-priced school book. @see officialPrice */
  official?: boolean
  /**
   * The regulated public price, in millimes.
   *
   * The one price this catalogue carries, because a manuel scolaire costs the
   * same in every librairie in Tunisia by law — it is a fact about the book, not
   * a shop's commercial decision. Everything else here is identity only.
   */
  officialPrice?: number
  /** What the CNP charges a bookseller for it: 75 % of the public price. */
  officialCost?: number
  /** base1…base9, sec1…sec4, or absent when the title does not say. */
  level?: string
}

function toItem(d: QueryDocumentSnapshot<DocumentData>): CatalogItem {
  const v = d.data()
  const text = (x: unknown) => (typeof x === 'string' && x.trim() !== '' ? x.trim() : undefined)
  const money = (x: unknown) =>
    typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.round(x) : undefined
  return {
    id: d.id,
    // The cnp- prefix is an id namespace, not part of the barcode. It exists so a
    // six-digit national article number can never collide with a shop's own
    // numbering; the scanner still reads the six digits.
    code: d.id.startsWith('cnp-') ? d.id.slice(4) : d.id,
    name: typeof v.name === 'string' ? v.name : '',
    brand: text(v.brand),
    category: text(v.category),
    unit: text(v.unit),
    official: v.official === true,
    officialPrice: money(v.officialPrice),
    officialCost: money(v.officialCost),
    level: text(v.level),
  }
}

/**
 * Folded the same way `nameLower` is written by the CLI, because a prefix range
 * only matches if both ends agree on the folding. Kept deliberately identical to
 * foldName() in cli/lib.mjs — a drift between them is silent, and shows up only
 * as a search that finds nothing.
 */
export function foldSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export interface CatalogFilter {
  /** Prefix search over the folded name. */
  search: string
  /** Exact category, or '' for all. */
  category: string
  /** base1…sec4, or '' for all. Implies official books only. */
  level: string
  /** Only the state-priced school books. */
  officialOnly: boolean
}

/**
 * How long a catalogue query is allowed to take before it is called a failure.
 *
 * Generous compared with the 700 ms on a single barcode lookup, because this one
 * is a screen the owner has deliberately opened and is watching a spinner on —
 * and short enough that a dead uplink does not leave that spinner there for the
 * ten seconds Firestore takes to give up on its own.
 */
const QUERY_MS = 6000

export function useCatalog(filter: CatalogFilter) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)

  const build = useCallback(
    (after: QueryDocumentSnapshot<DocumentData> | null) => {
      const parts: QueryConstraint[] = []

      /*
        WHICH FILTERS MAY BE COMBINED IS DECIDED BY WHICH INDEXES EXIST.

        Each equality filter paired with an ordering on a different field needs a
        composite index (firestore.indexes.json). A missing one does not degrade
        gracefully: the query fails with failed-precondition, which this app
        treats as terminal. So the combinations here are exactly the three indexes
        that are deployed, and no more.

        A name search therefore stands alone. That is not a real loss — typing
        "francais" is already a narrower filter than any category — and it keeps
        this screen from needing an index per combination somebody might try.
      */
      const needle = foldSearch(filter.search)
      if (needle !== '') {
        parts.push(where('nameLower', '>=', needle))
        //  is the last character of the private-use area, so it sorts after
        // anything a book title contains: the pair is "starts with needle".
        parts.push(where('nameLower', '<=', `${needle}`))
      } else if (filter.level !== '') {
        parts.push(where('level', '==', filter.level))
      } else if (filter.officialOnly) {
        parts.push(where('official', '==', true))
      } else if (filter.category !== '') {
        parts.push(where('category', '==', filter.category))
      }

      parts.push(orderBy('nameLower'))
      if (after) parts.push(startAfter(after))
      parts.push(limit(PAGE_SIZE))
      return query(collection(db, 'catalog'), ...parts)
    },
    [filter.search, filter.category, filter.level, filter.officialOnly],
  )

  const run = useCallback(
    async (after: QueryDocumentSnapshot<DocumentData> | null) => {
      setLoading(true)
      setError(null)
      try {
        const snap = await withDeadline(getDocs(build(after)), QUERY_MS)
        // Null means the deadline ran out. Said plainly rather than shown as an
        // empty catalogue, which would read as "there is nothing in there".
        if (snap === null) {
          setError('offline')
          return
        }
        const page = snap.docs.map(toItem).filter((x) => x.name !== '')
        setItems((prev) => (after ? [...prev, ...page] : page))
        setCursor(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null)
        setDone(snap.docs.length < PAGE_SIZE)
      } catch (e) {
        // failed-precondition here almost always means a composite index has not
        // finished building, which is worth telling apart from being offline: one
        // fixes itself in minutes, the other when the line comes back.
        const code = (e as { code?: string } | null)?.code ?? ''
        setError(code === 'failed-precondition' ? 'index' : 'error')
      } finally {
        setLoading(false)
      }
    },
    [build],
  )

  // A filter change starts a new search from the top; the cursor goes with it.
  useEffect(() => {
    setItems([])
    setCursor(null)
    setDone(false)
    void run(null)
  }, [run])

  const more = useCallback(() => {
    if (loading || done || !cursor) return
    void run(cursor)
  }, [loading, done, cursor, run])

  const retry = useCallback(() => {
    void run(null)
  }, [run])

  return { items, loading, error, done, more, retry }
}
