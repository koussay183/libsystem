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
 *
 * That retained snapshot is one shop's rows living in a module-level closure for
 * as long as the tab is open, which makes {@link resetLiveCollections} part of
 * the isolation story rather than a convenience: whoever changes which shop this
 * browser is looking at has to empty these stores in the same breath.
 */

/**
 * Why a listener stopped for good.
 *
 * These five want five different sentences from the UI, so the state carries
 * the reason instead of leaving the caller to guess it from an error string:
 *
 *   · `refused`   — the rules said no (permission-denied, unauthenticated). The
 *                   plan lapsed or the session was revoked; only signing in
 *                   again helps, and until then the numbers on screen are the
 *                   last ones the server was willing to confirm.
 *   · `exhausted` — resource-exhausted: the project's daily quota is gone. This
 *                   is not this shop's fault and nothing on this machine fixes
 *                   it — every shop on the platform is frozen at the same time,
 *                   and a reload does not help either.
 *   · `broken`    — the query itself can never succeed: a missing composite
 *                   index (failed-precondition), a malformed query
 *                   (invalid-argument), or no database at that name
 *                   (not-found). A deploy fixes those; waiting does not.
 *   · `retries`   — MAX_ATTEMPTS ordinary failures in a row. Nobody refused us,
 *                   the line is simply too poor to hold a stream open, so this
 *                   is the one reason where pressing "try again" is likely to
 *                   work on its own.
 *   · `no-shop`   — the query could not even be built, because `shopPath()`
 *                   (tenant.ts:93-99) had no tenant to build it from. The
 *                   account is signed out or between shops and a redirect is
 *                   already on its way, so this is the one reason that must NOT
 *                   raise an alarm about frozen data: there is no data, and
 *                   nothing was sold against anything.
 */
export type LiveFatalReason = 'refused' | 'exhausted' | 'broken' | 'retries' | 'no-shop'

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
   *
   * Whoever consumes this must also offer {@link LiveCollection.retry}: with the
   * line down a page reload is the one action that can cost the shop the app
   * entirely, so "give up until the owner reloads" is not an acceptable end
   * state.
   */
  fatal: boolean
  /**
   * Which kind of giving-up it was, or null whenever `fatal` is false. Read it
   * rather than `error`: the message comes from the SDK, is English, and
   * changes between versions.
   */
  fatalReason: LiveFatalReason | null
  /**
   * The Firestore error code behind `error`, when there was one — kept because
   * `refused` covers both a lapsed plan (permission-denied) and a revoked
   * session (unauthenticated), and a log line is worth more with the code in it.
   */
  code: string | null
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
 *
 * WHAT MUST NEVER BE ADDED HERE: `unavailable`. That is the code the SDK reports
 * when it cannot reach Firestore at all, which in this shop is an ordinary
 * afternoon — the line goes for hours. It is the one failure the cache exists to
 * absorb: the documents on screen are current, the queue is durable, and the
 * listener has to come back by itself when the line does. Calling it terminal
 * would stop that reconnect and, now that `fatal` reaches the screen, would put
 * a "your stock can no longer be confirmed" warning in front of a shop that is
 * merely offline — a worse and far more frequent bug than the frozen snapshot
 * this flag was written to catch. The same reasoning keeps out `cancelled`,
 * `deadline-exceeded`, `aborted`, `internal` and `unknown`: every one of them
 * means "try again", and MAX_ATTEMPTS already bounds how often we do.
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
 * The word the UI needs for a code that is already known to be terminal. Only
 * ever called behind `TERMINAL.has(code)`, which is why the fall-through is
 * `broken` rather than a guess: what is left in the set is failed-precondition,
 * invalid-argument and not-found, and all three mean the query is wrong rather
 * than the shop.
 */
function reasonFor(code: string): LiveFatalReason {
  if (code === 'permission-denied' || code === 'unauthenticated') return 'refused'
  if (code === 'resource-exhausted') return 'exhausted'
  return 'broken'
}

/**
 * Even a transient fault gets a bounded number of tries. A listener that has
 * failed five times in one session is not going to be fixed by a sixth
 * download of the whole collection.
 */
const MAX_ATTEMPTS = 5

