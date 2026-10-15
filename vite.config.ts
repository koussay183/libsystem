import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { shopServiceWorker } from './scripts/pwa'
import { LANDING_TEMPLATE, staticLanding } from './scripts/landing'

/**
 * The public origin the marketing pages call canonical (link previews,
 * sitemap, structured data). One value, from VITE_SITE_URL, because it will
 * change once mektebti.tn is bought. Only marketing URLs may follow it: the
 * tills stay on libsystem-tn.netlify.app, where their offline data lives
 * (docs/launch/07-web-launch-notes.md).
 */
const DEFAULT_SITE_URL = 'https://libsystem-tn.netlify.app'

/** Without these the till builds fine and then shows "setup needed" to every shop. */
const FIREBASE_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

/** Absolute URLs in index.html's link-preview tags. */
function siteUrlInHtml(site: string): Plugin {
  return {
    name: 'mektebti-site-url',
    transformIndexHtml: (html) => html.replaceAll('%MK_SITE_URL%', site),
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // A green Netlify deploy used to be able to ship a till with no data at all:
  // the values live only in the Netlify UI and a build without them succeeds.
  // Fail loudly there. Only on Netlify, so a local `npm run build` still works.
  if (command === 'build' && process.env.NETLIFY) {
    const missing = FIREBASE_ENV.filter((k) => !env[k])
    if (missing.length > 0) {
      throw new Error(
        `Refusing to build: ${missing.join(', ')} not set for this Netlify context. ` +
          'The tills would open on the "setup needed" screen. Set them in Project configuration > Environment variables.',
      )
    }
  }

  const site = (env.VITE_SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, '')

  return {
    plugins: [
      react(),
      shopServiceWorker(),
      staticLanding({
        site,
        googleVerification: env.VITE_GOOGLE_SITE_VERIFICATION,
        bingVerification: env.VITE_BING_SITE_VERIFICATION,
      }),
      siteUrlInHtml(site),
    ],
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
        // The till (index.html) and the template of the prerendered public
        // pages (scripts/landing.ts), which share nothing heavy.
        input: {
          index: fileURLToPath(new URL('./index.html', import.meta.url)),
          landing: fileURLToPath(new URL(`./${LANDING_TEMPLATE}`, import.meta.url)),
        },
        output: {
          // The shop runs this on a modest PC over a Tunisian connection. Split
          // the big vendors so a code change only invalidates the app chunk and
          // the browser keeps the rest from cache.
          //
          // A function, not the object form: the object form left React's core
          // and jsx-runtime inside the chakra chunk, so every JSX chunk, the
          // landing included, had to download Chakra just to render a <div>.
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return 'react'
            if (/node_modules\/(@chakra-ui|@emotion|@ark-ui|@zag-js|@pandacss|@floating-ui|@internationalized|@swc)\//.test(id))
              return 'chakra'
            if (/node_modules\/(firebase|@firebase|idb)\//.test(id)) return 'firebase'
            if (/node_modules\/(i18next|react-i18next)\//.test(id)) return 'i18n'
            // Charting is only ever needed by the dashboard. Kept narrow on
            // purpose: wider patterns pulled it into the till's first download.
            if (/node_modules\/(recharts|recharts-scale|victory-vendor|d3-[a-z]+|react-smooth|decimal\.js-light)\//.test(id))
              return 'charts'
          },
        },
      },
    },
  }
})
