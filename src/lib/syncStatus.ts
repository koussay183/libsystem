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
}

let state: SyncState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0,
  syncedAt: null,
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
  promise.then(done, done)
  return promise
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
