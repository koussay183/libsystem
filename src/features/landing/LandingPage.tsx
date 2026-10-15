import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
} from 'lucide-react'
import { BrandLogo, BrandMark } from '@/components/BrandLogo'
import { CONTACT, LANDING_COPY } from './copy'
import type { LandingCopy, Mark } from './copy'
import './landing.css'

/**
 * The public page a visitor sees on the bare domain.
 *
 * Plain HTML + one scoped stylesheet rather than Chakra: it is the first thing
 * a prospect opens, often on a phone over 3G. The only images are the logo
 * PNGs; every product visual is drawn in CSS/SVG so nothing waits on a download.
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

function waLink(text: string) {
  return `https://wa.me/216${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.03c-.25.69-1.44 1.33-1.98 1.37-.53.05-1.03.24-3.47-.72-2.93-1.16-4.79-4.16-4.93-4.36-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.27-.29.58-.36.78-.36l.56.01c.18.01.42-.07.66.5.25.58.84 2.01.91 2.16.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.3-.13.59.17.29.74 1.22 1.58 1.97 1.09.97 2 1.27 2.29 1.41.29.14.46.12.63-.07.17-.19.72-.84.92-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.69-.18 1.38Z" />
    </svg>
  )
}

function MarkCell({ mark }: { mark: Mark }) {
  if (mark === 'yes')
    return (
      <span className="mk-mark mk-yes" aria-label="✓">
        <Check size={16} strokeWidth={3} />
      </span>
    )
  if (mark === 'part')
    return (
      <span className="mk-mark mk-part" aria-label="~">
        <Minus size={16} strokeWidth={3} />
      </span>
    )
  return (
    <span className="mk-mark mk-no" aria-label="✗">
      <X size={16} strokeWidth={3} />
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

export function LandingPage() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'ar' ? 'ar' : 'fr'
  const c = LANDING_COPY[lang]
  const ext = { target: '_blank', rel: 'noopener noreferrer' }
  const cta = waLink(c.waText)

  return (
    <div className="mk" lang={lang}>
      {/* ---------------- nav ---------------- */}
      <header className="mk-nav">
        <div className="mk-wrap mk-nav-in">
          <a href="#top" className="mk-logo">
            <BrandLogo height={34} />
          </a>
          <nav className="mk-nav-links">
            <a href="#pourquoi">{c.nav.why}</a>
            <a href="#tarifs">{c.nav.pricing}</a>
            <button
              type="button"
              className="mk-lang"
              onClick={() => void i18n.changeLanguage(lang === 'ar' ? 'fr' : 'ar')}
            >
              <Languages size={16} />
              {lang === 'ar' ? 'FR' : 'عربي'}
            </button>
            <Link to="/login" className="mk-btn mk-btn-ghost mk-btn-sm">
              {c.nav.login}
            </Link>
          </nav>
        </div>
      </header>

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
              <a href={cta} className="mk-btn mk-btn-accent mk-btn-lg" {...ext}>
                <WhatsAppIcon />
                {c.hero.cta}
              </a>
              <a href="#tarifs" className="mk-btn mk-btn-ghost mk-btn-lg">
                {c.hero.cta2}
                <ArrowRight size={18} className="mk-flip" />
              </a>
            </div>
            <p className="mk-trust">
              <span className="mk-trust-dots">
                <i />
                <i />
                <i />
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
          <div className="mk-compare" role="table">
            <div className="mk-cmp-row mk-cmp-head" role="row">
              <span role="columnheader" />
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
                    <MarkCell mark={m} />
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
                <p className="mk-plan-note">{p.note || ' '}</p>
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
                  {...ext}
                >
                  {c.pricing.choose}
                  <ArrowRight size={18} className="mk-flip" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section className="mk-final" id="contact">
        <div className="mk-wrap mk-final-in">
          <h2>{c.final.title}</h2>
          <a href={cta} className="mk-btn mk-btn-accent mk-btn-lg" {...ext}>
            <WhatsAppIcon />
            {c.final.cta}
          </a>
          <a href={cta} className="mk-final-phone" {...ext} dir="ltr">
            +216 {CONTACT.whatsapp.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3')}
          </a>
        </div>
      </section>

      <footer className="mk-footer">
        <div className="mk-wrap mk-footer-in">
          <BrandLogo height={26} />
          <span>{c.footer}</span>
        </div>
      </footer>

      <a href={cta} className="mk-wa-float" aria-label={c.wa.label} {...ext}>
        <WhatsAppIcon size={28} />
      </a>
    </div>
  )
}
