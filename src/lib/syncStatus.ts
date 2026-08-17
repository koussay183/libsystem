import { waitForPendingWrites } from 'firebase/firestore'
import { db } from './firebase'
import { connectivitySnapshot, watchConnectivity } from './connectivity'

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
 * only the reporting layer — and it is the ONLY instrument the shop has for
 * "did my tickets leave the building", so it is not allowed to guess. It used
 * to guess three times:
 *
 *  · ONLINE was navigator.onLine, which reads true on a dead ADSL line, on a
 *    router with no uplink and behind a captive portal — every ordinary failure
 *    in a Tunisian shop. It is now Firestore's own answer, from snapshot
 *    metadata; see src/lib/connectivity.ts.
 *
 *  · PENDING was an in-memory counter seeded to 0, and nothing rehydrated it.
 *    A reload after three days of offline selling therefore showed grey "online"
 *    and then green "everything is saved" over a mutation queue that was still
 *    full: the badge reported success at the exact moment it could not know
 *    anything. The count is now written to disk as it changes, so a fresh
 *    session starts by admitting it may have inherited unsent work.
 *
 *  · DENIED was in-memory too, and it is the one flag that explains why a row
 *    appeared and then vanished. It survives a reload now; clearDenied() is
 *    still the only thing that lowers it.
 *
 * WHY OUR OWN COUNTER AND NOT THE REAL QUEUE. The SDK does not expose the
 * length of its mutation queue, or any way to enumerate it, so the number below
 * is our own evidence rather than a reading of the real thing. It is therefore
 * approximate — see the drift note on the ledger — and the only sound way back
 * to "nothing outstanding" is to ask Firestore itself: a real server connection
 * plus a waitForPendingWrites that resolves. That is confirmDrained(), and it is
 * also what quietly repairs any drift.
 *
 * THE ONE THING NEITHER THIS MODULE NOR src/lib/firebase.ts CAN SEE. firebase.ts
 * probes whether IndexedDB can be opened at all and falls back to a memory
 * cache when it cannot, but an implementation that opens and then fails
 * asynchronously cannot be caught anywhere — and with a memory cache there is
 * no durable queue, so a reload loses every offline ticket. The ledger here
 * survives that reload (localStorage is a different store and usually keeps
 * working), so it will report inherited work; Firestore will then answer that
 * its queue is empty, because it genuinely is, and the counters will clear. In
 * that one situation "confirmed" means "gone", and nothing available to the
 * client can tell the two apart.
 */

export interface SyncState {
  /**
   * Firestore has a live server connection right now — not "the operating
   * system believes there is a network". See src/lib/connectivity.ts.
   */
  online: boolean
  /**
   * No verdict on the line yet. Neither "saved" nor "no line" may be rendered
   * while this is true: the first is the lie this module exists to remove, and
   * the second, on every page load, teaches the owner to ignore orange.
   */
  probing: boolean
  /** Writes THIS session started that have not been acknowledged yet. */
  pending: number
  /**
   * Writes an earlier session on this device started and that nobody ever saw
   * acknowledged.
   *
   * Kept separate from `pending` because nothing in this session can ever
   * settle them: their promises died with the page that made them, so no
   * callback here will ever count them down. Only a Firestore-confirmed drain
   * clears this — which is exactly why it must never be folded into "saved".
   */
  carried: number
  /** When the queue was last known to be completely empty. */
  syncedAt: number | null
  /**
   * A write came back rejected rather than merely delayed.
   *
   * Offline writes are normal here and are not errors. This is the other
   * thing: the write was answered with a no, and Firestore's answer to a no is
   * to roll the change back locally. Without this flag that rollback is
   * completely silent: the article appears, then disappears, and nothing on
   * screen explains why. It is kept on disk because a reload would otherwise
   * erase the only explanation the owner is ever offered.
   */
  denied: boolean
  /**
   * WHY THIS EXISTS AS WELL AS `denied`, AND WHY IT IS NOT JUST A NICER MESSAGE.
   *
   * This flag used to be raised for exactly two error codes, permission-denied
   * and unauthenticated. Every other rejection was dropped on the floor — and
   * around twenty write sites in this app carry a comment promising that "a
   * refusal surfaces through the sync badge", which was therefore untrue for
   * all of them. A stock adjustment rejected as not-found (the article was
   * deleted on another device), a batch rejected as resource-exhausted (the
   * project's write quota is gone) or an invalid-argument from a corrupt
   * restored row was rolled back in the local cache with NOTHING anywhere on
   * screen: the row appeared, the dialog said it was saved, and the shelf count
   * silently went back to what it was.
   *
   * The two cases need different words, though, because they need different
   * actions from the owner:
   *
   *  · 'refused' — the server knows who he is and said no. The plan has run
   *    out past its grace, or this account no longer owns this shop. Renewing
   *    or signing in again is the remedy, and until then nothing new will save.
   *
   *  · 'lost' — the write itself was rejected. Everything else still works;
   *    what is gone is that one change, and the owner has to enter it again.
   *    Telling him to sign in again here would be advice that fixes nothing.
   */
  deniedReason: DeniedReason | null
}

