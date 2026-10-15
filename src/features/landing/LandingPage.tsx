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
  Home,
  FileText,
  Settings,
  WifiOff,
  Phone,
  ChevronDown,
} from 'lucide-react'
import { BrandLogo, BrandMark } from '@/components/BrandLogo'
import { CONTACT, LANDING_COPY, LANDING_PATH } from './copy'
import type { Lang, LandingCopy, Mark } from './copy'
import './landing.css'

/**
 * The public page a visitor sees on the bare domain.
 *
 * Plain HTML + one scoped stylesheet rather than Chakra: it is the first thing
 * a prospect opens, often on a phone over 3G. The only images are the logo
 * PNGs; every product visual is drawn in CSS/SVG so nothing waits on a download.
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

const STEP_ICONS: LucideIcon[] = [Wrench, Database, ShoppingCart]

const ext = { target: '_blank', rel: 'noopener noreferrer' }

export function waLink(text: string) {
  return `https://wa.me/216${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`
}

const TEL = `tel:+216${CONTACT.whatsapp}`
const PHONE_LABEL = `+216 ${CONTACT.whatsapp.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3')}`

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.03c-.25.69-1.44 1.33-1.98 1.37-.53.05-1.03.24-3.47-.72-2.93-1.16-4.79-4.16-4.93-4.36-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.27-.29.58-.36.78-.36l.56.01c.18.01.42-.07.66.5.25.58.84 2.01.91 2.16.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.3-.13.59.17.29.74 1.22 1.58 1.97 1.09.97 2 1.27 2.29 1.41.29.14.46.12.63-.07.17-.19.72-.84.92-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.69-.18 1.38Z" />
    </svg>
  )
}

const MARK_ICONS: Record<Mark, LucideIcon> = { yes: Check, part: Minus, no: X }

/** One comparison cell. role="img" so the label is actually announced. */
function MarkCell({ mark, label }: { mark: Mark; label: string }) {
  const Icon = MARK_ICONS[mark]
  return (
    <span className={`mk-mark mk-${mark}`} role="img" aria-label={label}>
      <Icon size={16} strokeWidth={3} aria-hidden="true" />
    </span>
  )
}

/** The product, drawn in CSS: sidebar + till, so a visitor sees the app before any word about it. */
function ProductShot({ c }: { c: LandingCopy['mock'] }) {
  const side = [Home, ShoppingCart, Boxes, Package, FileText, NotebookPen, TrendingUp, Settings]
  return (
    <div className="mk-shot" aria-hidden="true">
      <div className="mk-shot-win">
        <div className="mk-shot-top">
          <i />
          <i />
          <i />
          <span className="mk-shot-url">mektebti.tn/caisse</span>
        </div>
        <div className="mk-shot-app">
          <div className="mk-shot-side">
            <BrandMark size={22} />
            {side.map((Icon, i) => (
              <span key={i} className={i === 1 ? 'on' : ''}>
                <Icon size={16} />
              </span>
            ))}
          </div>
          <div className="mk-shot-main">
            <div className="mk-scan">
              <ScanBarcode size={18} />
              <span className="mk-scan-code">6191234567890</span>
              <span className="mk-scan-ok">
                <Check size={12} strokeWidth={3} /> {c.scanned}
              </span>
              <span className="mk-beam" />
            </div>
            {c.lines.map(([name, qty, price], i) => (
              <div className="mk-line" key={i} style={{ animationDelay: `${0.25 + i * 0.18}s` }}>
                <span className="mk-line-name">{name}</span>
                <span className="mk-line-qty">{qty}</span>
                <span className="mk-line-price">{price}</span>
              </div>
            ))}
            <div className="mk-total">
              <span>{c.total}</span>
              <strong>{c.totalValue}</strong>
            </div>
            <div className="mk-pay">{c.pay}</div>
          </div>
        </div>
      </div>

      <div className="mk-float mk-float-a">
        <span className="mk-dot" />
        <div>
          <small>{c.low}</small>
          <b>{c.lowValue}</b>
        </div>
      </div>
      <div className="mk-float mk-float-b">
        <span className="mk-float-ic">
          <NotebookPen size={16} />
        </span>
        <div>
          <small>{c.debt}</small>
          <b>{c.debtValue}</b>
        </div>
      </div>
    </div>
  )
}

