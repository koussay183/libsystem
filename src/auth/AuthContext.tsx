import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
  type User,
} from 'firebase/auth'
import { terminate, clearIndexedDbPersistence, waitForPendingWrites } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { setShopId, clearShopId, currentShopId } from '@/lib/tenant'
import { resetLiveCollections } from '@/lib/liveCollection'
import { syncStore, beginShutdown, resetLedger } from '@/lib/syncStatus'

/**
 * Real accounts, one shop each.
 *
 * The shop a signed-in account may touch is NOT decided here. It arrives as a
 * `shopId` custom claim on the ID token, which is signed by Firebase, set only
 * by the admin CLI, and compared against the document path by the security
 * rules. Everything in this file is a convenience for the UI; none of it is
 * what keeps two shops apart.
 *
 * OFFLINE IS THE NORMAL CASE. The shop opens the till before the line is up
 * more often than anyone would like, so nothing here waits on the network to
 * decide whether the app may start:
 *   · the last known uid and shopId are read synchronously from localStorage,
 *     so the first render and the first Firestore listen happen immediately;
 *   · the claim is read from the CACHED token — never with forceRefresh — so
 *     signing in again after a reboot with no line still works;
 *   · a failed refresh is not a logout. It is a network problem, and treating
 *     it as a logout would lock a shop out of its own till for the afternoon.
 * The rules are what enforce the truth. A stale or edited value here buys
 * nothing but a permission error.
 */

const UID_KEY = 'lib.uid.v1'
const PAID_KEY = 'lib.paidUntil.v1'

/**
 * How long logout waits for the write queue to reach the server before it
 * gives up and keeps the local cache. Long enough for a slow line to finish a
 * few tickets, short enough that nobody decides the button is broken.
 */
const DRAIN_TIMEOUT_MS = 4000

/**
 * How often the lapsed flag is recomputed against the wall clock.
 *
 * A minute is far more precision than a banner about a monthly plan needs, and
 * the work is one number comparison. It exists at all because the till is left
 * open on the counter for days: without a clock, a plan that ran out at
 * midnight showed a clean screen until the owner happened to navigate.
 */
const LAPSE_TICK_MS = 60_000

/** What the CLI writes into the token, and what the rules read back out. */
interface ShopClaims {
  shopId?: string
  paidUntil?: number
}

