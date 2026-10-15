/**
 * The only script of the prerendered public pages (/decouvrir, /ar/decouvrir
 * and the legal pages). A few kilobytes, no React, no Firebase, no service
 * worker: the page itself is already complete HTML, and works with this
 * script blocked. All this adds is:
 *
 *  · the page language remembered for /login, on a visitor's browser only;
 *  · the campaign code on the WhatsApp links (src/lib/analytics.ts);
 *  · the cookie banner and the marketing events — both no-ops unless the
 *    tracking IDs were set at build time.
 */
import { campaignRef, startTracking, track } from '@/lib/analytics'
import type { CtaLocation } from '@/lib/analytics'
import { openConsentBanner } from './consent'
import { isShopMachine } from './shopMachine'
import type { Lang } from './copy'

const lang: Lang = document.documentElement.lang === 'ar' ? 'ar' : 'fr'
const shopMachine = isShopMachine()

/**
 * So « Se connecter » opens the login in the language the visitor was reading.
 * Never on a shop machine: there the language is the till's own setting, and
 * glancing at the French page must not switch the shop's till to French.
 */
function rememberLang(next: Lang) {
  if (shopMachine) return
  try {
    localStorage.setItem('lang', next)
  } catch {
    /* blocked storage: /login just opens in French */
  }
}
rememberLang(lang)

const ref = campaignRef(location.search)
if (ref) {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-mk="wa"]')) {
    try {
      const url = new URL(a.href)
      const text = url.searchParams.get('text') ?? ''
      url.searchParams.set('text', `${text}\n\n(réf. ${ref})`)
      a.href = url.toString()
    } catch {
      /* leave the link as it was */
    }
  }
}

const tracking = startTracking()
const active = tracking.status === 'ask' || tracking.status === 'on'

const askConsent = (details: boolean, focus: boolean) =>
  openConsentBanner({ lang, current: tracking.current, details, focus, onDecide: tracking.decide })

if (tracking.status === 'ask') askConsent(false, false)

if (tracking.status !== 'off') {
  for (const manage of document.querySelectorAll<HTMLButtonElement>('button[data-mk="consent"]')) {
    manage.hidden = false
    manage.addEventListener('click', () => askConsent(true, true))
  }
}

/** A plain left click, i.e. one this page may finish itself after the event. */
const plainClick = (ev: MouseEvent) => ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey

document.addEventListener('click', (ev) => {
  const a = ev.target instanceof Element ? ev.target.closest<HTMLAnchorElement>('a[data-mk]') : null
  if (!a) return
  const loc = (a.dataset.loc ?? 'hero') as CtaLocation
  // Links that leave this page: wait for the event (≤ 600 ms) before going.
  const leave = (send: (go: () => void) => void) => {
    if (!active || !plainClick(ev)) return send(() => {})
    ev.preventDefault()
    send(() => window.location.assign(a.href))
  }
  switch (a.dataset.mk) {
    case 'wa':
      if (a.dataset.plan) track({ event: 'plan_select', plan: a.dataset.plan })
      track({ event: 'cta_whatsapp_click', cta_location: loc, plan: a.dataset.plan })
      break
    case 'call':
      track({ event: 'cta_phone_click', cta_location: loc })
      break
    case 'login':
      leave((go) => track({ event: 'login_click', cta_location: 'nav' }, go))
      break
    case 'lang': {
      const to: Lang = a.dataset.lang === 'ar' ? 'ar' : 'fr'
      rememberLang(to)
      leave((go) => track({ event: 'lang_switch', lang_from: lang, lang_to: to }, go))
      break
    }
  }
})

if (active) {
  // « Saw the prices »: the audience Meta's ViewContent is built on. Half the
  // section, or half the screen when the section is taller than that — on a
  // phone the three plans stack far past one screen and would never be "half
  // visible".
  const prices = document.getElementById('tarifs')
  if (prices && typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.some(
          (e) =>
            e.isIntersecting &&
            e.intersectionRect.height >= Math.min(e.boundingClientRect.height, window.innerHeight) * 0.5,
        )
        if (!seen) return
        io.disconnect()
        track({ event: 'pricing_view', section: 'tarifs' })
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    )
    io.observe(prices)
  }

  const fired = new Set<number>()
  let raf = 0
  const check = () => {
    raf = 0
    const max = document.documentElement.scrollHeight - window.innerHeight
    const pct = max <= 0 ? 100 : (window.scrollY / max) * 100
    for (const t of [25, 50, 75, 90] as const) {
      if (pct >= t && !fired.has(t)) {
        fired.add(t)
        track({ event: 'scroll_depth', percent_scrolled: t })
      }
    }
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!raf) raf = requestAnimationFrame(check)
    },
    { passive: true },
  )
}
