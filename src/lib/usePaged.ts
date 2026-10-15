import { useMemo, useState } from 'react'
import { readSession, writeSession } from './useSessionState'

/** Rows on one page of a long list, everywhere in the app. */
export const PAGE_SIZE = 25

/**
 * One page of a list.
 *
 * `resetKey` is whatever the list is filtered by, folded into a string. When it
 * changes the page goes back to 1 IN THE SAME RENDER: an effect would first
 * draw page 7 of the new, shorter result — usually an empty page — and only
 * then correct itself, which reads as "nothing matched" for a frame.
 *
 * The page is also clamped to the last one that exists, so deleting the only
 * row on the last page lands on the page before it instead of on a blank one.
 *
 * `total` is for a list that is only partly in memory (the sales history reads
 * the server a window at a time): the pages are counted from what the server
 * says exists, and a page past what is loaded comes back short. The caller
 * notices that and loads further.
 */
export function usePaged<T>(
  items: readonly T[],
  resetKey: string,
  opts: {
    total?: number | null
    pageSize?: number
    /**
     * Remembers the page for this tab under this name, so coming back to the
     * list lands where the owner left it — as long as the filters are the
     * same ones (the stored page belongs to its resetKey).
     */
    persist?: string
  } = {},
) {
  const pageSize = opts.pageSize ?? PAGE_SIZE
  const persist = opts.persist
  const [state, setState] = useState(() => {
    if (persist) {
      const saved = readSession(`page.${persist}`, { key: '', page: 1 })
      if (saved.key === resetKey && typeof saved.page === 'number') return saved
    }
    return { key: resetKey, page: 1 }
  })
  const total = Math.max(items.length, opts.total ?? 0)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const wanted = state.key === resetKey ? state.page : 1
  const page = Math.min(Math.max(1, wanted), pageCount)
  const start = (page - 1) * pageSize
  // Same array between renders while the page is the same, so a memoized list
  // underneath can skip redrawing its rows on every keystroke above it.
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize])

  return {
    page,
    pageCount,
    pageSize,
    total,
    /** First row index the page needs, and one past the last. */
    start,
    end: Math.min(start + pageSize, total),
    pageItems,
    setPage: (next: number) => {
      setState({ key: resetKey, page: next })
      if (persist) writeSession(`page.${persist}`, { key: resetKey, page: next })
    },
  }
}
