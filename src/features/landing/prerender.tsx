import { renderToStaticMarkup } from 'react-dom/server'
import { LandingPage } from './LandingPage'
import { LegalPage } from './legal/LegalPage'
import { LEGAL_DOCS } from './legal/content'
import { LANDING_PATH } from './copy'
import type { Lang } from './copy'
import { landingHead, legalHead, robotsTxt, sitemapXml } from './seo'
import type { SiteOptions } from './seo'

/**
 * Build-time entry (scripts/landing.ts): the public pages as finished HTML.
 *
 * renderToStaticMarkup, not renderToString: nothing ever hydrates these pages.
 * Their only script is static.ts, which works on the markup as it is.
 */

export interface StaticPage {
  /** Public URL, e.g. /ar/decouvrir — what netlify.toml rewrites. */
  route: string
  /** Where the file is written in dist, e.g. _m/decouvrir-ar.html. */
  file: string
  lang: Lang
  head: string
  body: string
}

export function renderStaticPages(o: SiteOptions): StaticPage[] {
  const landing = (['fr', 'ar'] as Lang[]).map((lang) => ({
    route: LANDING_PATH[lang],
    file: `_m/decouvrir-${lang}.html`,
    lang,
    head: landingHead(lang, o),
    body: renderToStaticMarkup(<LandingPage lang={lang} />),
  }))
  const legal = LEGAL_DOCS.map((doc) => ({
    route: doc.path,
    file: `_m${doc.path}.html`,
    lang: 'fr' as Lang,
    head: legalHead(doc, o),
    body: renderToStaticMarkup(<LegalPage doc={doc} />),
  }))
  return [...landing, ...legal]
}

export { robotsTxt, sitemapXml }