/** @see SyncState.deniedReason */
export type DeniedReason = 'refused' | 'lost'

/**
 * The durable half of the answer.
 *
 * `q` counts writes started on this device that we have not seen acknowledged.
 * It is deliberately not exact, and the code must not pretend otherwise: two
 * tabs are a normal configuration here — it is why firebase.ts asks for
 * persistentMultipleTabManager — and they share this one key with no
 * coordination, so a pair of interleaved read-modify-writes loses an increment
 * now and then; a tab killed mid-write leaves one behind for ever; and a write
 * that lands during a drain probe can be forgotten. Every one of those errors is
 * bounded by one or two, and every one of them is wiped by the next
 * confirmDrained() — which is what makes an approximate counter safe to build a
 * badge on. What it must never do is drift DOWNWARDS on its own, which is why
 * nothing but a confirmed drain ever subtracts more than one at a time.
 */
const LEDGER_KEY = 'lib.sync.v1'

interface Ledger {
  q: number
  denied: boolean
  reason: DeniedReason | null
  /** When the queue was last proven empty, epoch ms. */
  at: number | null
}

const EMPTY_LEDGER: Ledger = { q: 0, denied: false, reason: null, at: null }

function readLedger(): Ledger {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    if (raw === null) return EMPTY_LEDGER
    const parsed = JSON.parse(raw) as Partial<Ledger> | null
    if (parsed === null || typeof parsed !== 'object') return EMPTY_LEDGER
    const q =
      typeof parsed.q === 'number' && Number.isFinite(parsed.q)
        ? Math.max(0, Math.floor(parsed.q))
        : 0
    const at =
      typeof parsed.at === 'number' && Number.isFinite(parsed.at) ? parsed.at : null
    const reason =
      parsed.reason === 'refused' || parsed.reason === 'lost' ? parsed.reason : null
    // A ledger written before this field existed says denied with no reason.
    // 'refused' is the honest reading of those: it is what the flag used to
    // mean, since it was the only thing that could raise it.
    return { q, denied: parsed.denied === true, reason: parsed.denied === true ? reason ?? 'refused' : null, at }
  } catch {
    // Corrupt JSON, or storage that refuses to be read. Reporting nothing
    // outstanding is the only option left; it is also what the old in-memory
    // version did on every single load.
    return EMPTY_LEDGER
  }
}

/**
 * Read-modify-write, always reading fresh, so an increment made by the other
 * tab between our read and our write is preserved rather than overwritten.
 */
function editLedger(change: (current: Ledger) => Ledger) {
  const next = change(readLedger())
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(next))
  } catch {
    /* private mode or a full quota: the badge degrades to this session only */
  }
}

const boot = readLedger()

const line = connectivitySnapshot()

let state: SyncState = {
  online: line.online,
  probing: line.probing,
  pending: 0,
  // Nothing in this session started these, so they belong in `carried` — and
  // because pending is 0 at boot, whatever the ledger still holds is by
  // definition inherited.
  carried: boot.q,
  syncedAt: boot.at,
  denied: boot.denied,
  deniedReason: boot.reason,
}

/** @see beginShutdown */
let shuttingDown = false

const watchers = new Set<() => void>()

function publish(next: Partial<SyncState>) {
  state = { ...state, ...next }
  for (const notify of watchers) notify()
}

