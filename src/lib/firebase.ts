import { initializeApp } from 'firebase/app'
import {
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  connectAuthEmulator,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * True once the owner has pasted real Firebase values into .env.local.
 * Until then the app shows a friendly "setup needed" screen instead of crashing.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
)

// Always initialise with *something* so the exported db/auth are never undefined.
export const app = initializeApp(
  isFirebaseConfigured
    ? firebaseConfig
    : { apiKey: 'not-configured', projectId: 'not-configured', appId: 'not-configured' },
)

/**
 * Real accounts, remembered on the device.
 *
 * browserLocalPersistence is what lets the shop open the till in the morning
 * without signing in again, and — because the ID token is cached with it — what
 * lets them do it before the line is up. See src/auth/AuthContext.tsx for why
 * nothing in the startup path is allowed to wait on the network.
 *
 * initializeAuth rather than getAuth, for what it leaves out: getAuth also
 * wires the popup/redirect resolver, which on phones and Safari loads Google's
 * sign-in iframe (~140 KB from apis.google.com and the auth domain) and makes
 * auth start-up wait for it. The app only ever signs in with email and
 * password, so that is pure delay in front of the first screen.
 *
 * browserLocalPersistence comes first because that is where every existing
 * session lives (the app used to move it there with setPersistence on each
 * start). Firebase looks for a saved user across the whole list and moves one
 * it finds in IndexedDB to the first entry, so no till is signed out by this.
 */
export const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, indexedDBLocalPersistence],
})

/**
 * LOCAL QA ONLY — the Firebase emulators started by scripts/qa/up.sh.
 *
 * `import.meta.env.DEV` is replaced by the literal `false` in a production build
 * (`npm run build`, which is what Netlify runs), so both emulator branches in
 * this file are constant-false there and are dropped from the bundle, host
 * strings included. Setting
 * VITE_USE_EMULATORS on Netlify, or in a .env file, can therefore never point a
 * shop's till at a local emulator. The condition is written out in full at each
 * site, not hoisted into a const, so the dead-code elimination does not depend
 * on the minifier inlining a variable.
 *
 * The auth emulator has to be connected before the auth instance is used for
 * anything.
 */
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}

// ignoreUndefinedProperties lets us pass optional fields as `undefined`
// (e.g. an empty "category") without Firestore throwing.
//
// The IndexedDB cache is what makes the shop feel instant. Without it every
// visit to a page re-downloads the whole stock over a slow connection and the
// screen sits empty meanwhile; with it the products are on screen immediately
// and the network only sends what changed since. It also means the till keeps
// selling through a connection drop — writes queue locally and go up on their
// own once the line is back.
//
// multipleTabManager: the owner often leaves the till open in one tab and the
// stock in another. The single-tab manager would refuse persistence to the
// second tab. Where there is no IndexedDB at all (a locked-down profile), the
// memory cache keeps everything working, just without the speed.
/**
 * Can this browser actually give us a durable cache?
 *
 * `typeof indexedDB === 'undefined'` is not the same question. A locked-down
 * profile, private browsing in some builds, and certain embedded webviews all
 * expose the object and then throw the moment it is opened. Getting that wrong
 * is the worst failure in this file: persistentLocalCache would be selected,
 * its open would fail asynchronously where nothing can catch it, and the app
 * would run on a memory cache while behaving exactly as though sales were being
 * queued durably. Every offline ticket would be lost on the next reload, with
 * nothing on screen to say so.
 *
 * The open() call below is the cheap half of the answer: it catches every
 * implementation that refuses synchronously. A purely asynchronous failure
 * cannot be detected here — see the note in src/lib/syncStatus.ts.
 */
function canPersist(): boolean {
  if (typeof indexedDB === 'undefined') return false
  try {
    const probe = indexedDB.open('lib-persist-probe')
    // Nothing to await: we only care whether asking was allowed at all.
    probe.onsuccess = () => {
      try {
        probe.result.close()
        indexedDB.deleteDatabase('lib-persist-probe')
      } catch {
        /* tidy-up only */
      }
    }
    return true
  } catch {
    return false
  }
}

export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  /**
   * CACHE_SIZE_UNLIMITED, deliberately.
   *
   * The default is 40 MB with LRU garbage collection, and GC evicts documents
   * that no listener currently pins. liveCollection unpins a collection 30 s
   * after its last unmount, and the raw onSnapshot hooks drop their target at
   * once — so on a till that has been offline for days, a product the owner has
   * not looked at recently can be evicted and then cannot be re-fetched,
   * because there is no network to re-fetch it from. Queued writes are never
   * evicted, so this is not about losing sales; it is about the catalogue
   * quietly developing holes in the middle of a long outage.
   *
   * A whole shop is on the order of a megabyte (817 documents measured), so
   * removing the ceiling costs nothing real and removes the failure entirely.
   */
  localCache: canPersist()
    ? persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      })
    : memoryLocalCache(),
})

// LOCAL QA ONLY — see the note on connectAuthEmulator above. Must run before
// the first read or write, which it does: nothing has used `db` yet.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === '1') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