export interface LiveCollection<T> {
  subscribe: (onChange: () => void) => () => void
  getSnapshot: () => LiveState<T>
  /**
   * Re-arm a listener that gave up, and forgive its attempt count.
   *
   * The owner pressing a button is the only thing that can revive a `fatal`
   * store short of a page reload, and offline a reload is the one action that
   * can lose him the app entirely (the service worker may be missing a chunk,
   * and a hard reload bypasses it altogether). Cheap and idempotent: a no-op
   * while the listener is alive, and safe with nothing mounted — it clears the
   * give-up so the next mount arms a fresh listener instead of inheriting a
   * dead one. Stable reference, so a hook may return it straight to a component
   * and a component may put it in a dependency array.
   */
  retry: () => void
}

/**
 * Every store this module has built, so that one call can empty all of them.
 *
 * The stores are module-level and deliberately keep their last snapshot after
 * the final unsubscribe, which is what makes coming back to a screen instant —
 * and which also means one shop's products sit in a closure for as long as the
 * tab lives. Today the shop-change branch in AuthContext reloads the page, so
 * that is moot; it is one removed reload away from serving shop A's stock to
 * shop B. Isolation in this app is a property of the structure rather than of
 * whoever remembers, so the wipe lives here, next to the cache it has to clear.
 */
const stores = new Set<{ reset: () => void; retry: () => void }>()

/**
 * Forget everything every live collection knows and drop its listener.
 *
 * Call this whenever the identity of the current shop changes: on logout, and on
 * the different-shop branch. It is safe with components still mounted — each
 * store goes back to empty-and-loading, its watchers are notified, and any store
 * somebody is still watching immediately arms a listener for whatever shop is
 * selected NOW. If none is, because logout has already called `clearShopId()`,
 * that attempt lands in the `no-shop` branch of `start()` and publishes a "not
 * subscribed" state instead of throwing through a React render.
 *
 * ORDER MATTERS: call it AFTER `setShopId(next)` or `clearShopId()`, never
 * before. The re-arm reads the tenant as it stands at that moment, so calling it
 * first re-attaches a listener to the shop that is being left behind.
 */
export function resetLiveCollections(): void {
  for (const store of stores) store.reset()
}

/**
 * Re-arm every collection that gave up. This is what a single "try again" in the
 * shell is for: a lapsed plan, a revoked session and a blown quota all kill the
 * five listeners together, so recovering them one screen at a time would be
 * five trips through the app.
 */
export function retryLiveCollections(): void {
  for (const store of stores) store.retry()
}

/**
 * `makeQuery` is called lazily, on the first subscription — never at module
 * load, so importing a hook does not start a Firestore listener before the
 * owner has even logged in.
 */