/**
 * How long one drain probe is allowed to stay outstanding before the guard is
 * released. waitForPendingWrites NEVER SETTLES while the line is down — it does
 * not reject — so without this a single probe started as the line died would
 * block every later one for the rest of the session.
 */
const DRAIN_TIMEOUT_MS = 30_000

/**
 * How often the drain probe is retried. It costs nothing when there is nothing
 * outstanding or no line, and a queue holding three days of tickets can easily
 * outlast one DRAIN_TIMEOUT_MS window, so somebody has to keep asking.
 */
const RECHECK_MS = 15_000

/** Sequence numbers, so a confirmed drain can tell old writes from new ones. */
let seq = 0
const inFlight = new Set<number>()

/** The drain probe in flight, or 0 when there is none. */
let draining = 0
let drainSeq = 0

/**
 * Asks Firestore whether the queue is genuinely empty, and only then declares
 * everything saved.
 *
 * This is the single place allowed to clear `carried`. waitForPendingWrites
 * resolves when every write queued AT THE MOMENT OF THE CALL has been
 * acknowledged by the server, which is the one statement strong enough to
 * retire work inherited from a previous session — and, as a side effect, to
 * repair whatever the shared counter has drifted by.
 *
 * It is never awaited without a real server connection AND a timeout, because
 * offline it neither resolves nor rejects.
 */
function confirmDrained() {
  if (draining !== 0) return
  // Not navigator.onLine. The whole point of src/lib/connectivity.ts is that a
  // captive portal reads as online, and a probe started there hangs for ever.
  if (!connectivitySnapshot().online) return
  // Nothing outstanding: there is nothing to prove, and asking anyway would
  // push syncedAt forward every RECHECK_MS and re-flash "saved" at an owner who
  // has not saved anything.
  if (state.pending === 0 && state.carried === 0) return

  const barrier = seq
  const queuedBefore = readLedger().q
  drainSeq += 1
  const token = drainSeq
  draining = token

  const finish = (drained: boolean) => {
    // A probe superseded by a later one must not apply its answer twice.
    if (draining !== token) return
    draining = 0
    if (!drained) return

    // Everything queued before the barrier is acknowledged; writes started
    // during the probe are not, and keep their place in the count.
    for (const id of inFlight) {
      if (id <= barrier) inFlight.delete(id)
    }

    const now = Date.now()
    editLedger((current) => ({
      ...current,
      q: Math.max(0, current.q - queuedBefore),
      at: now,
    }))
    publish({ pending: inFlight.size, carried: 0, syncedAt: now })
  }

  waitForPendingWrites(db).then(
    () => finish(true),
    () => finish(false),
  )
  // The timeout only releases the guard so the next tick can ask again; a probe
  // cut short means "not confirmed yet", never "confirmed".
  setTimeout(() => finish(false), DRAIN_TIMEOUT_MS)
}

let watching = false

function startWatching() {
  if (watching) return
  watching = true

  watchConnectivity((next) => {
    if (next.online !== state.online || next.probing !== state.probing) {
      publish({ online: next.online, probing: next.probing })
    }
    // A line that has just come back is the one moment worth asking Firestore
    // whether the queue really emptied.
    if (next.online) confirmDrained()
  })

  // Catch up on anything decided before there was anybody to tell. The window is
  // real: the machine can go offline between this module being imported and the
  // shell subscribing, and connectivity only notifies on a CHANGE — so without
  // this the badge would sit on "checking" for as long as the line stayed down.
  const current = connectivitySnapshot()
  if (current.online !== state.online || current.probing !== state.probing) {
    publish({ online: current.online, probing: current.probing })
  }

  if (typeof window !== 'undefined') setInterval(confirmDrained, RECHECK_MS)
}

/**
 * Counts a write while it is in flight. The promise is returned untouched, so
 * callers can keep awaiting exactly what they awaited before.
 */
