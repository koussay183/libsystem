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
    // Skipping the gzip pass makes `npm run build` noticeably quicker and
    // changes nothing about what ships.
    reportCompressedSize: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // The shop runs this on a modest PC over a Tunisian connection. Split
        // the big vendors so a code change only invalidates the app chunk and
        // the browser keeps the rest from cache.
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/firestore'],
          chakra: ['@chakra-ui/react', '@emotion/react'],
          i18n: ['i18next', 'react-i18next'],
          // Charting is only ever needed by the dashboard. Pinning it to its
          // own chunk keeps it out of the till's download entirely.
          charts: ['recharts'],
        },
      },
    },
  },
})
