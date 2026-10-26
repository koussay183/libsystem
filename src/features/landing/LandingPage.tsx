import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ScanBarcode,
  Package,
  NotebookPen,
  Boxes,
  Truck,
  TrendingUp,
  Check,
  Minus,
  X,
  Languages,
  Wrench,
  Database,
  ShoppingCart,
  ArrowRight,
  Phone,
  ChevronDown,
  Calculator,
  WifiOff,
  MonitorSmartphone,
  Sparkles,
  CloudUpload,
  RefreshCw,
  MessageCircle,
} from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { CONTACT, LANDING_COPY, LANDING_PATH } from './copy'
import type { Lang, LandingCopy, Mark } from './copy'
import './landing.css'

/**
 * The public page a visitor sees on the bare domain.
 *
 * Styled with Tailwind (utilities scoped under `.mk`, see tailwind.config.js)
 * and illustrated with real screenshots of the app (public/landing/*.webp with
 * a PNG fallback), so a prospect sees the actual product, not a drawing of it.
 *
 * Rendered twice, from the same component:
 *  · at build time, to static HTML (prerender.tsx), which is what Netlify
 *    serves at /decouvrir and /ar/decouvrir — no React, Firebase or Chakra on
 *    the visitor's phone, and real text for crawlers and WhatsApp previews;
 *  · inside the app, at the SPA's /decouvrir route, which a shop machine only
 *    reaches offline (the service worker answers with the cached app).
 * So nothing here may depend on JavaScript: every control is a real link, and
 * the `data-mk` attributes are hooks for static.ts (tracking), not behaviour.
 */

const FEATURE_ICONS: Record<string, LucideIcon> = {
  scan: ScanBarcode,
  pack: Package,
  carnet: NotebookPen,
  stock: Boxes,
  supplier: Truck,
  profit: TrendingUp,
}
const FACT_ICONS: LucideIcon[] = [Calculator, WifiOff, Languages, MonitorSmartphone]
const STEP_ICONS: LucideIcon[] = [Wrench, Database, ShoppingCart]

const ext = { target: '_blank', rel: 'noopener noreferrer' }

export function waLink(text: string) {
  return `https://wa.me/216${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`
}

const TEL = `tel:+216${CONTACT.whatsapp}`
const PHONE_LABEL = `+216 ${CONTACT.whatsapp.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3')}`

const WRAP = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'
const BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
const BTN_PRIMARY = `${BTN} bg-brand-700 px-5 py-3 text-white hover:bg-brand-800`
const BTN_SECONDARY = `${BTN} border border-line bg-white px-5 py-3 text-ink hover:border-brand-300 hover:bg-brand-50`

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.03c-.25.69-1.44 1.33-1.98 1.37-.53.05-1.03.24-3.47-.72-2.93-1.16-4.79-4.16-4.93-4.36-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.27-.29.58-.36.78-.36l.56.01c.18.01.42-.07.66.5.25.58.84 2.01.91 2.16.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.3-.13.59.17.29.74 1.22 1.58 1.97 1.09.97 2 1.27 2.29 1.41.29.14.46.12.63-.07.17-.19.72-.84.92-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.69-.18 1.38Z" />
    </svg>
  )
}

const MARK_ICONS: Record<Mark, LucideIcon> = { yes: Check, part: Minus, no: X }
const MARK_STYLE: Record<Mark, string> = {
  yes: 'bg-brand-800 text-white',
  part: 'bg-amber-300/40 text-amber-500',
  no: 'bg-slate-100 text-slate-400',
}

/** One comparison cell. role="img" so the label is actually announced. */
function MarkCell({ mark, label }: { mark: Mark; label: string }) {
  const Icon = MARK_ICONS[mark]
  return (
    <span
      className={`inline-grid h-7 w-7 place-items-center rounded-full ${MARK_STYLE[mark]}`}
      role="img"
      aria-label={label}
    >
      <Icon size={15} strokeWidth={3} aria-hidden="true" />
    </span>
  )
}

