/**
 * Service worker registration.
 *
 * The worker itself is generated at build time by scripts/pwa.ts. Its whole
 * job is to make the app open with no internet: the browser cannot fetch
 * index.html or the JavaScript chunks over a dead line, and Firestore's
 * offline cache only helps once the app is already running.
 *
 * A new version deliberately does NOT take over on its own — swapping the
 * JavaScript underneath a half-finished sale is not a trade worth making. It
 * waits, the owner is offered a button, and it applies on the next full load
 * at the latest.
 */

const watchers = new Set<() => void>()
let waiting: ServiceWorker | null = null

function publish(sw: ServiceWorker | null) {
  waiting = sw
  for (const notify of watchers) notify()
}

export const updateStore = {
  subscribe(onChange: () => void) {
    watchers.add(onChange)
    return () => {
      watchers.delete(onChange)
    }
  },
  getSnapshot: () => waiting,
}

/** Applies the waiting version and reloads once it has taken control. */
export function applyUpdate() {
  const sw = waiting
  if (!sw) return
  // Reload only when the new worker is actually in charge, otherwise the page
  // comes back on the old one and the button looks broken.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
  sw.postMessage({ type: 'SKIP_WAITING' })
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // Only the built app has a worker; in dev it would serve stale modules and
  // fight Vite's own reloading.
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (reg.waiting) publish(reg.waiting)

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            // "installed" with a controller already present means a NEW
            // version is ready behind the one currently running. Without a
            // controller it is simply the first install — nothing to announce.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              publish(installing)
            }
          })
        })

        // A shop PC is left open for days; check for a new version when the
        // owner comes back to the tab rather than only on a cold start.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => {})
        })
      })
      .catch(() => {
        /* no worker: the app still runs, it just will not open offline */
      })
  })
}
