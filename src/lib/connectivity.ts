import { doc, onSnapshot } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'
import { currentShopId } from './tenant'

/**
 * Is there a line to Firestore RIGHT NOW?
 *
 * navigator.onLine answers a different question — "does this machine have a
 * network interface with an address" — and in a shop that is almost never the
 * question being asked. A dead ADSL line with the router still up, a router
 * whose uplink is gone, an operator captive portal and a DNS that has stopped
 * answering all read as ONLINE. That is exactly backwards for a till: the
 * offline badge went missing on precisely the failures it exists for, and the
 * owner was told his tickets had left the building while they sat in IndexedDB.
 *
 * The SDK does not expose its connection state, but every listener exposes the
 * one fact that settles it: snapshot metadata. With
 * `{ includeMetadataChanges: true }` a listener re-fires when only the metadata
 * changed, and `metadata.fromCache === false` means this snapshot came from the
 * server — there is a live stream to Firestore at this instant. Staying
 * fromCache means there is not, whatever the operating system believes.
 *
 * WHAT IS WATCHED, AND WHY IT IS NOT A TENANCY HOLE. The document is the shop's
 * own record, `shops/{shopId}`. It is a single document, the rules grant `get`
 * on it and refuse every write (firestore.rules:106-109), and it changes about
 * once a year — so the probe costs one document read when the till opens plus
 * one on each reconnect, and it can never be mistaken for a data listener. The
 * id is always `currentShopId()`, so the only path this module can ever read is
 * this shop's own record. shopPath() is deliberately not used: it composes
 * paths for the collections INSIDE a shop, one level below this document, and
 * it throws on an empty shopId — which is the state this module has to live
 * through, since it is armed and torn down around logins.
 *
 * navigator survives as a fast NEGATIVE only. An 'offline' event is worth
 * believing when it fires — the interface really did go away — and it saves the
 * seconds Firestore needs to notice a socket that died under it. An 'online'
 * event proves nothing at all and is treated as no more than a reason to look
 * again.
 *
 * WHAT THIS IS STILL NOT. It is not instant. When an uplink dies silently, with
 * the wifi and the router still up and no browser event to be had, the answer
 * stays "online" until the SDK's own stream gives out — up to about a minute.
 * That is the price of the only signal the SDK offers, and it is a minute of
 * over-optimism against what used to be days of it.
 */

export interface Connectivity {
  /** Firestore answered from the server, and has not since fallen back to cache. */
  online: boolean
  /**
   * No verdict yet. The caller must not render this as either state: a badge
   * that says "saved" here is the lie this module was written to remove, and
   * one that says "no line" cries wolf on every page load.
   */
  probing: boolean
}

/**
 * How long the probe waits for a first server answer before it concludes there
 * is no line. Generous: a shop connection can take several seconds to hand back
 * the first snapshot, and calling "no line" early is a false alarm the owner
 * would learn to ignore.
 */
const FIRST_ANSWER_MS = 8_000

/**
 * How often currentShopId() is compared with what the probe is armed for.
 *
 * Polled rather than pushed because the shop id lives in a plain module
 * (src/lib/tenant.ts) with no change notification, and because the alternative
 * — re-arming from inside the auth flow — is the window that makes shopPath()
 * throw inside a subscription. A string comparison every three seconds costs
 * nothing and cannot be forgotten by a future caller.
 */
const WATCH_MS = 3_000

/**
 * How long a listener that failed waits before it is tried again.
 *
 * liveCollection.ts gives up permanently after a terminal error, and is right
 * to: re-downloading a whole collection every thirty seconds for the rest of
 * the session is a real cost. This is one document, and it is the instrument
 * itself — an instrument that has given up is worse than one that retries — so
 * here the retry is unbounded and merely slow.
 */
const REARM_MS = 30_000

/** null while unknown, true once the server has answered, false once it has not. */
let serverSeen: boolean | null = null
let armed = ''
let unsub: (() => void) | null = null
let deadAt = 0
let firstAnswer: ReturnType<typeof setTimeout> | null = null
let watch: ReturnType<typeof setInterval> | null = null

const watchers = new Set<(next: Connectivity) => void>()

function browserSaysOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function derive(): Connectivity {
  // The fast negative: when the interface is gone there is nothing to probe and
  // no reason to wait for Firestore to work it out.
  if (browserSaysOffline()) return { online: false, probing: false }
  return { online: serverSeen === true, probing: serverSeen === null }
}

let snapshot: Connectivity = derive()

function publish() {
  const next = derive()
  if (next.online === snapshot.online && next.probing === snapshot.probing) return
  snapshot = next
  for (const notify of watchers) notify(next)
}

function clearFirstAnswer() {
  if (firstAnswer === null) return
  clearTimeout(firstAnswer)
  firstAnswer = null
}

function disarm() {
  clearFirstAnswer()
  const stop = unsub
  unsub = null
  armed = ''
  serverSeen = null
  if (!stop) return
  try {
    stop()
  } catch {
    /* the listener is going away regardless */
  }
}

function arm(shopId: string) {
  disarm()
  // shopPath() throws on an empty shop id and a listener re-armed in that
  // window is a blank screen instead of a login redirect. Nothing is armed
  // until an id exists; the watcher below arms it the moment one does.
  if (shopId === '' || !isFirebaseConfigured) {
    publish()
    return
  }
  armed = shopId

  try {
    unsub = onSnapshot(
      // Built inside the try because doc() throws SYNCHRONOUSLY on a malformed
      // segment, and this id comes from localStorage, where anyone can put a
      // slash in it.
      doc(db, 'shops', shopId),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.metadata.fromCache) {
          // The server answered. This is the only thing in the app that is
          // allowed to say the line is up.
          serverSeen = true
          clearFirstAnswer()
        } else if (serverSeen === true) {
          // We had a server stream and this snapshot came from cache: the
          // stream dropped. A first cached snapshot means nothing either way,
          // so it is left to the FIRST_ANSWER_MS deadline to decide.
          serverSeen = false
          clearFirstAnswer()
        }
        publish()
      },
      () => {
        // Firestore never revives a listener that failed. Treat a refused or
        // broken probe as "no line" — the honest reading, since a probe that
        // cannot run cannot confirm anything — and let the watcher re-arm it.
        unsub = null
        deadAt = Date.now()
        serverSeen = false
        clearFirstAnswer()
        publish()
      },
    )
  } catch {
    unsub = null
    deadAt = Date.now()
    serverSeen = false
  }

  firstAnswer = setTimeout(() => {
    firstAnswer = null
    if (serverSeen !== null) return
    serverSeen = false
    publish()
  }, FIRST_ANSWER_MS)

  publish()
}

function tick() {
  const shopId = currentShopId()
  // Covers all three transitions with one comparison: signing in, signing out,
  // and the same machine changing hands to another shop.
  if (shopId !== armed) {
    arm(shopId)
    return
  }
  if (armed === '') return
  if (unsub === null && Date.now() - deadAt >= REARM_MS) arm(armed)
}

function startProbe() {
  if (watch !== null) return
  // Deferred by a turn: watchConnectivity is called from inside a React
  // subscribe(), and arming publishes.
  setTimeout(tick, 0)
  watch = setInterval(tick, WATCH_MS)
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    // The interface really went away, so whatever the server last told us is
    // now history. Forgetting it here is what stops the 'online' event below
    // from silently reinstating a connection nobody has verified since.
    serverSeen = false
    publish()
  })
  window.addEventListener('online', () => {
    // Deliberately does NOT set online: this event fires on a captive portal
    // and on a router whose uplink is dead. All it earns is a fresh look, and
    // Firestore decides.
    publish()
    if (armed !== '' && unsub === null) arm(armed)
  })
}

/** The current answer. Free to call; it starts nothing and reads nothing. */
export function connectivitySnapshot(): Connectivity {
  return snapshot
}

/**
 * Watches the line, starting the probe on the first watcher.
 *
 * Lazy on purpose: importing this module must not open a Firestore listener
 * before the account has finished signing in. The first watcher arrives with
 * the app shell, which only renders once a shop is known.
 */
export function watchConnectivity(onChange: (next: Connectivity) => void): () => void {
  watchers.add(onChange)
  startProbe()
  return () => {
    watchers.delete(onChange)
  }
}
