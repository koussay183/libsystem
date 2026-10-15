/**
 * Everything that goes in the <head> of the prerendered public pages, plus
 * robots.txt and sitemap.xml. Build time only (prerender.tsx); the app never
 * imports it.
 *
 * Every word and price comes from copy.ts, so the visible page, the link
 * previews (WhatsApp, Facebook) and the structured data cannot disagree. The
 * site's origin is passed in (VITE_SITE_URL, see vite.config.ts) because it
 * will change once mektebti.tn is bought, and only the marketing URLs may move
 * then — never the till's.
 */
import { CONTACT, LANDING_COPY, LANDING_PATH, PRICES } from './copy'
import type { Lang } from './copy'
import type { LegalDoc } from './legal/content'

export interface SiteOptions {
  /** e.g. https://libsystem-tn.netlify.app — no trailing slash. */
  site: string
  /** Search Console / Bing Webmaster tokens, when the founder has them. */
  googleVerification?: string
  bingVerification?: string
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const meta = (attr: 'name' | 'property', key: string, content: string) =>
  `<meta ${attr}="${key}" content="${esc(content)}">`

/** JSON inside <script>: "</" must not end the element. */
const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

function common(o: SiteOptions): string[] {
  const out = [
    '<meta name="theme-color" content="#1800ac">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/brand/favicon-16.png">',
    '<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">',
  ]
  if (o.googleVerification) out.push(meta('name', 'google-site-verification', o.googleVerification))
  if (o.bingVerification) out.push(meta('name', 'msvalidate.01', o.bingVerification))
  return out
}

const OG_LOCALE: Record<Lang, string> = { fr: 'fr_FR', ar: 'ar_AR' }
const PHONE_LD = `+216-${CONTACT.whatsapp.replace(/(\d{2})(\d{3})(\d{3})/, '$1-$2-$3')}`
/** TND carries three decimals, like every amount in the app (src/lib/money.ts). */
const tnd = (n: number) => n.toFixed(3)

function structuredData(lang: Lang, o: SiteOptions) {
  const c = LANDING_COPY[lang]
  const url = o.site + LANDING_PATH[lang]
  const org = `${o.site}/#org`
  const duration: Record<string, string | undefined> = { month: 'P1M', year: 'P1Y', life: undefined }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': org,
        name: 'Mektebti.tn',
        alternateName: 'مكتبتي',
        url: o.site + LANDING_PATH.fr,
        logo: `${o.site}/brand/icon-512.png`,
        areaServed: { '@type': 'Country', name: 'Tunisie' },
        contactPoint: [
          {
            '@type': 'ContactPoint',
            telephone: PHONE_LD,
            contactType: 'sales',
            areaServed: 'TN',
            availableLanguage: ['fr', 'ar'],
          },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${o.site}/#website`,
        url: o.site + LANDING_PATH.fr,
        name: 'Mektebti.tn',
        publisher: { '@id': org },
        inLanguage: ['fr-TN', 'ar-TN'],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${o.site}/#app`,
        name: 'Mektebti',
        url,
        description: c.seo.description,
        image: `${o.site}/brand/og-image-${lang}.png`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web (Chrome, Edge)',
        inLanguage: ['fr', 'ar'],
        publisher: { '@id': org },
        featureList: c.features.items.map(([, title]) => title),
        // No aggregateRating: there are no public reviews yet, and inventing
        // one is exactly what gets a site's rich results pulled.
        offers: c.pricing.plans.map((p) => {
          const price = tnd(PRICES[p.id])
          const billing = duration[p.id]
          return {
            '@type': 'Offer',
            name: p.name,
            price,
            priceCurrency: 'TND',
            ...(p.note ? { description: p.note } : null),
            ...(billing
              ? {
                  priceSpecification: {
                    '@type': 'UnitPriceSpecification',
                    price,
                    priceCurrency: 'TND',
                    billingDuration: billing,
                  },
                }
              : null),
          }
        }),
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        inLanguage: lang === 'ar' ? 'ar-TN' : 'fr-TN',
        // Word for word the visible questions: the markup must describe the page.
        mainEntity: c.faq.items.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  }
}

export function landingHead(lang: Lang, o: SiteOptions): string {
  const c = LANDING_COPY[lang]
  const url = o.site + LANDING_PATH[lang]
  const image = `${o.site}/brand/og-image-${lang}.png`
  const other: Lang = lang === 'ar' ? 'fr' : 'ar'
  return [
    `<title>${esc(c.seo.title)}</title>`,
    meta('name', 'description', c.seo.description),
    `<link rel="canonical" href="${url}">`,
    `<link rel="alternate" hreflang="fr-TN" href="${o.site + LANDING_PATH.fr}">`,
    `<link rel="alternate" hreflang="ar-TN" href="${o.site + LANDING_PATH.ar}">`,
    `<link rel="alternate" hreflang="x-default" href="${o.site + LANDING_PATH.fr}">`,
    meta('name', 'robots', 'index,follow,max-image-preview:large'),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'Mektebti.tn'),
    meta('property', 'og:title', c.seo.ogTitle),
    meta('property', 'og:description', c.seo.ogDescription),
    meta('property', 'og:url', url),
    meta('property', 'og:image', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', c.seo.ogImageAlt),
    meta('property', 'og:locale', OG_LOCALE[lang]),
    meta('property', 'og:locale:alternate', OG_LOCALE[other]),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', c.seo.ogTitle),
    meta('name', 'twitter:description', c.seo.ogDescription),
    meta('name', 'twitter:image', image),
    ...common(o),
    jsonLd(structuredData(lang, o)),
  ].join('\n    ')
}

/**
 * The legal pages are drafts with [placeholders] in them: reachable from the
 * footer, but kept out of search results until a lawyer has signed them off.
 */
export function legalHead(doc: LegalDoc, o: SiteOptions): string {
  return [
    `<title>${esc(doc.title)} | Mektebti.tn</title>`,
    meta('name', 'description', doc.description),
    `<link rel="canonical" href="${o.site + doc.path}">`,
    meta('name', 'robots', 'noindex,follow'),
    ...common(o),
  ].join('\n    ')
}

/** The app's own routes: private screens behind a login, nothing to index. */
const APP_ROUTES = [
  '/login',
  '/caisse',
  '/catalog',
  '/stock',
  '/packs',
  '/invoices',
  '/suppliers',
  '/credit',
  '/dashboard',
  '/reports',
  '/backup',
  '/settings',
]

export function robotsTxt(site: string): string {
  return [
    'User-agent: *',
    ...APP_ROUTES.map((r) => `Disallow: ${r}`),
    // The raw prerendered files; their public URLs are the rewrites in netlify.toml.
    'Disallow: /_m/',
    '',
    `Sitemap: ${site}/sitemap.xml`,
    '',
  ].join('\n')
}

export function sitemapXml(site: string, lastmod: string): string {
  const alternates = (['fr', 'ar'] as Lang[])
    .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}-TN" href="${site + LANDING_PATH[l]}"/>`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${site + LANDING_PATH.fr}"/>`)
    .join('\n')
  const urls = (['fr', 'ar'] as Lang[]).map(
    (l) => `  <url>\n    <loc>${site + LANDING_PATH[l]}</loc>\n${alternates}\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    // The legal pages join once they are final (they are noindex drafts today).
    '</urlset>',
    '',
  ].join('\n')
}