export interface AuthContextValue {
  /** Truthy once an account is signed in on this device. */
  user: boolean
  loading: boolean
  /** The shop this account owns, or '' while it is not known yet. */
  shopId: string
  /**
   * When the plan runs out, in epoch ms. Null when the account carries no
   * plan at all, which the CLI treats as "never provisioned".
   */
  paidUntil: number | null
  /**
   * The plan deadline has passed. Writes STILL WORK — see {@link isLapsed} and
   * the grace window in firestore.rules. This is the warning, not the lockout.
   */
  lapsed: boolean
  /**
   * The grace window has passed too, so the server now refuses every write.
   * This is the lockout, and it is the only state in which the app may tell the
   * owner that nothing can be saved.
   */
  blocked: boolean
  email: string
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readUid(): string {
  try {
    return localStorage.getItem(UID_KEY) ?? ''
  } catch {
    return ''
  }
}

/**
 * The plan deadline, kept on disk next to the uid.
 *
 * Without this, paidUntil starts null after every reload and stays null until
 * a token can be read — which offline never happens. The lapsed banner then
 * cannot appear on the one device that most needs it: a till offline for days,
 * whose queued writes are about to be refused, and whose owner has nothing on
 * screen explaining why rows change and then change back.
 */
function readPaidUntil(): number | null {
  try {
    const raw = localStorage.getItem(PAID_KEY)
    if (raw === null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function writePaidUntil(until: number | null) {
  try {
    if (until === null) localStorage.removeItem(PAID_KEY)
    else localStorage.setItem(PAID_KEY, String(until))
  } catch {
    /* private mode */
  }
}

function writeUid(uid: string) {
  try {
    if (uid === '') localStorage.removeItem(UID_KEY)
    else localStorage.setItem(UID_KEY, uid)
  } catch {
    /* private mode */
  }
}

/**
 * The one definition of "this shop's plan has run out".
 *
 * Kept as a plain function of its inputs and the clock so that the ticking
 * effect below and the initial state cannot drift apart. `paidUntil` is the
 * printed deadline, not the point at which the rules start refusing writes —
 * they allow a grace window past it (graceMs() in firestore.rules) — so this
 * goes true while writing still works. That is the intent: the banner is a
 * warning with days of runway behind it, not a report of a lockout that has
 * already happened.
 */
function isLapsed(shop: string, paidUntil: number | null): boolean {
  return shop !== '' && paidUntil !== null && paidUntil < Date.now()
}

/**
 * MUST MATCH graceMs() IN firestore.rules, AND RULES_GRACE_MS IN cli/lib.mjs.
 *
 * Three copies of one number is not something to be pleased about, but they
 * cannot be shared: one is compiled into the bundle, one is a rules expression
 * evaluated on Google's servers, and one belongs to a Node script holding the
 * admin key. What matters is that they cannot disagree silently, so each names
 * the other two.
 *
 * Fourteen days exist because a shop can be offline for a fortnight and its
 * queued tickets are stamped with the moment they REACH the server, not the
 * moment they were rung up. Without the window, a plan that ran out during an
 * outage made the rules refuse the whole backlog on reconnect — and Firestore
 * answers a refused write by rolling it back locally, so a fortnight of takings
 * disappeared.
 */
const RULES_GRACE_MS = 14 * 24 * 60 * 60 * 1000

/**
 * The plan ran out AND its grace window has closed, so the server is now
 * genuinely refusing writes.
 *
 * The distinction is the whole point. Between `lapsed` and `blocked` the shop
 * keeps working normally and simply needs to renew; only past `blocked` is it
 * true that nothing can be saved. Saying the latter during the former is the
 * worst kind of wrong message, because a shopkeeper who believes his till has
 * stopped recording sales starts writing tickets on paper — and then enters
 * nothing, or enters it twice.
 */
function isBlocked(shop: string, paidUntil: number | null): boolean {
  return shop !== '' && paidUntil !== null && paidUntil + RULES_GRACE_MS < Date.now()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Seeded from disk so the very first render already knows whether to show
  // the till or the login screen, with or without a connection.
  const [user, setUser] = useState<boolean>(() => readUid() !== '')
  const [shopId, setShop] = useState<string>(() => currentShopId())
  const [paidUntil, setPaidUntil] = useState<number | null>(() => readPaidUntil())
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  // Seeded from the same two values the ticker below watches, and from the
  // paidUntil that readPaidUntil() just pulled off disk, so the banner is
  // correct on the first frame of an offline reload.
  const [lapsed, setLapsed] = useState<boolean>(() => isLapsed(shopId, paidUntil))
  const [blocked, setBlocked] = useState<boolean>(() => isBlocked(shopId, paidUntil))

  /**
   * The plan deadline is a moment in time, so noticing it requires a clock.
   *
   * This was derived during render, which meant it changed only when something
   * else happened to re-render the provider. The till is opened in the morning
   * and left open: a plan expiring at midnight kept a clean UI all of the next
   * day, and the orange banner (AppShell) appeared whenever the owner finally
   * navigated somewhere — which on a busy day is never.
   *
   * shopId and paidUntil are in the deps so this also re-checks the moment a
   * refreshed token moves the deadline — a plan extended in the CLI takes the
   * banner down as soon as the claim lands, not up to a minute later.
   */
  useEffect(() => {
    const tick = () => {
      const next = isLapsed(shopId, paidUntil)
      // Publish ONLY on a real change. This runs once a minute for as long as
      // the tab is open, and setLapsed(next) unconditionally would push a new
      // context value — re-rendering every screen in the app, the till
      // included — sixty times an hour for nothing.
      setLapsed((prev) => (prev === next ? prev : next))
      // The same clock decides both, so they are recomputed together — two
      // tickers could report a plan that had lapsed but not yet lapsed.
      const shut = isBlocked(shopId, paidUntil)
      setBlocked((prev) => (prev === shut ? prev : shut))
    }
    tick()
    const timer = setInterval(tick, LAPSE_TICK_MS)
    /**
     * A laptop shut at 18:00 and opened at 09:00 has not fired one of those
     * intervals: browsers throttle timers in a hidden tab and stop them
     * outright while the machine sleeps. Becoming visible again is precisely
     * the moment the answer is most likely to have changed, so it is checked
     * there too rather than up to a minute later.
     */
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [shopId, paidUntil])

  useEffect(() => {
    /**
     * onIdTokenChanged, not onAuthStateChanged: it also fires when the token
     * is refreshed, which is how a plan extended in the CLI reaches a browser
     * that is already open.
     */
    return onIdTokenChanged(auth, (account: User | null) => {
      if (!account) {
        // Only a real sign-out empties this. A token that could not be
        // refreshed leaves `account` intact, so this branch is not reached by
        // a flaky line.
        writeUid('')
        // The deadline leaves disk with the uid. It used to survive a sign-out,
        // and now that the banner is seeded from PAID_KEY and re-checked on a
        // timer, a leftover value would tell the NEXT account on this machine
        // that its plan had run out before its own claim had even been read.
        writePaidUntil(null)
        // The tenant goes first, THEN the listeners, and the order is not a
        // matter of taste: resetLiveCollections() re-arms every store that still
        // has a mounted component (liveCollection.ts reset()), and it builds
        // those queries from the tenant as it stands at that moment. Wiping
        // before clearShopId() therefore re-attaches a listener to the shop
        // being signed out of, and the cache answers it — so the module-level
        // stores end up re-filled with that shop's rows, which then survive in
        // this tab until something else empties them. The next account to sign
        // in here reads them off its own screen, and the different-shop guard in
        // login() below cannot catch it, because by then the previous id is ''.
        //
        // The blank page that argued for the other order is already handled
        // where it belongs: shopPath() still throws with no shop selected
        // (tenant.ts:93-99, and it must), but start() builds its query inside a
        // try and publishes a 'no-shop' state instead of letting that throw out
        // through a React subscription. Nothing is armed and no retry timer is
        // left behind on this path, so the router reaches the login screen.
        clearShopId()
        resetLiveCollections()
        setUser(false)
        setShop('')
        setPaidUntil(null)
        setEmail('')
        setLoading(false)
        return
      }

      writeUid(account.uid)
      setUser(true)
      setEmail(account.email ?? '')

      // The CACHED token. getIdTokenResult() without forceRefresh resolves
      // from what is already on the device, so this does not become a network
      // dependency in front of the first stock listen.
      account
        .getIdTokenResult()
        .then((result) => {
          const claims = result.claims as unknown as ShopClaims
          const next = typeof claims.shopId === 'string' ? claims.shopId : ''
          const until = typeof claims.paidUntil === 'number' ? claims.paidUntil : null

          // A different shop on the same device means every live listener and
          // every cached document belongs to somebody else. Start over.
          if (next !== '' && currentShopId() !== '' && next !== currentShopId()) {
            // The switch, then the wipe. window.location.reload() does not stop
            // the world synchronously, so anything still mounted keeps running
            // for as long as the teardown takes — and whatever re-arms in that
            // window must arm against the NEW shop, holding no rows from the old
            // one. Reversing these two lines is what produces the state this
            // branch exists to prevent: a listener freshly attached to the shop
            // being left behind, still publishing its documents from the cache.
            setShopId(next)
            resetLiveCollections()
            window.location.reload()
            return
          }
          if (next !== '') setShopId(next)
          else {
            // A signed-in account whose shopId claim has gone: RequireAuth will
            // show the "not provisioned" screen, but only after React has
            // re-rendered, and until then every live collection still exists and
            // every retry timer is still armed. They are emptied AFTER the id is
            // gone, for the reason spelled out in the sign-out branch above — a
            // wipe that runs first re-arms them on the shop being abandoned.
            clearShopId()
            resetLiveCollections()
          }
          setShop(next)
          setPaidUntil(until)
          writePaidUntil(until)
        })
        .catch(() => {
          /* No token to read yet — keep whatever the last session knew. */
        })
        .finally(() => setLoading(false))
    })
  }, [])

  const login = async (emailInput: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, emailInput.trim(), password)
    // Read the claim before returning, so the caller never lands on a screen
    // that has an account but no shop.
    const result = await credential.user.getIdTokenResult()
    const claims = result.claims as unknown as ShopClaims
    if (typeof claims.shopId === 'string' && claims.shopId !== '') {
      const previous = currentShopId()
      setShopId(claims.shopId)
      setShop(claims.shopId)
      /**
       * Signing in as a different shop than the one this device last held.
       *
       * The different-shop branch in the listener above cannot catch this one:
       * this function writes the tenant before that comparison runs, so
       * `next !== currentShopId()` is already false and its reload never fires.
       * Without the wipe, every live store keeps the previous shop's rows and
       * every live listener stays attached to the previous shop's collections,
       * and the operator who just signed in reads them off his own screen.
       * After the tenant, not before: the re-arm has to build its query from
       * the shop that is selected now.
       */
      if (previous !== '' && previous !== claims.shopId) resetLiveCollections()
    }
    if (typeof claims.paidUntil === 'number') setPaidUntil(claims.paidUntil)
  }

  /**
   * Signing out has to leave nothing of this shop behind — and has to refuse
   * when leaving would destroy work.
   *
   * Firestore's cache holds every document this shop has read. On a machine
   * that changes hands, or that is handed to another shop, that cache is the
   * isolation hole no security rule can close, so it is cleared. But it is
   * cleared ONLY when there is nothing queued: a sale rung up with the line
   * down lives in exactly that cache until it syncs, and wiping it would
   * delete a real sale that the owner has already taken money for.
   */
  const logout = async () => {
    const pending = syncStore.getSnapshot()
    /**
     * `let`, not `const`. This was const, which made the catch below a comment
     * rather than a guard: it said "fall through and keep the cache" and then
     * wiped it anyway, because nothing could lower the flag.
     */
    let safeToWipe = pending.pending === 0 && pending.online

    if (safeToWipe) {
      /**
       * Raced against a timer, because waitForPendingWrites does not reject when
       * the line is down — it simply never settles. Awaited bare, logout hung
       * forever and the redirect at the end of this function never ran, so the
       * owner sat on a dead screen. And navigator.onLine reads true on a dead
       * ADSL line and behind a captive portal, so `pending.online` is precisely
       * the premise that cannot be trusted here.
       *
       * A timeout counts as "not drained", which keeps the cache. Leaving a cache
       * on a shared machine is a privacy cost; wiping a queue that still holds
       * sales is money the shop has already taken.
       */
      const drained = await Promise.race([
        waitForPendingWrites(db).then(
          () => true,
          () => false,
        ),
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), DRAIN_TIMEOUT_MS)
        }),
      ])
      if (!drained) safeToWipe = false
    }

    try {
      await signOut(auth)
    } catch {
      /* signing out locally is what matters; the reload below finishes it */
    }
    writeUid('')
    writePaidUntil(null)
    // Done explicitly here even though signOut() above has already driven the
    // null branch of onIdTokenChanged through the same pair: signOut() is allowed
    // to fail (its catch is two lines up), and this function then goes on to
    // terminate() the Firestore instance. Neither a surviving listener nor a
    // retry timer may still be holding — or rebuilding — a query when that
    // happens.
    //
    // Which is also why the id is cleared FIRST. With no shop selected the
    // re-arm inside resetLiveCollections() lands in the 'no-shop' branch of
    // start(), which attaches no listener and sets no timer; clearing second
    // would instead leave a listener freshly armed on the shop being abandoned,
    // at the worst possible moment — one line above terminate().
    clearShopId()
    resetLiveCollections()

    if (safeToWipe) {
      try {
        // terminate() rejects every write still in flight, and the sync ledger
        // treats a rejection as a rolled-back change worth warning about. Told
        // first, it keeps quiet: we only get here once the queue has been proven
        // empty, so there is nothing left to lose and nothing to report.
        beginShutdown()
        // terminate() before clearing: the instance was created with
        // persistentLocalCache and is already in use, and
        // clearIndexedDbPersistence refuses on a live instance.
        await terminate(db)
        await clearIndexedDbPersistence(db)
        // The mutation queue this counter describes has just been destroyed, so
        // the counter has to go with it. Left behind, the next account to sign
        // in on this machine inherits a "42 writes unconfirmed" warning about
        // work that no longer exists — and its own genuinely-empty queue would
        // then read as the answer to somebody else's question.
        resetLedger()
      } catch {
        /* another tab is holding it — the reload still ends this session */
      }
    }

    // A full reload, not a route change: it is the only way to be certain no
    // shared live listener from this shop survives into the next session.
    window.location.replace('/login')
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, shopId, paidUntil, lapsed, blocked, email, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
