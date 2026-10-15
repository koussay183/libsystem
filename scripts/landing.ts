import type { Plugin } from 'vite'
import { build } from 'vite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Prerenders the public pages (the landing in French and Arabic, the legal
 * pages) to static HTML at build time.
 *
 * Why: the landing used to be a route of the till itself, so a prospect
 * tapping an ad on a phone downloaded the whole shop app (~380 KB gzipped:
 * Chakra, Firebase, both dictionaries), installed its service worker, and saw
 * a spinner until it booted. Crawlers and WhatsApp/Facebook link previews,
 * which run no JavaScript, saw nothing at all. Now Netlify serves finished
 * HTML with its CSS inlined, real text, all the head tags, and one small
 * script (src/features/landing/static.ts).
 *
 * The same LandingPage component still renders inside the app at /decouvrir:
 * that is what a shop machine gets offline, from the service worker's cache.
 *
 * One rule protects the tills: these pages must never carry the app's entry
 * script. The service worker would take such a page for the till's shell
 * (scripts/pwa.ts, isOurBuild) and a till could then boot offline on a sales
 * page. The template only loads static.ts, and the worker lets these routes
 * through without caching them.
 */

/** Rollup input for the template, also its key in the bundle. */
export const LANDING_TEMPLATE = 'src/features/landing/static.html'
const SSR_ENTRY = 'src/features/landing/prerender.tsx'
/** The lazy chunk whose stylesheet the static pages inline. */
const STYLED_BY = 'src/features/landing/LandingPage.tsx'

/**
 * The public routes. Also listed in netlify.toml (the rewrites),
 * src/features/landing/shopMachine.ts (PUBLIC_PATHS, for tags and the service
 * worker registration) and read by scripts/pwa.ts. The build checks the first
 * two against what was actually rendered.
 */
export const PUBLIC_ROUTES = ['/decouvrir', '/ar/decouvrir', '/mentions-legales', '/confidentialite', '/cgv']

export interface LandingOptions {
  /** Canonical origin, no trailing slash. */
  site: string
  googleVerification?: string
  bingVerification?: string
}

interface StaticPage {
  route: string
  file: string
  lang: 'fr' | 'ar'
  head: string
  body: string
}

interface PrerenderModule {
  renderStaticPages(o: LandingOptions): StaticPage[]
  robotsTxt(site: string): string
  sitemapXml(site: string, lastmod: string): string
}

interface BundleFile {
  type: string
  fileName: string
  source?: string | Uint8Array
  facadeModuleId?: string | null
  moduleIds?: string[]
  viteMetadata?: { importedCss?: Set<string> }
}

/** The page frame the inlined stylesheet sits on (index.html does this for the app). */
const BASE_CSS = 'html,body{margin:0;background:#f7f7fb}'

export function staticLanding(opts: LandingOptions): Plugin {
  let root = ''
  let mode = 'production'

  return {
    name: 'mektebti-static-landing',
    apply: 'build',
    // After Vite's HTML plugin, so the template already carries the hashed
    // script tag of static.ts.
    enforce: 'post',
    configResolved(config) {
      root = config.root
      mode = config.mode
    },
    async generateBundle(_options, output) {
      const bundle = output as unknown as Record<string, BundleFile>
      const template = bundle[LANDING_TEMPLATE]
      if (!template || template.type !== 'asset') {
        this.error(`static landing: ${LANDING_TEMPLATE} is not in the bundle (rollupOptions.input?)`)
      }
      const html = String(template.source)
      // The template itself is not a page anyone should reach.
      delete bundle[LANDING_TEMPLATE]
      if (html.includes('/src/main.tsx') || /assets\/index-[\w-]+\.js/.test(html)) {
        this.error('static landing: the template references the app entry; see the note at the top of scripts/landing.ts')
      }

      const css = stylesheetOf(bundle, resolve(root, STYLED_BY))
      if (!css) this.error(`static landing: no stylesheet found for ${STYLED_BY}`)

      const mod = await loadPrerender(root, mode)
      const pages = mod.renderStaticPages(opts)
      checkRoutes(
        pages.map((p) => p.route),
        root,
        (msg) => this.error(msg),
      )

      for (const p of pages) {
        // Function replacers: page text may contain "$&"-like sequences.
        const out = html
          .replace('lang="mk-lang"', () => `lang="${p.lang}"`)
          .replace('dir="mk-dir"', () => `dir="${p.lang === 'ar' ? 'rtl' : 'ltr'}"`)
          .replace('<!--mk:head-->', () => `${p.head}\n    <style>${BASE_CSS}${css}</style>`)
          .replace('<!--mk:body-->', () => p.body)
        this.emitFile({ type: 'asset', fileName: p.file, source: out })
      }

      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: mod.robotsTxt(opts.site) })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: mod.sitemapXml(opts.site, new Date().toISOString().slice(0, 10)),
      })
    },
  }
}

/** The CSS Vite extracted for one source module's chunk, already minified. */
function stylesheetOf(bundle: Record<string, BundleFile>, moduleId: string): string {
  const chunk = Object.values(bundle).find(
    (f) => f.type === 'chunk' && (f.facadeModuleId === moduleId || f.moduleIds?.includes(moduleId)),
  )
  let css = ''
  for (const name of chunk?.viteMetadata?.importedCss ?? []) {
    const asset = bundle[name]
    if (asset?.source) css += String(asset.source)
  }
  return css
}

/**
 * Compiles prerender.tsx for Node in a throwaway build (no config file, so
 * neither this plugin nor the service worker runs again), then imports it.
 * Everything is bundled in, so the output has no packages to resolve.
 */
async function loadPrerender(root: string, mode: string): Promise<PrerenderModule> {
  const outDir = mkdtempSync(join(tmpdir(), 'mk-prerender-'))
  try {
    await build({
      configFile: false,
      root,
      mode,
      logLevel: 'warn',
      publicDir: false,
      resolve: { alias: { '@': resolve(root, 'src') } },
      esbuild: { jsx: 'automatic' },
      ssr: { noExternal: true },
      build: {
        ssr: resolve(root, SSR_ENTRY),
        outDir,
        emptyOutDir: true,
        minify: false,
        copyPublicDir: false,
        reportCompressedSize: false,
        rollupOptions: { output: { format: 'es', entryFileNames: 'prerender.mjs' } },
      },
    })
    return (await import(pathToFileURL(join(outDir, 'prerender.mjs')).href)) as PrerenderModule
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
}

/**
 * A page that renders but is not rewritten in netlify.toml is a 404 in
 * production (or worse, the app's shell); one missing from PUBLIC_PATHS gets
 * the service worker and no tags. Both are easy to forget, so fail the build.
 */
function checkRoutes(routes: string[], root: string, fail: (msg: string) => void) {
  const toml = readFileSync(join(root, 'netlify.toml'), 'utf8')
  const client = readFileSync(join(root, 'src/features/landing/shopMachine.ts'), 'utf8')
  for (const route of routes) {
    if (!PUBLIC_ROUTES.includes(route)) fail(`static landing: ${route} missing from PUBLIC_ROUTES in scripts/landing.ts`)
    if (!new RegExp(`from\\s*=\\s*"${route}"`).test(toml)) fail(`static landing: no rewrite for ${route} in netlify.toml`)
    if (!client.includes(`'${route}'`)) fail(`static landing: ${route} missing from PUBLIC_PATHS in shopMachine.ts`)
  }
}
