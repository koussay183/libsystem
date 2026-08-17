import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import '@/i18n'
import './index.css'
import { system } from './theme'
import { App } from './App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { registerServiceWorker } from '@/lib/serviceWorker'

// Makes the app open with no internet at all. Registered before render so a
// cold start on a dead line still has a worker to serve the shell next time.
registerServiceWorker()

/**
 * Ask the browser not to throw our storage away.
 *
 * Firestore's offline queue lives in IndexedDB, and IndexedDB is evictable by
 * default: Chrome and Android clear it under storage pressure, and iOS Safari
 * deletes script-writable storage for a site left unused for seven days. For an
 * ordinary web page that is a cache miss. For this app it is a week of sales a
 * shop has already taken money for.
 *
 * persist() is a request, not a guarantee — browsers grant it based on
 * engagement, and an installed PWA usually gets it. It is fire-and-forget on
 * purpose: the answer changes nothing we would do differently, and awaiting it
 * would put an IndexedDB round trip in front of the first paint.
 */
void navigator.storage?.persist?.().catch(() => {})

/**
 * The black box recorder, and the only forensic record this app has.
 *
 * There is no telemetry here — no Sentry, no logging endpoint — so when the
 * owner telephones to say "it did something strange this morning", the browser
 * console is all there is. React's error boundaries cover the render phase and
 * nothing else, and two of the most likely throws in this app are outside it:
 *
 *  · The barcode wedge listens on `window` for keydown. A throw inside a native
 *    listener is reported to the global handler and never passes through React,
 *    so no boundary can see it, and by the DOM spec it does not even propagate
 *    back to whatever dispatched the event.
 *  · Every Firestore write in the app is now fire-and-forget. Those rejections
 *    are consumed on purpose, but any that is ever missed lands here rather than
 *    vanishing.
 *
 * Only console.error, and nothing that can itself throw: a logger that fails
 * while logging a failure is worse than no logger. The timestamp is written
 * explicitly because the console's own is lost the moment the owner copies the
 * text into a message.
 */
window.addEventListener('error', (e) => {
  console.error('[lib-manager] uncaught', new Date().toISOString(), e.message, e.error?.stack ?? '')
})
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason as { message?: string; stack?: string; code?: string } | undefined
  console.error(
    '[lib-manager] unhandled rejection',
    new Date().toISOString(),
    reason?.code ?? '',
    reason?.message ?? String(e.reason),
    reason?.stack ?? '',
  )
})

/**
 * The outermost boundary, deliberately outside the router and outside
 * AuthProvider.
 *
 * There is a second boundary around the routed pages (App.tsx), and that is the
 * one that normally catches, because it leaves the navigation on screen. This
 * one exists for everything above it: a throw in AuthProvider, in RequireAuth,
 * in AppShell's own render, or in BrowserRouter itself. Without it those still
 * unmount the root to a white page, which offline is a shop that cannot sell.
 *
 * It sits INSIDE ChakraProvider because the fallback is built from Chakra
 * components and needs the design system; there is nothing in ChakraProvider
 * itself that renders shop data, so it is not a plausible source of a throw.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <ErrorBoundary where="root" fullScreen>
        <App />
      </ErrorBoundary>
    </ChakraProvider>
  </StrictMode>,
)