/** A small product visual per feature card — the bento's picture half. */
function FeatureVisual({ kind }: { kind: string }) {
  switch (kind) {
    case 'scan':
      return (
        <div className="mk-v mk-v-scan">
          <div className="mk-v-barcode">
            {Array.from({ length: 28 }, (_, i) => (
              <i key={i} style={{ width: [1, 2, 1, 3, 1, 2][i % 6] }} />
            ))}
          </div>
          <div className="mk-v-ticket">
            <span />
            <span />
            <span />
            <b />
          </div>
        </div>
      )
    case 'pack':
      return (
        <div className="mk-v mk-v-pack">
          {['1ère', '2ème', '3ème'].map((n, i) => (
            <div key={n} className="mk-v-packcard" style={{ ['--i' as string]: i }}>
              <Package size={16} />
              <span>{n}</span>
            </div>
          ))}
        </div>
      )
    case 'carnet':
      return (
        <div className="mk-v mk-v-bars">
          {[70, 45, 90, 30].map((w, i) => (
            <div key={i}>
              <span className="mk-v-avatar" />
              <span className="mk-v-bar" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      )
    case 'stock':
      return (
        <div className="mk-v mk-v-stock">
          {[80, 55, 12, 66, 8, 40].map((h, i) => (
            <i key={i} className={h < 15 ? 'low' : ''} style={{ height: `${h}%` }} />
          ))}
        </div>
      )
    case 'profit':
      return (
        <div className="mk-v mk-v-chart">
          <svg viewBox="0 0 160 60" preserveAspectRatio="none">
            <path d="M0 52 L22 46 L44 48 L66 34 L88 36 L110 22 L132 18 L160 6 L160 60 L0 60 Z" className="area" />
            <path d="M0 52 L22 46 L44 48 L66 34 L88 36 L110 22 L132 18 L160 6" className="line" />
          </svg>
        </div>
      )
    default:
      return (
        <div className="mk-v mk-v-rows">
          <span />
          <span />
          <span />
        </div>
      )
  }
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

      {/* ---------------- nav ---------------- */}
      <SiteHeader lang={lang}>
        <nav className="mk-nav-links">
          <a href="#fonctions">{c.nav.features}</a>
          <a href="#tarifs">{c.nav.pricing}</a>
          <a href="#faq">{c.nav.faq}</a>
          <a
            href={LANDING_PATH[other]}
            hrefLang={other}
            className="mk-lang"
            data-mk="lang"
            data-lang={other}
          >
            <Languages size={16} aria-hidden="true" />
            <span lang={other}>{c.nav.otherLang}</span>
          </a>
          <a href="/login" className="mk-btn mk-btn-ghost mk-btn-sm" data-mk="login">
            {c.nav.login}
          </a>
        </nav>
      </SiteHeader>

      <main id="contenu">
        {/* ---------------- hero ---------------- */}
        <section className="mk-hero" id="top">
          <div className="mk-grid-bg" />
          <div className="mk-wrap mk-hero-in">
            <div className="mk-hero-text">
              <p className="mk-kicker">
                <span className="mk-kicker-dot" />
                {c.hero.kicker}
              </p>
              <h1>
                {c.hero.title1}
                <br />
                <span className="mk-grad">{c.hero.title2}</span>
              </h1>
              <p className="mk-sub">{c.hero.sub}</p>
              <div className="mk-ctas">
                <a href={cta} className="mk-btn mk-btn-accent mk-btn-lg" data-mk="wa" data-loc="hero" {...ext}>
                  <WhatsAppIcon />
                  {c.hero.cta}
                </a>
                <a href="#tarifs" className="mk-btn mk-btn-ghost mk-btn-lg">
                  {c.hero.cta2}
                  <ArrowRight size={18} className="mk-flip" />
                </a>
              </div>
              <p className="mk-trust">
                <span className="mk-trust-ic">
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
                {c.trust}
              </p>
            </div>
            <ProductShot c={c.mock} />
          </div>
        </section>

        {/* ---------------- facts band ---------------- */}
        <section className="mk-facts">
          <div className="mk-wrap mk-facts-in">
            {c.facts.map(([big, small], i) => (
              <div key={i} className="mk-fact">
                {i === 0 ? <WifiOff size={18} /> : null}
                <strong>{big}</strong>
                <span>{small}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- features (bento) ---------------- */}
        <section className="mk-section" id="fonctions">
          <div className="mk-wrap">
            <h2 className="mk-h2">{c.features.title}</h2>
            <div className="mk-bento">
              {c.features.items.map(([key, title, body]) => {
                const Icon = FEATURE_ICONS[key] ?? Boxes
                return (
                  <article className={`mk-card mk-c-${key}`} key={key}>
                    <FeatureVisual kind={key} />
                    <div className="mk-card-text">
                      <span className="mk-card-icon">
                        <Icon size={20} />
                      </span>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---------------- comparison ---------------- */}
        <section className="mk-section mk-section-white" id="pourquoi">
          <div className="mk-wrap">
            <h2 className="mk-h2">{c.why.title}</h2>
            <div className="mk-compare" role="table" aria-label={c.why.title}>
              <div className="mk-cmp-row mk-cmp-head" role="row">
                <span role="columnheader">
                  <span className="mk-sr">{c.why.featureCol}</span>
                </span>
                {c.why.cols.map((col, i) => (
                  <span role="columnheader" key={col} className={i === 0 ? 'mk-cmp-us' : ''}>
                    {i === 0 ? <BrandLogo height={18} /> : col}
                  </span>
                ))}
              </div>
              {c.why.rows.map(([label, marks]) => (
                <div className="mk-cmp-row" role="row" key={label}>
                  <span role="rowheader" className="mk-cmp-label">
                    {label}
                  </span>
                  {marks.map((m, i) => (
                    <span role="cell" key={i} className={i === 0 ? 'mk-cmp-us' : ''}>
                      <MarkCell mark={m} label={c.why.marks[m]} />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- steps ---------------- */}
        <section className="mk-section">
          <div className="mk-wrap">
            <h2 className="mk-h2">{c.steps.title}</h2>
            <ol className="mk-steps">
              {c.steps.items.map((s, i) => {
                const Icon = STEP_ICONS[i]
                return (
                  <li key={s}>
                    <span className="mk-step-ic">
                      <Icon size={24} />
                    </span>
                    <span className="mk-step-n">0{i + 1}</span>
                    <b>{s}</b>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* ---------------- pricing ---------------- */}
        <section className="mk-section mk-section-dark" id="tarifs">
          <div className="mk-grid-bg" />
          <div className="mk-wrap">
            <h2 className="mk-h2">{c.pricing.title}</h2>
            <div className="mk-plans">
              {c.pricing.plans.map((p) => (
                <article className={`mk-plan${p.id === 'life' ? ' mk-plan-hot' : ''}`} key={p.id}>
                  {p.badge ? <span className="mk-badge">{p.badge}</span> : null}
                  <h3>{p.name}</h3>
                  <p className="mk-price">
                    <strong>{p.price}</strong>
                    <span>{p.unit}</span>
                  </p>
                  <p className="mk-plan-note">{p.note || ' '}</p>
                  <hr />
                  <ul>
                    {p.perks.map((perk) => (
                      <li key={perk}>
                        <Check size={16} strokeWidth={3} />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={waLink(c.wa.plan.replace('{{plan}}', p.name))}
                    className={`mk-btn ${p.id === 'life' ? 'mk-btn-accent' : 'mk-btn-light'}`}
                    aria-label={c.pricing.chooseLabel.replace('{{plan}}', p.name)}
                    data-mk="wa"
                    data-loc="pricing"
                    data-plan={p.id}
                    {...ext}
                  >
                    {c.pricing.choose}
                    <ArrowRight size={18} className="mk-flip" />
                  </a>
                </article>
              ))}
            </div>
            <p className="mk-plans-terms">
              {c.pricing.terms} <a href="/cgv">{c.pricing.termsLink}</a>.
            </p>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section className="mk-section mk-section-white" id="faq">
          <div className="mk-wrap">
            <h2 className="mk-h2">{c.faq.title}</h2>
            <div className="mk-faq">
              {c.faq.items.map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- final CTA ---------------- */}
        <section className="mk-final" id="contact">
          <div className="mk-wrap mk-final-in">
            <h2>{c.final.title}</h2>
            <a href={cta} className="mk-btn mk-btn-accent mk-btn-lg" data-mk="wa" data-loc="final" {...ext}>
              <WhatsAppIcon />
              {c.final.cta}
            </a>
            <a href={TEL} className="mk-final-phone" data-mk="call" data-loc="final">
              <Phone size={18} aria-hidden="true" />
              {c.final.call} <span dir="ltr">{PHONE_LABEL}</span>
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
