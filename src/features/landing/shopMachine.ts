/**
 * Is this browser a shop's till, or a visitor?
 *
 * Signed-out visitors opening "/" get the landing page. A shop machine whose
 * session lapsed must not: the cashier wants the login form, not a sales
 * pitch. A machine counts as a shop machine once anybody has signed in on it,
 * or when the app runs installed (PWA standalone window).
 *
 * The same answer also keeps marketing tags off the till (src/lib/analytics.ts)
 * and keeps the service worker off a prospect's phone (src/main.tsx). The
 * inline script in index.html repeats these checks by hand, because it has to
 * run before any module loads: keep the keys in step with it.
 */
const KEY = 'mk:shopMachine'

/** Written by AuthContext on every signed-in start (UID_KEY there). */
const UID_KEY = 'lib.uid.v1'
/** Firebase's own session record in localStorage (browserLocalPersistence). */
const FIREBASE_SESSION_PREFIX = 'firebase:authUser:'

export function markShopMachine() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* private mode — the login page is one click away anyway */
  }
}

export function isShopMachine(): boolean {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true
    return localStorage.getItem(KEY) === '1' || hasSessionHere()
  } catch {
    return false
  }
}

/**
 * Somebody is (or was, until a sign-out) signed in in this browser.
 *
 * Read from storage rather than from Firebase so it can be answered without
 * loading Firebase at all, which the public pages never do.
 */
export function hasSessionHere(): boolean {
  try {
    if (localStorage.getItem(UID_KEY)) return true
    for (let i = 0; i < localStorage.length; i += 1) {
      if (localStorage.key(i)?.startsWith(FIREBASE_SESSION_PREFIX)) return true
    }
  } catch {
    /* storage blocked: nothing can have been remembered either */
  }
  return false
}

/**
 * The public pages: prerendered at build time (scripts/landing.ts), rewritten
 * to in netlify.toml, and let through untouched by the service worker. Tags may
 * only ever run on these.
 */
export const PUBLIC_PATHS = ['/decouvrir', '/ar/decouvrir', '/mentions-legales', '/confidentialite', '/cgv']

export function isPublicPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return PUBLIC_PATHS.includes(path)
}