/** A real screenshot, cropped to what matters, as a WebP with a PNG fallback. */
function Img({
  name,
  lang,
  alt,
  w,
  h,
  className = '',
}: {
  name: string
  lang: Lang
  alt: string
  w: number
  h: number
  className?: string
}) {
  return (
    <picture>
      <source type="image/webp" srcSet={`/landing/${name}-${lang}.webp`} />
      {/* Eager on purpose: a page this short gains nothing from lazy images,
          and full-page captures (the way people share it) showed them blank. */}
      <img
        src={`/landing/${name}-${lang}.png`}
        alt={alt}
        width={w}
        height={h}

        className={`block h-auto w-full ${className}`}
      />
    </picture>
  )
}

/** The app window: a thin bar over the screenshot, so it reads as software. */
function AppWindow({ name, lang, alt, w, h }: { name: string; lang: Lang; alt: string; w: number; h: number }) {
  return (
    <figure className="m-0 overflow-hidden rounded-xl border border-black/5 bg-white shadow-shot">
      <div className="flex items-center gap-1.5 border-b border-line bg-paper px-4 py-2.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="mx-auto rounded-md bg-white px-10 py-0.5 text-xs text-ink-muted" dir="ltr">
          mektebti.tn
        </span>
      </div>
      <Img name={name} lang={lang} alt={alt} w={w} h={h} />
    </figure>
  )
}

