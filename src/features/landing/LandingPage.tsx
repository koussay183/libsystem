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
        decoding="async"
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
      {/* soft brand glow behind the headline, static and cheap to paint */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(60rem_26rem_at_50%_0%,#e3e0ff,transparent_70%)]"
        aria-hidden="true"
      />
      <div className={`${WRAP} relative pt-16 text-center lg:pt-24`}>
        <p className="m-0 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-brand-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          {c.hero.kicker}
        </p>
        <h1 className="mx-auto mb-0 mt-6 max-w-4xl text-[2.6rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-6xl rtl:leading-tight rtl:tracking-normal">
          {c.hero.title} <span className="text-brand-700">{c.hero.titleAccent}</span>
        </h1>
        <p className="mx-auto mb-0 mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft sm:text-xl">{c.hero.sub}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a href={cta} className={`${BTN_PRIMARY} px-6 py-3.5 text-base shadow-card`} data-mk="wa" data-loc="hero" {...ext}>
            <WhatsAppIcon size={18} />
            {c.hero.cta}
          </a>
          <a href="#tarifs" className={`${BTN_SECONDARY} px-6 py-3.5 text-base`}>
            {c.hero.cta2}
            <ArrowRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
          </a>
        </div>
        <ul className="m-0 mt-7 flex list-none flex-wrap justify-center gap-x-6 gap-y-2 p-0">
          {c.hero.points.map((pt) => (
            <li key={pt} className="flex items-center gap-2 text-sm font-medium text-ink-soft">
              <Check size={16} strokeWidth={2.5} className="text-emerald-600" aria-hidden="true" />
              {pt}
            </li>
          ))}
        </ul>

        {/* the product, big, with two real details lifted out of it */}
        <div className="relative mx-auto mt-14 max-w-5xl pb-6 text-start">
          <AppWindow name="caisse" lang={lang} alt={c.hero.shotAlt} w={1702} h={1242} />
          <div className="absolute -bottom-4 hidden w-72 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-shot md:block lg:-end-14 md:end-4">
            <Img name="d-kpi" lang={lang} alt="" w={535} h={170} />
          </div>
          <div className="absolute bottom-24 hidden w-72 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-shot lg:-start-16 lg:block">
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
  const PANEL = ['bg-brand-50', 'bg-amber-300/20', 'bg-rose-50', 'bg-emerald-50']
  const OFFLINE_ICONS: LucideIcon[] = [WifiOff, RefreshCw, CloudUpload]

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
          <div className={`${WRAP} grid grid-cols-2 divide-line py-2 lg:grid-cols-4 lg:divide-x rtl:lg:divide-x-reverse`}>
            {c.facts.map(([big, small], i) => {
              const Icon = FACT_ICONS[i]
              return (
                <div key={big} className="flex flex-col items-center gap-2 px-4 py-7 text-center">
                  <Icon size={22} className="text-brand-700" aria-hidden="true" />
                  <p className="m-0 text-lg font-bold text-ink">{big}</p>
                  <p className="m-0 max-w-[16rem] text-sm text-ink-muted">{small}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ---------------- product, screen by screen ---------------- */}
        <section className="bg-white py-24" id="fonctions">
          <div className={WRAP}>
            <SectionTitle eyebrow={c.nav.features} title={c.showcase.title} sub={c.showcase.sub} />
            <div className="grid gap-24">
              {c.showcase.items.map((s, i) => {
                const [w, h] = SHOT_SIZE[s.img]
                return (
                  <article key={s.img} className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
                    <div className={`lg:col-span-5 ${i % 2 ? 'lg:order-2' : ''}`}>
                      <p className="m-0 text-sm font-semibold uppercase tracking-widest text-brand-700 rtl:tracking-normal">{s.eyebrow}</p>
                      <h3 className="mb-0 mt-3 text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">{s.title}</h3>
                      <p className="mb-0 mt-4 text-lg leading-relaxed text-ink-soft">{s.body}</p>
                      <ul className="m-0 mt-7 grid list-none gap-3.5 p-0">
                        {s.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-3 font-medium text-ink">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                              <Check size={12} strokeWidth={3.5} aria-hidden="true" />
                            </span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={`rounded-2xl p-4 sm:p-8 lg:col-span-7 ${PANEL[i % PANEL.length]}`}>
                      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-shot">
                        <Img name={s.img} lang={lang} alt={s.alt} w={w} h={h} />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---------------- offline, the differentiator ---------------- */}
        <section className="relative overflow-hidden bg-ink py-24 text-white">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_80%_0%,rgba(91,75,255,.35),transparent_70%)]"
            aria-hidden="true"
          />
          <div className={`${WRAP} relative`}>
            <SectionTitle eyebrow={c.offline.eyebrow} title={c.offline.title} sub={c.offline.body} dark />
            <div className="grid gap-6 md:grid-cols-3">
              {c.offline.points.map(([title, body], i) => {
                const Icon = OFFLINE_ICONS[i]
                return (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
                    <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-600 text-white">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <h3 className="mb-0 mt-5 text-lg font-semibold text-white">{title}</h3>
                    <p className="mb-0 mt-2 text-brand-200">{body}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---------------- comparison ---------------- */}
        <section className="bg-paper py-24" id="pourquoi">
          <div className={WRAP}>
            <SectionTitle title={c.why.title} sub={c.why.sub} />
            <div className="mx-auto max-w-4xl overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
              <table className="w-full border-collapse text-sm sm:text-base">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="p-5 text-start font-medium text-ink-muted">
                      <span className="mk-sr">{c.why.featureCol}</span>
                    </th>
                    {c.why.cols.map((col, i) => (
                      <th
                        key={col}
                        scope="col"
                        className={`p-5 text-center font-semibold ${i === 0 ? 'bg-brand-800 text-white' : 'text-ink-muted'}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.why.rows.map(([label, marks]) => (
                    <tr key={label} className="border-b border-line last:border-0">
                      <th scope="row" className="p-5 text-start font-medium text-ink">
                        {label}
                      </th>
                      {marks.map((m, i) => (
                        <td key={i} className={`p-5 text-center ${i === 0 ? 'bg-brand-50' : ''}`}>
                          <MarkCell mark={m} label={c.why.marks[m]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ---------------- steps ---------------- */}
        <section className="bg-white py-24">
          <div className={WRAP}>
            <SectionTitle title={c.steps.title} />
            <ol className="relative m-0 grid list-none gap-10 p-0 md:grid-cols-3 md:gap-8">
              <span className="absolute inset-x-[16%] top-7 hidden h-px bg-brand-200 md:block" aria-hidden="true" />
              {c.steps.items.map(([title, body], i) => {
                const Icon = STEP_ICONS[i]
                return (
                  <li key={title} className="relative text-center">
                    <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-800 text-white ring-8 ring-white">
                      <Icon size={24} aria-hidden="true" />
                    </span>
                    <p className="mb-0 mt-5 text-sm font-bold text-brand-700">0{i + 1}</p>
                    <h3 className="mb-0 mt-1 text-xl font-semibold text-ink">{title}</h3>
                    <p className="mx-auto mb-0 mt-2 max-w-xs text-ink-muted">{body}</p>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* ---------------- pricing ---------------- */}
        <section className="border-t border-line bg-paper py-24" id="tarifs">
          <div className={WRAP}>
            <SectionTitle eyebrow={c.nav.pricing} title={c.pricing.title} sub={c.pricing.sub} />
            <div className="mx-auto grid max-w-5xl items-stretch gap-6 lg:grid-cols-3">
              {c.pricing.plans.map((p) => (
                <article
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl p-8 ${
                    p.highlight ? 'bg-brand-800 text-white shadow-shot lg:-my-4 lg:py-12' : 'border border-line bg-white shadow-card'
                  }`}
                >
                  {p.badge ? (
                    <span className="absolute -top-3 start-8 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-ink">
                      {p.badge}
                    </span>
                  ) : null}
                  <h3 className={`m-0 text-lg font-semibold ${p.highlight ? 'text-white' : 'text-ink'}`}>{p.name}</h3>
                  <p className="mb-0 mt-5 flex flex-wrap items-baseline gap-x-2">
                    <strong className={`text-5xl font-bold tracking-tight ${p.highlight ? 'text-white' : 'text-ink'}`} dir="ltr">
                      {p.price}
                    </strong>
                    <span className={p.highlight ? 'text-brand-200' : 'text-ink-muted'}>{p.unit}</span>
                  </p>
                  <p className={`mb-0 mt-2 text-sm font-medium ${p.highlight ? 'text-amber-300' : 'text-brand-700'}`}>{p.sub}</p>
                  <ul
                    className={`m-0 mt-7 grid flex-1 list-none content-start gap-3.5 border-t p-0 pt-7 ${
                      p.highlight ? 'border-white/15' : 'border-line'
                    }`}
                  >
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-3">
                        <Check
                          size={18}
                          strokeWidth={2.5}
                          className={`mt-0.5 shrink-0 ${p.highlight ? 'text-amber-300' : 'text-emerald-600'}`}
                          aria-hidden="true"
                        />
                        <span className={p.highlight ? 'text-white' : 'text-ink'}>{perk}</span>
                      </li>
                    ))}
                  </ul>
                  <p className={`mb-0 mt-7 text-sm ${p.highlight ? 'text-brand-200' : 'text-ink-muted'}`}>{p.note}</p>
                  <a
                    href={waLink(c.wa.plan.replace('{{plan}}', p.name))}
                    className={`${BTN} mt-4 w-full px-5 py-3 ${
                      p.highlight ? 'bg-white text-brand-800 hover:bg-brand-50' : 'border border-line bg-white text-ink hover:border-brand-300 hover:bg-brand-50'
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

            <div className="mx-auto mt-12 grid max-w-5xl gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
              {c.pricing.setup.map(([price, what], i) => (
                <div key={price} className="bg-white p-6">
                  <p className="m-0 text-xs font-semibold uppercase tracking-widest text-ink-muted rtl:tracking-normal">
                    {i < 2 ? c.pricing.setupTitle : c.pricing.extraTitle}
                  </p>
                  <p className="m-0 mt-2 text-2xl font-bold text-ink" dir="ltr">
                    {price}
                  </p>
                  <p className="m-0 mt-1 text-sm text-ink-muted">{what}</p>
                </div>
              ))}
            </div>
            <p className="mx-auto mb-0 mt-6 max-w-3xl text-center text-sm text-ink-muted">
              {c.pricing.taxNote} {c.pricing.terms}{' '}
              <a href="/cgv" className="text-brand-700 underline underline-offset-2">
                {c.pricing.termsLink}
              </a>
              .
            </p>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section className="border-t border-line bg-white py-24" id="faq">
          <div className={`${WRAP} grid gap-12 lg:grid-cols-12`}>
            <div className="lg:col-span-4">
              <h2 className="m-0 text-3xl font-bold tracking-tight text-ink sm:text-[2.6rem] sm:leading-tight">{c.faq.title}</h2>
              <div className="mt-8 rounded-2xl bg-paper p-6">
                <p className="m-0 font-semibold text-ink">{c.faqAside.title}</p>
                <p className="mb-0 mt-2 text-ink-muted">{c.faqAside.body}</p>
                <a href={cta} className={`${BTN} mt-5 bg-[#25d366] px-4 py-2.5 text-white hover:bg-[#1ebe5b]`} data-mk="wa" data-loc="final" {...ext}>
                  <MessageCircle size={18} aria-hidden="true" />
                  {c.faqAside.cta}
                </a>
              </div>
            </div>
            <div className="divide-y divide-line border-y border-line lg:col-span-8">
              {c.faq.items.map(([q, a]) => (
                <details key={q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown size={20} className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="m-0 pb-6 leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- final CTA ---------------- */}
        <section className="bg-white pb-24" id="contact">
          <div className={WRAP}>
            <div className="relative overflow-hidden rounded-3xl bg-brand-800 px-6 py-16 text-center text-white sm:px-16">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_16rem_at_50%_0%,rgba(255,255,255,.18),transparent_70%)]"
                aria-hidden="true"
              />
              <div className="relative flex flex-col items-center gap-5">
                <h2 className="m-0 text-3xl font-bold tracking-tight sm:text-[2.6rem] sm:leading-tight">{c.final.title}</h2>
                <p className="m-0 max-w-xl text-lg text-brand-100">{c.final.sub}</p>
                <a
                  href={cta}
                  className={`${BTN} bg-white px-6 py-3.5 text-base text-brand-800 hover:bg-brand-50`}
                  data-mk="wa"
                  data-loc="final"
                  {...ext}
                >
                  <WhatsAppIcon size={18} />
                  {c.final.cta}
                </a>
                <a href={TEL} className="inline-flex items-center gap-2 text-brand-100 hover:text-white" data-mk="call" data-loc="final">
                  <Phone size={16} aria-hidden="true" />
                  {c.final.call} <span dir="ltr" className="font-semibold">{PHONE_LABEL}</span>
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