export function createLiveCollection<T extends { id: string }>(
  makeQuery: () => Query<DocumentData>,
): LiveCollection<T> {
  /** Knows nothing yet and is about to find out: the state a fresh store is in. */
  const blank = (): LiveState<T> => ({
    data: [],
    loading: true,
    error: null,
    fatal: false,
    fatalReason: null,
    code: null,
  })

  let state: LiveState<T> = blank()
  const watchers = new Set<() => void>()
  let unsub: (() => void) | null = null
  let refs = 0
  let idle: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryIn = RETRY_MS
  let attempts = 0

  const publish = (next: LiveState<T>) => {
    state = next
    for (const notify of watchers) notify()
  }

  const clearRetry = () => {
    if (retryTimer === null) return
    clearTimeout(retryTimer)
    retryTimer = null
  }

  const start = () => {
    if (unsub) return
    clearRetry()

    /**
     * The query is built inside a try because `shopPath()` throws when no shop
     * is selected (tenant.ts:93-99) — correctly, and that throw stays: a silent
     * fallback to a root path is how one shop's sale ends up in another's books.
     * But this is reached from `subscribe`, i.e. from inside a React render, so
     * the same throw used to take the whole tree down to a blank page during the
     * one window where it happens: a listener re-arming after `clearShopId()`, on
     * logout or on the different-shop branch before its reload. A signed-out
     * account is supposed to see the login screen, so the answer here is to say
     * "not subscribed" out loud and let the router do its job.
     *
     * There is a boundary over the tree now (src/components/ErrorBoundary.tsx,
     * mounted at the root and per route), and it is not a reason to delete this
     * try: the boundary turns a crash into a readable screen, whereas catching it
     * here means no crash at all — the owner walks to the login screen and the
     * other four collections never notice.
     */
    let q: Query<DocumentData>
    try {
      q = makeQuery()
    } catch (err) {
      // The last snapshot goes with it. Without a shop there is no way to name
      // whose rows those were, and handing them to whoever logs in next is the
      // exact leak the path-per-shop layout exists to make impossible.
      publish({
        data: [],
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        fatal: true,
        fatalReason: 'no-shop',
        code: null,
      })
      return
    }

    unsub = onSnapshot(
      q,
      (snap) => {
        retryIn = RETRY_MS
        attempts = 0
        publish({
          data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T),
          loading: false,
          error: null,
          fatal: false,
          fatalReason: null,
          code: null,
        })
      },
      (err) => {
        // Firestore never revives a listener that failed, and this one is
        // shared: leaving it dead would freeze the stock on every screen at
        // once, with the till still happily selling against a stale count.
        unsub = null
        const code = (err as { code?: string }).code ?? ''
        attempts += 1
        const terminal = TERMINAL.has(code)
        const giveUp = terminal || attempts >= MAX_ATTEMPTS

        publish({
          data: state.data,
          loading: false,
          error: err.message,
          // Said out loud rather than hidden behind a retry: the caller can
          // tell the owner to sign in again instead of quietly showing him
          // this morning's stock all afternoon.
          fatal: giveUp,
          // Refused and worn out are not the same news. `terminal` wins when
          // both are true, because a fifth permission-denied is still a refusal
          // and "check your connection" would be the wrong advice for it.
          fatalReason: giveUp ? (terminal ? reasonFor(code) : 'retries') : null,
          code: code === '' ? null : code,
        })
        if (giveUp || refs === 0) return

        retryTimer = setTimeout(() => {
          retryTimer = null
          retryIn = Math.min(retryIn * 2, MAX_RETRY_MS)
          if (refs > 0) start()
        }, retryIn)
      },
    )
  }

  /**
   * Wipe a recorded failure and give the store its five attempts back, so that
   * the next arm starts from a clean sheet instead of inheriting a count that
   * would give up on the first hiccup.
   *
   * It does not arm anything itself, and it publishes nothing when there is
   * nothing to forgive — a live, healthy store must not be made to re-render
   * because somebody asked politely.
   */
  const forgive = () => {
    attempts = 0
    retryIn = RETRY_MS
    clearRetry()
    if (!state.fatal && state.error === null) return
    publish({
      ...state,
      // A snapshot already on screen stays there while the listener catches up:
      // blanking a stock table somebody is reading is not an improvement, and
      // the next snapshot replaces it wholesale anyway. With nothing retained
      // the screen should say "loading" rather than "this shop has no products".
      loading: state.data.length === 0,
      error: null,
      fatal: false,
      fatalReason: null,
      code: null,
    })
  }

  /**
   * Hand-wound recovery, for the button the owner presses. Idempotent, and safe
   * with nothing mounted: there is no listener to arm then, but the give-up is
   * cleared, so the next screen to ask for this collection arms a fresh one.
   */
  const retry = () => {
    forgive()
    if (unsub === null && refs > 0) start()
  }

  /**
   * Drop the listener and forget the data, because it belongs to a shop this
   * browser is no longer looking at. `refs` is deliberately left alone: the
   * components that are still mounted still hold unsubscribe closures, and
   * zeroing the count here would make the first of those drive it negative and
   * strand the next listener with no keep-alive.
   */
  const reset = () => {
    if (idle !== null) {
      clearTimeout(idle)
      idle = null
    }
    clearRetry()
    if (unsub) {
      unsub()
      unsub = null
    }
    attempts = 0
    retryIn = RETRY_MS
    publish(blank())
    // Whoever is still on screen gets the new shop's rows rather than a spinner
    // that never resolves — and if there is no new shop, the `no-shop` branch of
    // `start()` says so without throwing.
    if (refs > 0) start()
  }

  const subscribe = (onChange: () => void) => {
    watchers.add(onChange)
    refs += 1
    if (idle !== null) {
      clearTimeout(idle)
      idle = null
    }
    // A screen opening is itself a fresh chance, and giving up implies there is
    // no listener left (the error path nulls `unsub` before it publishes), so
    // this always leads to a real re-arm. Without the forgive, the store would
    // sit there telling the owner it had given up while a new listener was
    // already running behind the message.
    if (state.fatal) forgive()
    start()
    return () => {
      watchers.delete(onChange)
      refs -= 1
      if (refs > 0) return
      idle = setTimeout(() => {
        idle = null
        if (refs > 0) return
        clearRetry()
        if (unsub) {
          unsub()
          unsub = null
        }
      }, KEEP_ALIVE_MS)
    }
  }

  stores.add({ reset, retry })
  return { subscribe, getSnapshot: () => state, retry }
}
