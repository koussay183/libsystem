import { waitForPendingWrites } from 'firebase/firestore'
import { db } from './firebase'

/**
 * "Is my work saved?" — answered in one place.
 *
 * Firestore already does the hard part: with the IndexedDB cache on, a write
 * made with the line down is durable on this machine and is replayed by the
 * SDK, in order, as soon as the connection returns. Nothing here re-implements
 * that, and nothing here should — a hand-rolled localStorage queue would have
 * to redo transactions, ordering and retry, and would get them wrong.
 *
 * What was missing is that the owner could not SEE any of it. This module is
 * only the reporting layer: whether the machine has a line, how many of his
 * own writes are still in flight, and when everything last landed.
 */

export interface SyncState {
  online: boolean
  /** Writes this app started that have not been acknowledged yet. */
  pending: number
  /** When the queue was last known to be completely empty. */
  syncedAt: number | null
  /**
   * A write came back refused rather than merely delayed.
   *
   * Offline writes are normal here and are not errors. This is the other
   * thing: the server said no — the plan lapsed, or the account no longer
   * owns this shop — and Firestore's answer is to roll the change back
   * locally. Without this flag that rollback is completely silent: the article
   * appears, then disappears, and nothing on screen explains why.
   */
  denied: boolean
}

let state: SyncState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0,
  syncedAt: null,
  denied: false,
}

const watchers = new Set<() => void>()

function publish(next: Partial<SyncState>) {
  state = { ...state, ...next }
  for (const notify of watchers) notify()
}

/**
 * Confirms with Firestore itself that nothing is left over. Resolves only once
 * every queued write has been acknowledged by the server, so it is the honest
 * answer to "is it all up there?" — including writes made in another tab.
 */
function confirmDrained() {
  waitForPendingWrites(db)
    .then(() => {
      if (state.pending === 0) publish({ syncedAt: Date.now() })
    })
    .catch(() => {
      /* the network went again — the next reconnect asks once more */
    })
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    publish({ online: true })
    confirmDrained()
  })
  window.addEventListener('offline', () => publish({ online: false }))
}

/**
 * Counts a write while it is in flight. The promise is returned untouched, so
 * callers can keep awaiting exactly what they awaited before.
 */
export function track<T>(promise: Promise<T>): Promise<T> {
  publish({ pending: state.pending + 1 })
  const done = () => {
    const pending = Math.max(0, state.pending - 1)
    publish({ pending, syncedAt: pending === 0 ? Date.now() : state.syncedAt })
  }
  promise.then(done, (err: unknown) => {
    done()
    const code = (err as { code?: string } | null)?.code
    if (code === 'permission-denied' || code === 'unauthenticated') {
      publish({ denied: true })
    }
  })
  // Returned untouched on purpose: every caller keeps awaiting exactly what it
  // awaited before, and the ones that deliberately ignore rejection still do.
  return promise
}

/** Called once the owner has been told. */
export function clearDenied() {
  if (state.denied) publish({ denied: false })
}

export const syncStore = {
  subscribe(onChange: () => void) {
    watchers.add(onChange)
    return () => {
      watchers.delete(onChange)
    }
  },
  getSnapshot: () => state,
}
