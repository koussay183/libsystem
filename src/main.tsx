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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </StrictMode>,
)
