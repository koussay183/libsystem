import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import '@/i18n'
import './index.css'
import { system } from './theme'
import { App } from './App'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </StrictMode>,
)
