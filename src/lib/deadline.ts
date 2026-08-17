/**
 * A bound on how long the app will wait for Firestore to answer a READ.
 *
 * Writes never need this — they are applied to the local cache immediately and
 * replayed by the SDK, which is why nothing in this app awaits a write
 * acknowledgement. Reads are the other shape: `getDoc` and `getDocs` try the
 * server first and fall back to the cache only once the SDK has concluded there
 * is no line, and concluding that takes as long as the connection takes to fail.
 *
 * On the failure this shop actually has — a router that is up with a dead
 * uplink, or a captive portal, where navigator.onLine reports a healthy network
 * and packets simply vanish — that conclusion is roughly ten seconds away. Two
 * reads in sequence is twenty seconds of a button that does nothing, on a screen
 * where every write now returns instantly. The owner presses it again.
 *
 * Resolving to null on expiry rather than rejecting is deliberate: a deadline
 * being reached is not an error, it is an answer — "not from the server, ask the
 * cache" — and callers that must then produce something either read the cache
 * explicitly or fall back to a resident snapshot.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    const settle = (value: T | null) => {
      clearTimeout(timer)
      resolve(value)
    }
    promise.then(settle, () => settle(null))
  })
}

/**
 * The budget for one read on a user-facing path.
 *
 * Chosen against the two things it sits between: a slow-but-working shop line
 * finishes a single-document read well inside it, and a person waiting on a
 * button gives up somewhere around three seconds. It is deliberately much
 * shorter than the whole-export budget in backupService, because that one is
 * spending its time on nine collections behind a progress indicator the owner
 * has been told to expect.
 */
export const READ_DEADLINE_MS = 2500
