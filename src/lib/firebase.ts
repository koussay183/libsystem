import { initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'

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

// ignoreUndefinedProperties lets us pass optional fields as `undefined`
// (e.g. an empty "category") without Firestore throwing.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
export const auth = getAuth(app)

// Keep the owner logged in across restarts (he logs in once).
if (isFirebaseConfigured) {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    /* non-fatal: falls back to in-memory persistence */
  })
}
