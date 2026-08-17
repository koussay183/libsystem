/**
 * Service worker registration.
 *
 * The worker itself is generated at build time by scripts/pwa.ts. Its whole
 * job is to make the app open with no internet: the browser cannot fetch
 * index.html or the JavaScript chunks over a dead line, and Firestore's
 * offline cache only helps once the app is already running.
 *
 * A new version deliberately does NOT take over on its own — swapping the
 * JavaScript underneath a half-finished sale is not a trade worth making, and
 * one page holding chunks from two different builds is worse than a page
 * holding yesterday's build.
 *
 * What that costs is worth stating exactly, because the comment here used to
 * say the update "applies on the next full load at the latest" and that is
 * simply false: a waiting worker is promoted only once every tab it would
 * control is CLOSED. A reload does not do it. The till's tab is open from
 * morning to night, so on that machine the banner is not decoration — it is
 * the only update path the shop has short of closing the browser.
 */

const watchers = new Set<() => void>()
let waiting: ServiceWorker | null = null
let stale = false
/**
 * Whether this page was already under a worker's control when it loaded. A
 * controllerchange from "no worker" to one is just the first install claiming a
 * page that started uncontrolled, which is normal and silent; a change from one
 * worker to another means somebody else's tab accepted an update. See staleStore.
 */
let controlledAtLoad = false
/** Set by applyUpdate so the controllerchange it causes is not read as staleness. */
let applying = false

function notify() {
  for (const listener of watchers) listener()
}

function publish(sw: ServiceWorker | null) {
  waiting = sw
  notify()
}

function subscribe(onChange: () => void) {
  watchers.add(onChange)
  return () => {
    watchers.delete(onChange)
  }
}

/** The new build that is installed and waiting for permission to take over. */
export const updateStore = {
  subscribe,
  getSnapshot: () => waiting,
}

/**
 * "This tab is running a build that has already been replaced."
 *
 * Only reachable with more than one tab open, which a shop PC does have. When
 * another tab accepts the update, the new worker calls skipWaiting and then
 * clients.claim(), and its activate() deletes the previous cache version. THIS
 * page keeps running its old chunks, and the first time it needs one it has not
 * already loaded — any lazy route — the request misses a cache that no longer
 * holds it and a server that no longer serves that fingerprinted name.
 *
 * Nothing is reloaded from under whatever sale is on screen: the page still
 * works, so the owner is told and reloads when the counter is clear.
 */
export const staleStore = {
  subscribe,
  getSnapshot: () => stale,
}

/**
 * Applies the waiting version and reloads once it has taken control.
 *
 * The owner's decision and nobody else's: this is the only caller of
 * SKIP_WAITING, so a build never swaps itself in mid-sale. Offer it from a
 * button, never from an effect, and never while a basket is open.
 */
export function applyUpdate() {
  const sw = waiting
  if (!sw) return
  // One click, one reload. The listener used to be added on every call, so a
  // second click reloaded the page twice.
  if (applying) return
  applying = true

  if (sw.state === 'redundant') {
    // Superseded by an even newer build while the banner sat on screen: nothing
    // is listening for SKIP_WAITING any more. Reload rather than leave a button
    // that does nothing; registration then starts from whatever is installed.
    window.location.reload()
    return
  }

  // If the message is never answered — a worker that died between the banner
  // being drawn and the click — reload anyway. The owner has already accepted
  // losing what is on screen, and a button that visibly does nothing sends him
  // to the browser's reload button instead, which is one keystroke away from
  // the hard reload that bypasses the worker completely (scripts/pwa.ts).
  const fallback = window.setTimeout(() => window.location.reload(), 3000)
  // Reload only when the new worker is actually in charge, otherwise the page
  // comes back on the old one and the button looks broken.
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      window.clearTimeout(fallback)
      window.location.reload()
    },
    { once: true },
  )
  sw.postMessage({ type: 'SKIP_WAITING' })
}

/**
 * Watches one worker and keeps the banner honest about it: announced once it is
 * installed and waiting, withdrawn the moment it can no longer be applied.
 *
 * Withdrawing matters as much as announcing. A worker superseded by a newer
 * build ("redundant"), or one that has already taken over ("activated"), will
 * never answer SKIP_WAITING — and a banner whose button does nothing is worse
 * than no banner at all.
 */
function follow(sw: ServiceWorker, isUpdate: boolean) {
  const settle = () => {
    if (sw.state === 'installed') {
      if (isUpdate) publish(sw)
    } else if ((sw.state === 'redundant' || sw.state === 'activated') && waiting === sw) {
      publish(null)
    }
  }
  // Run once straight away: the state can have moved on between the event that
  // got us here and this listener being attached, and statechange would then
  // never fire for that state again.
  settle()
  sw.addEventListener('statechange', settle)
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // Only the built app has a worker; in dev it would serve stale modules and
  // fight Vite's own reloading.
  if (import.meta.env.DEV) return

  // Read before anything can change it — see the note on controlledAtLoad.
  controlledAtLoad = navigator.serviceWorker.controller !== null

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) return // our own doing; applyUpdate has the reload in hand
    if (!controlledAtLoad) return // the first install claiming an empty page
    stale = true
    notify()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Already waiting when this page loaded: the owner ignored the banner
        // before the last reload, or another tab installed it. A worker can only
        // be "waiting" while an older one is active, so this is always an update
        // and never a first install.
        if (reg.waiting) follow(reg.waiting, true)

        reg.addEventListener('updatefound', () => {
          // reg.active is the version currently in charge, and its presence is
          // what makes this an update rather than the very first install. It is
          // read here rather than navigator.serviceWorker.controller because a
          // page that came up through a hard reload is not controlled by
          // anything (scripts/pwa.ts) and would otherwise never be offered the
          // update it can perfectly well apply.
          const isUpdate = reg.active !== null
          // installing is normally the new worker; if it has already moved on by
          // the time this fires, reg.waiting is it.
          const next = reg.installing || reg.waiting
          if (next) follow(next, isUpdate)
        })

        // A shop PC is left open for days; check for a new version when the
        // owner comes back to the tab rather than only on a cold start.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => {})
        })

        // And when the line comes back after hours or days down — on this
        // connection that is more often the first chance the browser has had to
        // see a new sw.js at all.
        window.addEventListener('online', () => {
          void reg.update().catch(() => {})
        })
      })
      .catch(() => {
        /* no worker: the app still runs, it just will not open offline */
      })
  })
}
