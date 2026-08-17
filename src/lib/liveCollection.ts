import { onSnapshot } from 'firebase/firestore'
import type { DocumentData, Query } from 'firebase/firestore'

/**
 * One shared live subscription per collection, instead of one per component.
 *
 * Every screen used to open its own `onSnapshot`: the stock page and the two
 * dialogs on top of it each listened to `products`, and walking from the till
 * to the stock and back tore the listener down and built it up again — a blank
 * table and a fresh round trip every single time. On a shop connection that is
 * the difference between "the app is slow" and "the app is instant".
 *
 * The store keeps the last snapshot after the last component leaves, so coming
 * back renders immediately from what is already known, and holds the listener
 * open for a short grace period so a route change costs nothing at all.
 */

export interface LiveState<T> {
  data: T[]
  loading: boolean
  error: string | null
  /**
   * The listener has given up and will not come back on its own.
   *
   * The difference matters: a flaky line is worth retrying behind the scenes,
   * but being refused by the security rules is not, and a screen that keeps
   * showing the last known stock behind an invisible retry loop is a screen
   * selling against numbers it can no longer confirm.
   */
  fatal: boolean
}

/**
 * How long the listener stays open with nobody watching. Long enough to cover
 * navigating away and back, short enough that a forgotten tab is not billed
 * for a listener all afternoon.
 */
const KEEP_ALIVE_MS = 30_000

/** First retry delay after a listener dies; doubles up to {@link MAX_RETRY_MS}. */
const RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

/**
 * Errors no amount of waiting will fix. Retrying these used to re-open the
 * listener every thirty seconds for as long as the till stayed open — and once
 * the database has real security rules, being refused stops being exceptional,
 * so an undiscriminating retry becomes a permanent background cost.
 */
const TERMINAL = new Set([
  'permission-denied',
  'unauthenticated',
  'failed-precondition',
  'resource-exhausted',
  'invalid-argument',
  'not-found',
])

/**
 * Even a transient fault gets a bounded number of tries. A listener that has
 * failed five times in one session is not going to be fixed by a sixth
 * download of the whole collection.
 */
const MAX_ATTEMPTS = 5

export interface LiveCollection<T> {
  subscribe: (onChange: () => void) => () => void
  getSnapshot: () => LiveState<T>
}

/**
 * `makeQuery` is called lazily, on the first subscription — never at module
 * load, so importing a hook does not start a Firestore listener before the
 * owner has even logged in.
 */
export function createLiveCollection<T extends { id: string }>(
  makeQuery: () => Query<DocumentData>,
): LiveCollection<T> {
  let state: LiveState<T> = { data: [], loading: true, error: null, fatal: false }
  const watchers = new Set<() => void>()
  let unsub: (() => void) | null = null
  let refs = 0
  let idle: ReturnType<typeof setTimeout> | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let retryIn = RETRY_MS
  let attempts = 0

  const publish = (next: LiveState<T>) => {
    state = next
    for (const notify of watchers) notify()
  }

  const start = () => {
    if (unsub) return
    if (retry !== null) {
      clearTimeout(retry)
      retry = null
    }
    unsub = onSnapshot(
      makeQuery(),
      (snap) => {
        retryIn = RETRY_MS
        attempts = 0
        publish({
          data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T),
          loading: false,
          error: null,
          fatal: false,
        })
      },
      (err) => {
        // Firestore never revives a listener that failed, and this one is
        // shared: leaving it dead would freeze the stock on every screen at
        // once, with the till still happily selling against a stale count.
        unsub = null
        const code = (err as { code?: string }).code ?? ''
        attempts += 1
        const giveUp = TERMINAL.has(code) || attempts >= MAX_ATTEMPTS

        publish({
          data: state.data,
          loading: false,
          error: err.message,
          // Said out loud rather than hidden behind a retry: the caller can
          // tell the owner to sign in again instead of quietly showing him
          // this morning's stock all afternoon.
          fatal: giveUp,
        })
        if (giveUp || refs === 0) return

        retry = setTimeout(() => {
          retry = null
          retryIn = Math.min(retryIn * 2, MAX_RETRY_MS)
          if (refs > 0) start()
        }, retryIn)
      },
    )
  }

  const subscribe = (onChange: () => void) => {
    watchers.add(onChange)
    refs += 1
    if (idle !== null) {
      clearTimeout(idle)
      idle = null
    }
    start()
    return () => {
      watchers.delete(onChange)
      refs -= 1
      if (refs > 0) return
      idle = setTimeout(() => {
        idle = null
        if (refs > 0) return
        if (retry !== null) {
          clearTimeout(retry)
          retry = null
        }
        if (unsub) {
          unsub()
          unsub = null
        }
      }, KEEP_ALIVE_MS)
    }
  }

  return { subscribe, getSnapshot: () => state }
}