export function track<T>(promise: Promise<T>): Promise<T> {
  seq += 1
  const id = seq
  inFlight.add(id)
  // Written to disk BEFORE the promise is handed back, so a tab closed one
  // millisecond later still leaves evidence that work was started.
  editLedger((current) => ({ ...current, q: current.q + 1 }))
  publish({ pending: inFlight.size })

  const done = (landed: boolean) => {
    if (!inFlight.delete(id)) return
    const now = Date.now()
    editLedger((current) => {
      const q = Math.max(0, current.q - 1)
      return { ...current, q, at: q === 0 && landed ? now : current.at }
    })
    // A resolved Firestore write is a write the server acknowledged, so this is
    // the one moment "saved" can be said without asking anything further. It is
    // withheld while `carried` stands, because those writes cannot settle here
    // — see the field comment — and a green badge over them would be the old
    // lie in a new place.
    const settled = inFlight.size === 0 && landed && state.carried === 0
    publish({ pending: inFlight.size, syncedAt: settled ? now : state.syncedAt })
  }

  promise.then(
    () => done(true),
    (err: unknown) => {
      done(false)
      const code = (err as { code?: string } | null)?.code ?? ''

      // Shutting down cancels whatever is still in flight, and that is not news
      // — logout only reaches terminate() once the queue has been proven empty,
      // so anything cancelled here was already accounted for. Without this the
      // act of signing out would raise a data-loss warning on the way to the
      // login screen.
      if (shuttingDown || code === 'cancelled') return

      // EVERY rejection is a rolled-back write, whatever the code says. Only
      // the remedy differs, so only the wording is chosen here.
      const reason: DeniedReason =
        code === 'permission-denied' || code === 'unauthenticated' ? 'refused' : 'lost'

      editLedger((current) => ({
        ...current,
        denied: true,
        // 'refused' outranks 'lost'. A lapsed plan rejects everything that
        // follows, so it would otherwise be relabelled by the next ordinary
        // failure and the owner would be told to re-enter one line when in fact
        // nothing at all is saving.
        reason: current.reason === 'refused' ? 'refused' : reason,
      }))
      publish({
        denied: true,
        deniedReason: state.deniedReason === 'refused' ? 'refused' : reason,
      })
    },
  )
  // Returned untouched on purpose: every caller keeps awaiting exactly what it
  // awaited before, and the ones that deliberately ignore rejection still do.
  return promise
}

/**
 * Called once the owner has been told.
 *
 * Dismissal is the ONLY thing that lowers this, deliberately: a rolled-back
 * write is not undone by the line coming back, so clearing it on a successful
 * drain would erase the only notice the owner ever gets about work he has to
 * enter again. What that makes essential is that the dismiss control is always
 * reachable — see AppShell, where this banner used to be suppressed by the
 * lapsed-plan banner and was therefore impossible to clear on the one occasion
 * it was guaranteed to be showing.
 */
export function clearDenied() {
  if (!state.denied) return
  editLedger((current) => ({ ...current, denied: false, reason: null }))
  publish({ denied: false, deniedReason: null })
}

/**
 * Stop treating rejections as news, because we are on our way out.
 *
 * terminate() rejects every write still in flight. During a logout that is
 * housekeeping, not a failure, and the ledger must not record it as one.
 */
export function beginShutdown() {
  shuttingDown = true
}

/**
 * Forget everything this device was carrying.
 *
 * Only correct when the mutation queue has actually been destroyed — logout
 * calls it in the branch that wipes the IndexedDB cache, and nowhere else. On a
 * logout that KEEPS the cache the queue survives, so the ledger describing it
 * must survive too, even though the next account to sign in on this machine
 * will then see a count that belonged to the previous one. That is the honest
 * order of the two evils: a confusing number beats hiding unsent takings.
 */
export function resetLedger() {
  try {
    localStorage.removeItem(LEDGER_KEY)
  } catch {
    /* nothing to do: the in-memory reset below is what the badge reads */
  }
  publish({ pending: 0, carried: 0, denied: false, deniedReason: null, syncedAt: null })
}

export const syncStore = {
  subscribe(onChange: () => void) {
    watchers.add(onChange)
    // The connectivity probe starts here rather than at import time: the first
    // subscriber is the app shell, which does not render until a shop is known.
    // A listener armed before that point is the failure src/lib/tenant.ts warns
    // about — a Firestore path built before the account finished signing in.
    startWatching()
    return () => {
      watchers.delete(onChange)
    }
  },
  getSnapshot: () => state,
}
