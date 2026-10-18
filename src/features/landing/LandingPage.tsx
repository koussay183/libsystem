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

/** A real screenshot of the app in a plain browser frame. */
function Shot({ img, lang, alt, eager = false }: { img: string; lang: Lang; alt: string; eager?: boolean }) {
  return (
    <figure className="m-0 overflow-hidden rounded-xl border border-line bg-white shadow-shot">
      <div className="flex items-center gap-1.5 border-b border-line bg-paper px-3 py-2" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="ms-3 truncate rounded-md bg-white px-3 py-0.5 text-xs text-ink-muted" dir="ltr">
          mektebti.tn
        </span>
      </div>
      <picture>
        <source type="image/webp" srcSet={`/landing/${img}-${lang}.webp`} />
        <img
          src={`/landing/${img}-${lang}.png`}
          alt={alt}
          width={1600}
          height={1000}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          {...(eager ? { fetchPriority: 'high' as const } : {})}
          className="block h-auto w-full"
        />
      </picture>
    </figure>
  )
}

function SectionTitle({ title, sub, dark = false }: { title: string; sub?: string; dark?: boolean }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <h2 className={`m-0 text-3xl font-bold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>{title}</h2>
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
    <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-brand-50 via-white to-white" id="top">
      <div className={`${WRAP} grid items-center gap-12 py-14 lg:grid-cols-[1fr_1.15fr] lg:py-20`}>
        <div>
          <p className="m-0 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-sm font-semibold text-brand-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            {c.hero.kicker}
          </p>
          <h1 className="mb-0 mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-ink lg:text-[3.1rem] rtl:leading-snug rtl:tracking-normal">
            {c.hero.title} <span className="text-brand-700">{c.hero.titleAccent}</span>
          </h1>
          <p className="mb-0 mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">{c.hero.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={cta} className={`${BTN_PRIMARY} text-base`} data-mk="wa" data-loc="hero" {...ext}>
              <WhatsAppIcon size={18} />
              {c.hero.cta}
            </a>
            <a href="#tarifs" className={`${BTN_SECONDARY} text-base`}>
              {c.hero.cta2}
              <ArrowRight size={18} className="rtl:-scale-x-100" aria-hidden="true" />
            </a>
          </div>
          <ul className="m-0 mt-8 grid list-none gap-2 p-0 sm:grid-cols-3 sm:gap-4">
            {c.hero.points.map((pt) => (
              <li key={pt} className="flex items-start gap-2 text-sm font-medium text-ink-soft">
                <Check size={18} strokeWidth={2.5} className="mt-px shrink-0 text-emerald-600" aria-hidden="true" />
                {pt}
              </li>
            ))}
          </ul>
        </div>
        <Shot img="caisse" lang={lang} alt={c.hero.shotAlt} eager />
      </div>
    </section>
  )
}

export function LandingPage({ lang: given }: { lang?: Lang } = {}) {
  const lang = given ?? currentLang()
  const other: Lang = lang === 'ar' ? 'fr' : 'ar'
  const c = LANDING_COPY[lang]
  const cta = waLink(c.wa.text)

  return (
    <div className="mk" lang={lang}>
      <a className="mk-skip" href="#contenu">
        {c.skip}
      </a>

      {/* ---------------- launch offer bar ---------------- */}
      <div className="bg-ink text-white">
        <div className={`${WRAP} flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-sm`}>
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
          <a href="/login" className={`${BTN} hidden px-3 py-2 text-brand-800 hover:bg-brand-50 sm:inline-flex`} data-mk="login">
            {c.nav.login}
          </a>
          <a href={cta} className={`${BTN} bg-brand-700 px-4 py-2 text-white hover:bg-brand-800`} data-mk="wa" data-loc="nav" {...ext}>
            {c.nav.demo}
          </a>
        </nav>
      </SiteHeader>

      <main id="contenu">
        <Hero c={c} lang={lang} cta={cta} />

        {/* ---------------- facts ---------------- */}
        <section className="border-b border-line bg-white">
          <div className={`${WRAP} grid grid-cols-2 gap-6 py-10 lg:grid-cols-4`}>
            {c.facts.map(([big, small], i) => {
              const Icon = FACT_ICONS[i]
              return (
                <div key={big} className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="m-0 font-semibold text-ink">{big}</p>
                    <p className="m-0 mt-0.5 text-sm text-ink-muted">{small}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ---------------- product, screen by screen ---------------- */}
        <section className="bg-paper py-20" id="fonctions">
          <div className={WRAP}>
            <SectionTitle title={c.showcase.title} sub={c.showcase.sub} />
            <div className="grid gap-20">
              {c.showcase.items.map((s, i) => (
                <article key={s.img} className="grid items-center gap-10 lg:grid-cols-2">
                  <div className={i % 2 ? 'lg:order-2' : ''}>
                    <p className="m-0 text-sm font-semibold uppercase tracking-wider text-brand-700 rtl:tracking-normal">{s.eyebrow}</p>
                    <h3 className="mb-0 mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{s.title}</h3>
                    <p className="mb-0 mt-4 text-lg leading-relaxed text-ink-soft">{s.body}</p>
                    <ul className="m-0 mt-6 grid list-none gap-3 p-0">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-ink">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800">
                            <Check size={13} strokeWidth={3} aria-hidden="true" />
                          </span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Shot img={s.img} lang={lang} alt={s.alt} />
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- all features ---------------- */}
        <section className="border-y border-line bg-white py-20">
          <div className={WRAP}>
            <SectionTitle title={c.features.title} />
            <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {c.features.items.map(([key, title, body]) => {
                const Icon = FEATURE_ICONS[key] ?? Boxes
                return (
                  <div key={key} className="bg-white p-6">
                    <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand-800">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <h3 className="mb-0 mt-4 text-lg font-semibold text-ink">{title}</h3>
                    <p className="mb-0 mt-1 text-ink-muted">{body}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---------------- comparison ---------------- */}
        <section className="bg-paper py-20" id="pourquoi">
          <div className={WRAP}>
            <SectionTitle title={c.why.title} sub={c.why.sub} />
            <div className="mx-auto max-w-4xl overflow-x-auto rounded-xl border border-line bg-white shadow-card">
              <table className="w-full border-collapse text-sm sm:text-base">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="p-4 text-start font-medium text-ink-muted">
                      <span className="mk-sr">{c.why.featureCol}</span>
                    </th>
                    {c.why.cols.map((col, i) => (
                      <th
                        key={col}
                        scope="col"
                        className={`p-4 text-center font-semibold ${i === 0 ? 'bg-brand-50 text-brand-800' : 'text-ink-muted'}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.why.rows.map(([label, marks]) => (
                    <tr key={label} className="border-b border-line last:border-0">
                      <th scope="row" className="p-4 text-start font-medium text-ink">
                        {label}
                      </th>
                      {marks.map((m, i) => (
                        <td key={i} className={`p-4 text-center ${i === 0 ? 'bg-brand-50' : ''}`}>
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
        <section className="border-y border-line bg-white py-20">
          <div className={WRAP}>
            <SectionTitle title={c.steps.title} />
            <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
              {c.steps.items.map(([title, body], i) => {
                const Icon = STEP_ICONS[i]
                return (
                  <li key={title} className="rounded-xl border border-line bg-white p-6 shadow-card">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-800 text-white">
                        <Icon size={22} aria-hidden="true" />
                      </span>
                      <span className="text-sm font-bold text-brand-700">0{i + 1}</span>
                    </div>
                    <h3 className="mb-0 mt-4 text-lg font-semibold text-ink">{title}</h3>
                    <p className="mb-0 mt-1 text-ink-muted">{body}</p>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* ---------------- pricing ---------------- */}
        <section className="bg-paper py-20" id="tarifs">
          <div className={WRAP}>
            <SectionTitle title={c.pricing.title} sub={c.pricing.sub} />
            <div className="grid items-stretch gap-6 lg:grid-cols-3">
              {c.pricing.plans.map((p) => (
                <article
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl border bg-white p-7 ${
                    p.highlight ? 'border-brand-700 shadow-shot ring-1 ring-brand-700' : 'border-line shadow-card'
                  }`}
                >
                  {p.badge ? (
                    <span className="absolute -top-3 start-7 rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white">
                      {p.badge}
                    </span>
                  ) : null}
                  <h3 className="m-0 text-lg font-semibold text-ink">{p.name}</h3>
                  <p className="mb-0 mt-4 flex flex-wrap items-baseline gap-x-2">
                    <strong className="text-5xl font-bold tracking-tight text-ink" dir="ltr">
                      {p.price}
                    </strong>
                    <span className="font-medium text-ink-muted">{p.unit}</span>
                  </p>
                  <p className="mb-0 mt-2 text-sm font-medium text-brand-700">{p.sub}</p>
                  <ul className="m-0 mt-6 grid flex-1 list-none content-start gap-3 border-t border-line p-0 pt-6">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-3 text-ink">
                        <Check size={18} strokeWidth={2.5} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <p className="mb-0 mt-6 text-sm text-ink-muted">{p.note}</p>
                  <a
                    href={waLink(c.wa.plan.replace('{{plan}}', p.name))}
                    className={`${p.highlight ? BTN_PRIMARY : BTN_SECONDARY} mt-4 w-full`}
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

            <div className="mt-10 rounded-xl border border-line bg-white p-6">
              <h3 className="m-0 text-base font-semibold text-ink">{c.pricing.setupTitle}</h3>
              <dl className="m-0 mt-4 grid gap-4 md:grid-cols-3">
                {c.pricing.setup.map(([price, what]) => (
                  <div key={price}>
                    <dt className="font-bold text-ink" dir="ltr">
                      {price}
                    </dt>
                    <dd className="m-0 mt-1 text-sm text-ink-muted">{what}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="mb-0 mt-6 text-center text-sm text-ink-muted">
              {c.pricing.taxNote} {c.pricing.terms}{' '}
              <a href="/cgv" className="text-brand-700 underline underline-offset-2">
                {c.pricing.termsLink}
              </a>
              .
            </p>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section className="border-t border-line bg-white py-20" id="faq">
          <div className={`${WRAP} max-w-3xl`}>
            <SectionTitle title={c.faq.title} />
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {c.faq.items.map(([q, a]) => (
                <details key={q} className="group bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold text-ink hover:bg-paper [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown size={18} className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="m-0 px-5 pb-5 leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- final CTA ---------------- */}
        <section className="bg-brand-800 py-16 text-white" id="contact">
          <div className={`${WRAP} flex flex-col items-center gap-5 text-center`}>
            <h2 className="m-0 text-3xl font-bold tracking-tight sm:text-4xl">{c.final.title}</h2>
            <p className="m-0 max-w-xl text-lg text-brand-100">{c.final.sub}</p>
            <a
              href={cta}
              className={`${BTN} bg-white px-6 py-3 text-base text-brand-800 hover:bg-brand-50`}
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
        </section>
      </main>

      <SiteFooter lang={lang} />

      <a href={cta} className="mk-wa-float" aria-label={c.wa.label} data-mk="wa" data-loc="float" {...ext}>
        <WhatsAppIcon size={28} />
      </a>
    </div>
  )
}
