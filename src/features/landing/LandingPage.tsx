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
} from 'lucide-react'
import { BrandLogo, BrandMark } from '@/components/BrandLogo'
import { CONTACT, LANDING_COPY } from './copy'
import type { Mark } from './copy'
import './landing.css'

/**
 * The public page a visitor sees on the bare domain.
 *
 * Built from plain HTML + one scoped stylesheet rather than Chakra components:
 * it is the first thing a prospect opens, often on a phone over 3G, and it has
 * no forms or state that would need the design system. Every visual is inline
 * SVG or CSS — no image to download, nothing to wait for.
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

function MarkCell({ mark }: { mark: Mark }) {
  if (mark === 'yes')
    return (
      <span className="mk-mark mk-yes" aria-label="✓">
        <Check size={18} strokeWidth={3} />
      </span>
    )
  if (mark === 'part')
    return (
      <span className="mk-mark mk-part" aria-label="~">
        <Minus size={18} strokeWidth={3} />
      </span>
    )
  return (
    <span className="mk-mark mk-no" aria-label="✗">
      <X size={18} strokeWidth={3} />
    </span>
  )
}

/** The till, drawn in CSS: what the product looks like before any word about it. */
function HeroMock({ c }: { c: (typeof LANDING_COPY)['fr']['mock'] }) {
  return (
    <div className="mk-mock" aria-hidden="true">
      <div className="mk-mock-win">
        <div className="mk-mock-bar">
          <i />
          <i />
          <i />
          <span>{c.title}</span>
        </div>
        <div className="mk-mock-body">
          <div className="mk-scan">
            <ScanBarcode size={20} />
            <span className="mk-scan-code">6191234567890</span>
            <span className="mk-scan-ok">
              <Check size={14} strokeWidth={3} /> {c.scanned}
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

      <div className="mk-float mk-float-a">
        <span className="mk-dot mk-dot-warn" />
        <div>
          <small>{c.low}</small>
          <b>{c.lowValue}</b>
        </div>
      </div>
      <div className="mk-float mk-float-b">
        <NotebookPen size={18} />
        <div>
          <small>{c.debt}</small>
          <b>{c.debtValue}</b>
        </div>
      </div>
      <div className="mk-float mk-float-c">
        <svg viewBox="0 0 96 36" width="96" height="36">
          <polyline
            points="2,32 18,26 32,28 48,18 62,20 78,9 94,4"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}

export function LandingPage() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'ar' ? 'ar' : 'fr'
  const c = LANDING_COPY[lang]

  const cta = CONTACT.whatsapp
    ? `https://wa.me/216${CONTACT.whatsapp}?text=${encodeURIComponent(c.waText)}`
    : '#tarifs'
  const external = cta.startsWith('http')
  const ctaProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}

  return (
    <div className="mk" lang={lang}>
      {/* ---------------- nav ---------------- */}
      <header className="mk-nav">
        <div className="mk-wrap mk-nav-in">
          <a href="#top" className="mk-logo" aria-label="Mektebti">
            <BrandLogo size={30} color="#ffffff" accent="#7d6dff" textColor="#ffffff" />
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
              {lang === 'ar' ? 'FR' : 'ع'}
            </button>
            <Link to="/login" className="mk-btn mk-btn-ghost">
              {c.nav.login}
            </Link>
          </nav>
        </div>
      </header>

      {/* ---------------- hero ---------------- */}
      <section className="mk-hero" id="top">
        <div className="mk-wrap mk-hero-in">
          <div className="mk-hero-text">
            <p className="mk-kicker">
              <BrandMark size={18} color="#a69cff" accent="#ffc24a" />
              {c.hero.kicker}
            </p>
            <h1>
              {c.hero.title1}
              <br />
              <span className="mk-grad">{c.hero.title2}</span>
            </h1>
            <p className="mk-sub">{c.hero.sub}</p>
            <div className="mk-ctas">
              <a href={cta} className="mk-btn mk-btn-accent" {...ctaProps}>
                {c.hero.cta}
                <ArrowRight size={18} className="mk-flip" />
              </a>
              <a href="#tarifs" className="mk-btn mk-btn-ghost">
                {c.hero.cta2}
              </a>
            </div>
            <ul className="mk-chips">
              {c.hero.chips.map((chip) => (
                <li key={chip}>
                  <Check size={14} strokeWidth={3} />
                  {chip}
                </li>
              ))}
            </ul>
          </div>
          <HeroMock c={c.mock} />
        </div>
      </section>

      {/* ---------------- features ---------------- */}
      <section className="mk-section">
        <div className="mk-wrap">
          <h2 className="mk-h2">{c.features.title}</h2>
          <div className="mk-features">
            {c.features.items.map(([key, title, body]) => {
              const Icon = FEATURE_ICONS[key] ?? Boxes
              return (
                <article className={`mk-feature mk-f-${key}`} key={key}>
                  <span className="mk-feature-icon">
                    <Icon size={26} />
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------------- comparison ---------------- */}
      <section className="mk-section mk-section-tint" id="pourquoi">
        <div className="mk-wrap">
          <h2 className="mk-h2">{c.why.title}</h2>
          <div className="mk-compare" role="table">
            <div className="mk-cmp-row mk-cmp-head" role="row">
              <span role="columnheader" />
              {c.why.cols.map((col, i) => (
                <span role="columnheader" key={col} className={i === 0 ? 'mk-cmp-us' : ''}>
                  {i === 0 ? <BrandMark size={22} /> : null}
                  {col}
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
                  <span className="mk-step-n">{i + 1}</span>
                  <Icon size={28} />
                  <b>{s}</b>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* ---------------- pricing ---------------- */}
      <section className="mk-section mk-section-dark" id="tarifs">
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
                <ul>
                  {p.perks.map((perk) => (
                    <li key={perk}>
                      <Check size={16} strokeWidth={3} />
                      {perk}
                    </li>
                  ))}
                </ul>
                <p className="mk-plan-note">{p.note || ' '}</p>
                <a
                  href={cta === '#tarifs' ? '#contact' : cta}
                  className={`mk-btn ${p.id === 'life' ? 'mk-btn-accent' : 'mk-btn-light'}`}
                  {...ctaProps}
                >
                  {c.pricing.choose}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section className="mk-final" id="contact">
        <div className="mk-wrap mk-final-in">
          <BrandMark size={56} color="#ffffff" accent="#ffc24a" />
          <h2>{c.final.title}</h2>
          <a href={cta} className="mk-btn mk-btn-accent mk-btn-lg" {...ctaProps}>
            {c.final.cta}
            <ArrowRight size={20} className="mk-flip" />
          </a>
        </div>
      </section>

      <footer className="mk-footer">
        <div className="mk-wrap mk-footer-in">
          <BrandLogo size={22} color="#a69cff" accent="#7d6dff" textColor="#c9c3ff" />
          <span>{c.footer}</span>
        </div>
      </footer>
    </div>
  )
}
