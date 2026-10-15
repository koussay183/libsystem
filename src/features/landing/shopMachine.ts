/**
 * Is this browser a shop's till, or a visitor?
 *
 * Signed-out visitors opening "/" get the landing page. A shop machine whose
 * session lapsed must not: the cashier wants the login form, not a sales
 * pitch. A machine counts as a shop machine once anybody has signed in on it,
 * or when the app runs installed (PWA standalone window).
 */
const KEY = 'mk:shopMachine'

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
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
