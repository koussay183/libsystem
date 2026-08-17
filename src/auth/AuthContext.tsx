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
import { syncStore } from '@/lib/syncStatus'

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
  /** The account has a shop but its plan has run out: reads work, writes do not. */
  lapsed: boolean
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

export function AuthProvider({ children }: { children: ReactNode }) {
  // Seeded from disk so the very first render already knows whether to show
  // the till or the login screen, with or without a connection.
  const [user, setUser] = useState<boolean>(() => readUid() !== '')
  const [shopId, setShop] = useState<string>(() => currentShopId())
  const [paidUntil, setPaidUntil] = useState<number | null>(() => readPaidUntil())
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

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
        clearShopId()
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
            setShopId(next)
            window.location.reload()
            return
          }
          if (next !== '') setShopId(next)
          else clearShopId()
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
      setShopId(claims.shopId)
      setShop(claims.shopId)
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
    clearShopId()

    if (safeToWipe) {
      try {
        // terminate() first: the instance was created with persistentLocalCache
        // and is already in use, and clearIndexedDbPersistence refuses on a
        // live instance.
        await terminate(db)
        await clearIndexedDbPersistence(db)
      } catch {
        /* another tab is holding it — the reload still ends this session */
      }
    }

    // A full reload, not a route change: it is the only way to be certain no
    // shared live listener from this shop survives into the next session.
    window.location.replace('/login')
  }

  const lapsed = shopId !== '' && paidUntil !== null && paidUntil < Date.now()

  return (
    <AuthContext.Provider
      value={{ user, loading, shopId, paidUntil, lapsed, email, login, logout }}
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