function SectionTitle({
  eyebrow,
  title,
  sub,
  dark = false,
}: {
  eyebrow?: string
  title: string
  sub?: string
  dark?: boolean
}) {
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      {eyebrow ? (
        <p className={`m-0 mb-3 text-sm font-semibold uppercase tracking-widest rtl:tracking-normal ${dark ? 'text-amber-300' : 'text-brand-700'}`}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className={`m-0 text-3xl font-bold tracking-tight sm:text-[2.6rem] sm:leading-tight ${dark ? 'text-white' : 'text-ink'}`}>
        {title}
      </h2>
      {sub ? <p className={`mb-0 mt-4 text-lg ${dark ? 'text-brand-200' : 'text-ink-muted'}`}>{sub}</p> : null}
    </div>
  )
}

/** Logo + "back to the page" bar, shared with the legal pages. */
export function SiteHeader({ lang, children }: { lang: Lang; children?: ReactNode }) {
  return (
    <header className="mk-nav">
      <div className="mk-wrap mk-nav-in">
        <a href={LANDING_PATH[lang]} className="mk-logo">
          <BrandLogo height={34} />
        </a>
        {children}
      </div>
    </header>
  )
}

/**
 * Footer with the legal links, shared with the legal pages. The cookie button
 * stays hidden unless static.ts finds tracking switched on: with no tags there
 * is nothing to manage.
 */
export function SiteFooter({ lang }: { lang: Lang }) {
  const f = LANDING_COPY[lang].footer
  return (
    <footer className="mk-footer">
      <div className="mk-wrap mk-footer-in">
        <BrandLogo height={26} />
        <span>{f.made}</span>
        <nav className="mk-footer-links" aria-label={f.nav}>
          <a href="/mentions-legales">{f.legal}</a>
          <a href="/cgv">{f.cgv}</a>
          <a href="/confidentialite">{f.privacy}</a>
          <button type="button" className="mk-footer-link" data-mk="consent" hidden>
            {f.cookies}
          </button>
        </nav>
      </div>
    </footer>
  )
}

/** The page language: given at build time, read from <html lang> inside the app. */
function currentLang(): Lang {
  if (typeof document === 'undefined') return 'fr'
  return document.documentElement.lang === 'ar' ? 'ar' : 'fr'
}

function Hero({ c, lang, cta }: { c: LandingCopy; lang: Lang; cta: string }) {
  return (
    <section className="relative overflow-hidden bg-white" id="top">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(60rem_24rem_at_50%_0%,#e3e0ff,transparent_70%)]"
        aria-hidden="true"
      />
      <div className={`${WRAP} relative pt-12 text-center sm:pt-16 lg:pt-20`}>
        <p className="m-0 inline-flex items-center gap-2 rounded-full bg-amber-300/30 px-3 py-1 text-xs font-bold text-ink sm:text-sm">
          {c.hero.priceTag}
        </p>
        <h1 className="mx-auto mb-0 mt-5 max-w-3xl text-[2.1rem] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl rtl:leading-snug rtl:tracking-normal">
          {c.hero.title} <span className="text-brand-700">{c.hero.titleAccent}</span>
        </h1>
        <p className="mx-auto mb-0 mt-5 max-w-xl text-base text-ink-soft sm:text-lg">{c.hero.sub}</p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <a href={cta} className={`${BTN_PRIMARY} px-6 py-3.5 text-base shadow-card`} data-mk="wa" data-loc="hero" {...ext}>
            <WhatsAppIcon size={18} />
            {c.hero.cta}
          </a>
          <a href="#tarifs" className={`${BTN_SECONDARY} px-6 py-3.5 text-base`}>
            {c.hero.cta2}
            <ArrowRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
          </a>
        </div>
        <ul className="m-0 mt-6 flex list-none flex-wrap justify-center gap-x-5 gap-y-2 p-0">
          {c.hero.points.map((pt) => (
            <li key={pt} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
              <Check size={16} strokeWidth={2.5} className="text-emerald-600" aria-hidden="true" />
              {pt}
            </li>
          ))}
        </ul>

        <div className="relative mx-auto mt-10 max-w-5xl pb-4 text-start sm:mt-14">
          <AppWindow name="caisse" lang={lang} alt={c.hero.shotAlt} w={1702} h={1242} />
          <div className="absolute -bottom-3 end-4 hidden w-64 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-shot md:block lg:-end-12">
            <Img name="d-kpi" lang={lang} alt="" w={535} h={170} />
          </div>
          <div className="absolute bottom-20 start-4 hidden w-64 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-shot lg:-start-12 lg:block">
            <Img name="d-solde" lang={lang} alt="" w={540} h={160} />
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingPage({ lang: given }: { lang?: Lang } = {}) {
  const lang = given ?? currentLang()
  const other: Lang = lang === 'ar' ? 'fr' : 'ar'
  const c = LANDING_COPY[lang]
  const cta = waLink(c.wa.text)
  const SHOT_SIZE: Record<string, [number, number]> = {
    packs: [1702, 652],
    stock: [1702, 1242],
    client: [1702, 1182],
    dashboard: [1702, 1242],
  }
  const OFFLINE_ICONS: LucideIcon[] = [WifiOff, RefreshCw, CloudUpload]
  const START = c.pricing.setup

  return (
    <div className="mk" lang={lang}>
      <a className="mk-skip" href="#contenu">
        {c.skip}
      </a>

      {/* ---------------- launch offer bar ---------------- */}
      <div className="bg-ink text-white">
        <div className={`${WRAP} flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 text-center text-sm`}>
          <Sparkles size={16} className="text-amber-300" aria-hidden="true" />
          <span>{c.promo.text}</span>
          <a href="#tarifs" className="font-semibold text-amber-300 underline underline-offset-2">
            {c.promo.link}
          </a>
        </div>
      </div>

      {/* ---------------- nav ---------------- */}
      <SiteHeader lang={lang}>
        <nav className="flex items-center gap-1 text-[0.95rem] font-medium text-ink-soft">
          <a href="#fonctions" className="hidden rounded-md px-3 py-2 hover:text-brand-800 md:inline-block">
            {c.nav.features}
          </a>
          <a href="#tarifs" className="hidden rounded-md px-3 py-2 hover:text-brand-800 md:inline-block">
            {c.nav.pricing}
          </a>
          <a href="#faq" className="hidden rounded-md px-3 py-2 hover:text-brand-800 md:inline-block">
            {c.nav.faq}
          </a>
          <a
            href={LANDING_PATH[other]}
            hrefLang={other}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 hover:text-brand-800"
            data-mk="lang"
            data-lang={other}
          >
            <Languages size={16} aria-hidden="true" />
            <span lang={other}>{c.nav.otherLang}</span>
          </a>
          <a href="/login" className={`${BTN} whitespace-nowrap px-3 py-2 text-brand-800 hover:bg-brand-50`} data-mk="login">
            {c.nav.login}
          </a>
          <a href={cta} className={`${BTN} hidden whitespace-nowrap bg-brand-700 px-4 py-2 text-white hover:bg-brand-800 sm:inline-flex`} data-mk="wa" data-loc="nav" {...ext}>
            {c.nav.demo}
          </a>
        </nav>
      </SiteHeader>

      <main id="contenu">
        <Hero c={c} lang={lang} cta={cta} />

        {/* ---------------- proof band ---------------- */}
        <section className="border-y border-line bg-paper">
          <div className={`${WRAP} grid grid-cols-2 gap-y-6 py-8 lg:grid-cols-4`}>
            {c.facts.map(([big], i) => {
              const Icon = FACT_ICONS[i]
              return (
                <div key={big} className="flex items-center justify-center gap-2.5 px-2 text-center">
                  <Icon size={20} className="shrink-0 text-brand-700" aria-hidden="true" />
                  <p className="m-0 text-sm font-semibold text-ink sm:text-base">{big}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ---------------- features: picture first, one line each ---------------- */}
        <section className="bg-white py-16 sm:py-24" id="fonctions">
          <div className={WRAP}>
            <SectionTitle title={c.showcase.title} />
            <div className="grid gap-6 md:grid-cols-2">
              {c.showcase.items.map((s) => {
                const [w, h] = SHOT_SIZE[s.img]
                return (
                  <article key={s.img} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper">
                    <div className="px-6 pt-6 sm:px-8 sm:pt-8">
                      <p className="m-0 text-xs font-bold uppercase tracking-widest text-brand-700 rtl:tracking-normal">{s.eyebrow}</p>
                      <h3 className="mb-0 mt-2 text-xl font-bold leading-snug text-ink sm:text-2xl">{s.title}</h3>
                    </div>
                    <div className="mt-6 flex flex-1 items-end ps-6 sm:ps-8">
                      <div className="w-full overflow-hidden rounded-ss-xl border-s border-t border-line bg-white shadow-card">
                        <Img name={s.img} lang={lang} alt={s.alt} w={w} h={h} />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---------------- offline ---------------- */}
        <section className="bg-ink py-14 text-white sm:py-16">
          <div className={`${WRAP} grid items-center gap-8 lg:grid-cols-[1.1fr_2fr]`}>
            <h2 className="m-0 text-center text-2xl font-extrabold leading-tight sm:text-3xl lg:text-start">{c.offline.title}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {c.offline.points.map(([title], i) => {
                const Icon = OFFLINE_ICONS[i]
                return (
                  <div key={title} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-4 py-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-600">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="font-semibold">{title}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---------------- pricing ---------------- */}
        <section className="bg-paper py-16 sm:py-24" id="tarifs">
          <div className={WRAP}>
            <SectionTitle title={c.pricing.title} sub={c.pricing.sub} />
            <div className="mx-auto grid max-w-md items-stretch gap-5 lg:max-w-5xl lg:grid-cols-3">
              {c.pricing.plans.map((p) => (
                <article
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl p-6 sm:p-7 ${
                    p.highlight ? 'bg-brand-800 text-white shadow-shot lg:-my-3 lg:py-10' : 'border border-line bg-white'
                  }`}
                >
                  {p.badge ? (
                    <span className="absolute -top-3 start-6 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-ink">{p.badge}</span>
                  ) : null}
                  <h3 className={`m-0 text-base font-semibold ${p.highlight ? 'text-brand-100' : 'text-ink-muted'}`}>{p.name}</h3>
                  <p className="mb-0 mt-3 flex items-baseline gap-1.5">
                    <strong className={`whitespace-nowrap text-[2.75rem] font-extrabold leading-none tracking-tight ${p.highlight ? 'text-white' : 'text-ink'}`} dir="ltr">
                      {p.price}
                    </strong>
                    <span className={`text-sm font-medium ${p.highlight ? 'text-brand-200' : 'text-ink-muted'}`}>{p.unit}</span>
                  </p>
                  <p className={`mb-0 mt-2 text-sm font-semibold ${p.highlight ? 'text-amber-300' : 'text-brand-700'}`}>{p.sub}</p>
                  <ul className="m-0 mt-6 grid flex-1 list-none content-start gap-3 p-0">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2.5 text-[0.95rem]">
                        <Check size={18} strokeWidth={2.5} className={`mt-0.5 shrink-0 ${p.highlight ? 'text-amber-300' : 'text-emerald-600'}`} aria-hidden="true" />
                        <span className={p.highlight ? 'text-white' : 'text-ink'}>{perk}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={waLink(c.wa.plan.replace('{{plan}}', p.name))}
                    className={`${BTN} mt-7 w-full px-5 py-3 ${
                      p.highlight ? 'bg-white text-brand-800 hover:bg-brand-50' : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                    }`}
                    aria-label={c.pricing.chooseLabel.replace('{{plan}}', p.name)}
                    data-mk="wa"
                    data-loc="pricing"
                    data-plan={p.id}
                    {...ext}
                  >
                    {c.pricing.choose}
                  </a>
                </article>
              ))}
            </div>

            {/* one-time costs, in one clean row */}
            <div className="mx-auto mt-10 max-w-5xl rounded-2xl border border-line bg-white p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-line rtl:sm:divide-x-reverse">
                {START.map(([price, what], i) => (
                  <div key={price} className="sm:px-6 sm:first:ps-0 sm:last:pe-0">
                    <p className="m-0 text-xs font-bold uppercase tracking-widest text-ink-muted rtl:tracking-normal">
                      {[c.pricing.setupTitle, c.pricing.kitTitle, c.pricing.extraTitle][i]}
                    </p>
                    <p className="m-0 mt-1 text-xl font-extrabold text-ink" dir="ltr">
                      {price}
                    </p>
                    <p className="m-0 mt-1 text-sm text-ink-muted">{what}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="mx-auto mb-0 mt-5 max-w-3xl text-center text-xs text-ink-muted sm:text-sm">
              {c.pricing.taxNote}{' '}
              <a href="/cgv" className="text-brand-700 underline underline-offset-2">
                {c.pricing.termsLink}
              </a>
            </p>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section className="bg-white py-16 sm:py-24" id="faq">
          <div className={`${WRAP} max-w-3xl`}>
            <SectionTitle title={c.faq.title} />
            <div className="divide-y divide-line border-y border-line">
              {c.faq.items.slice(0, 4).map(([q, a]) => (
                <details key={q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-semibold text-ink sm:text-lg [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown size={20} className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="m-0 pb-5 leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- final CTA ---------------- */}
        <section className="bg-white pb-16 sm:pb-24" id="contact">
          <div className={WRAP}>
            <div className="rounded-3xl bg-brand-800 px-6 py-12 text-center text-white sm:px-16 sm:py-16">
              <h2 className="m-0 text-2xl font-extrabold tracking-tight sm:text-4xl">{c.final.title}</h2>
              <div className="mx-auto mt-7 flex max-w-sm flex-col items-center gap-4 sm:max-w-none">
                <a href={cta} className={`${BTN} w-full bg-white px-6 py-3.5 text-base text-brand-800 hover:bg-brand-50 sm:w-auto`} data-mk="wa" data-loc="final" {...ext}>
                  <WhatsAppIcon size={18} />
                  {c.final.cta}
                </a>
                <a href={TEL} className="inline-flex items-center gap-2 text-brand-100 hover:text-white" data-mk="call" data-loc="final">
                  <Phone size={16} aria-hidden="true" />
                  <span dir="ltr" className="font-semibold">{PHONE_LABEL}</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} />

      <a href={cta} className="mk-wa-float" aria-label={c.wa.label} data-mk="wa" data-loc="float" {...ext}>
        <WhatsAppIcon size={28} />
      </a>
    </div>
  )
}
