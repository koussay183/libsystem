import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // The shop runs this on a modest PC over a Tunisian connection. Split
        // the three big vendors so a code change only invalidates the app
        // chunk and the browser keeps the rest from cache.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          chakra: ['@chakra-ui/react', '@emotion/react'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
})
