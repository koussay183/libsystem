import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
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
 * setPersistence is not awaited: it resolves against IndexedDB, and the default
 * is already local, so awaiting it would only delay the first paint.
 */
export const auth = getAuth(app)
void setPersistence(auth, browserLocalPersistence).catch(() => {})

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
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache:
    typeof indexedDB === 'undefined'
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
