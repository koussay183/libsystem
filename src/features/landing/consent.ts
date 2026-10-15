/**
 * The cookie banner of the public pages, in plain DOM: the static pages carry
 * no React, and this is a few buttons.
 *
 * Shaped by docs/launch/05-tracking-gtm-pixel.md §2.2 and doc 02 §5.4: three
 * buttons of equal weight (refusing is as easy as accepting), both purposes
 * off by default under « Personnaliser », a link to the privacy page, and a
 * fixed card that never blocks the page or shifts the layout. The Arabic still
 * needs a native speaker's and the lawyer's read before the IDs go live.
 */
import type { ConsentChoice } from '@/lib/analytics'
import type { Lang } from './copy'

const COPY = {
  fr: {
    title: 'Cookies et mesure d’audience',
    body: 'Avec votre accord, Mektebti.tn utilise des cookies de Google et de Meta pour mesurer l’audience du site et savoir quelle publicité vous a amené ici. Rien n’est activé si vous refusez. Vous pouvez changer d’avis à tout moment via « Gérer mes cookies » en bas de page.',
    more: 'En savoir plus',
    refuse: 'Refuser',
    customize: 'Personnaliser',
    accept: 'Accepter',
    save: 'Enregistrer mes choix',
    analytics: 'Mesure d’audience (Google Analytics)',
    analyticsHelp: 'Compter les visites et les clics, de façon agrégée.',
    ads: 'Publicité (Google Ads, Meta)',
    adsHelp: 'Mesurer l’efficacité de nos publicités et vous en montrer de plus pertinentes.',
  },
  ar: {
    title: 'الكوكيز وقيس عدد الزوار',
    body: 'بموافقتك، يستعمل موقع مكتبتي كوكيز من Google و Meta باش نقيسو عدد الزوار ونعرفو أنهو الإشهار اللي جابك لهنا. ما يتفعّل حتى شيء إذا رفضت. تنجم تبدّل رأيك وقت ما تحب من «إعدادات الكوكيز» في أسفل الصفحة.',
    more: 'اعرف أكثر',
    refuse: 'نرفض',
    customize: 'نختار بنفسي',
    accept: 'نقبل',
    save: 'سجّل اختياراتي',
    analytics: 'قيس عدد الزوار (Google Analytics)',
    analyticsHelp: 'نحسبو الزيارات والنقرات بصفة إجمالية.',
    ads: 'الإشهار (Google Ads و Meta)',
    adsHelp: 'نقيسو نجاعة إعلاناتنا ونوريولك إعلانات تهمّك أكثر.',
  },
} satisfies Record<Lang, Record<string, string>>

type Copy = (typeof COPY)['fr']

let open: { el: HTMLElement; stop: () => void } | null = null

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  Object.assign(node, props)
  node.append(...children)
  return node
}

function closeBanner() {
  if (!open) return
  open.stop()
  open.el.remove()
  open = null
}

export interface BannerOptions {
  lang: Lang
  /** The stored choice, to pre-fill the switches when reopened from the footer. */
  current: ConsentChoice | null
  /** Straight to the two switches (reopened from « Gérer mes cookies »). */
  details: boolean
  /** Reopened by a click: move focus into the banner. Never on page load. */
  focus: boolean
  onDecide: (analytics: boolean, ads: boolean) => void
}

export function openConsentBanner(opts: BannerOptions): void {
  closeBanner()
  const c: Copy = COPY[opts.lang]

  const box = el('section', { className: 'mkc', lang: opts.lang, dir: opts.lang === 'ar' ? 'rtl' : 'ltr' })
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'false')
  box.setAttribute('aria-labelledby', 'mkc-title')

  const title = el('h2', { id: 'mkc-title', tabIndex: -1 }, c.title)
  const more = el('a', { href: '/confidentialite#cookies' }, c.more)
  box.append(title, el('p', {}, c.body + ' ', more))

  const analytics = el('input', { type: 'checkbox', checked: opts.current?.analytics ?? false })
  const ads = el('input', { type: 'checkbox', checked: opts.current?.ads ?? false })
  const opt = (input: HTMLInputElement, label: string, help: string) =>
    el('label', {}, input, el('span', {}, label), el('small', {}, help))
  const options = el('div', { className: 'mkc-opts' }, opt(analytics, c.analytics, c.analyticsHelp), opt(ads, c.ads, c.adsHelp))

  const decide = (a: boolean, d: boolean) => {
    closeBanner()
    opts.onDecide(a, d)
  }
  const button = (label: string, onClick: () => void) => {
    const b = el('button', { type: 'button', className: 'mkc-btn' }, label)
    b.addEventListener('click', onClick)
    return b
  }

  const middle = button(c.customize, () => showDetails(true))
  const actions = el(
    'div',
    { className: 'mkc-actions' },
    button(c.refuse, () => decide(false, false)),
    middle,
    button(c.accept, () => decide(true, true)),
  )
  box.append(actions)

  const showDetails = (focus: boolean) => {
    box.insertBefore(options, actions)
    const save = button(c.save, () => decide(analytics.checked, ads.checked))
    middle.replaceWith(save)
    if (focus) analytics.focus()
  }
  if (opts.details) showDetails(false)

  document.body.append(box)

  // Keeps the floating WhatsApp button above the banner, whatever its height.
  const root = document.documentElement
  const setOffset = () => root.style.setProperty('--mk-consent-offset', `${box.offsetHeight + 16}px`)
  setOffset()
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(setOffset) : null
  ro?.observe(box)
  open = {
    el: box,
    stop: () => {
      ro?.disconnect()
      root.style.removeProperty('--mk-consent-offset')
    },
  }

  if (opts.focus) title.focus()
}
