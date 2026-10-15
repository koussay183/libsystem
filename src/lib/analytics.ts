/**
 * Marketing tags (GTM, and through it GA4, Google Ads and the Meta Pixel), for
 * the public pages and nothing else. The design and the GTM setup are in
 * docs/launch/05-tracking-gtm-pixel.md; this file is its §6.2, condensed.
 *
 * Only the prerendered public pages import this (src/features/landing/static.ts).
 * The till must never load it: its screens show customers' names, phones and
 * debts, it runs all day on low-end PCs, and src/main.tsx promises "no
 * telemetry here". The rules below are enforced here, in code, so no GTM
 * setting can override them:
 *
 *  · VITE_GTM_ID unset (or malformed) → nothing at all: no banner, no
 *    dataLayer, no request. The other IDs only switch their own channel.
 *  · not a public path, a browser where anybody ever signed in, the installed
 *    app, or a device opted out with ?mk_notrack=1 → nothing either.
 *  · Consent Mode v2, default denied, and GTM itself is not even requested
 *    until the visitor accepts ("basic" mode). Events wait in memory meanwhile
 *    and are dropped on refusal.
 */
import { hasSessionHere, isPublicPath, isShopMachine } from '@/features/landing/shopMachine'

declare global {
  interface Window {
    dataLayer?: unknown[]
    /** Set the moment a tag script is injected into THIS document. Never cleared. */
    __mkTracking?: 'loading' | 'loaded' | 'failed'
  }
}

export interface TrackingIds {
  gtmId: string
  /** '' when unset or malformed, here and below. */
  ga4Id: string
  gadsId: string
  /** 'AW-123456789' → '123456789', the form GTM's Ads tags want. */
  gadsConversionId: string
  gadsLabelWhatsapp: string
  metaPixelId: string
}

const pick = (raw: unknown, re: RegExp) => {
  const v = typeof raw === 'string' ? raw.trim() : ''
  return re.test(v) ? v : ''
}

/** null = tracking is OFF for this build. Literal env reads, so Vite inlines them. */
export function readTrackingIds(): TrackingIds | null {
  const gtmId = pick(import.meta.env.VITE_GTM_ID, /^GTM-[A-Z0-9]{4,12}$/)
  if (!gtmId) return null
  const gadsId = pick(import.meta.env.VITE_GADS_ID, /^AW-\d{6,14}$/)
  return {
    gtmId,
    ga4Id: pick(import.meta.env.VITE_GA4_ID, /^G-[A-Z0-9]{4,16}$/),
    gadsId,
    gadsConversionId: gadsId ? gadsId.slice(3) : '',
    gadsLabelWhatsapp: gadsId ? pick(import.meta.env.VITE_GADS_CONV_LABEL_WHATSAPP, /^[\w-]{6,40}$/) : '',
    metaPixelId: pick(import.meta.env.VITE_META_PIXEL_ID, /^\d{8,20}$/),
  }
}

/** Never reassigned once it exists: Google warns that wipes queued messages. */
export function dataLayer(): unknown[] {
  return (window.dataLayer = window.dataLayer || [])
}

/**
 * Google's gtag(). It must push the `arguments` object itself — Consent Mode
 * ignores a plain array — hence a function declaration and not an arrow.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function gtag(..._args: unknown[]): void {
  // eslint-disable-next-line prefer-rest-params
  dataLayer().push(arguments)
}

/* ------------------------------------------------------------- consent --- */

export interface ConsentChoice {
  v: number
  analytics: boolean
  ads: boolean
  at: string
}

const CONSENT_KEY = 'mk:consent'
/** Bump when a vendor or purpose is added: everyone is asked again. */
const CONSENT_VERSION = 1
/** Asked again after 180 days: our choice, inside the 13-month cookie ceiling. */
const MAX_AGE_MS = 180 * 24 * 3600 * 1000

/** null = undecided, expired, an older version, or storage blocked. */
export function readConsent(): ConsentChoice | null {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null') as ConsentChoice | null
    if (!c || c.v !== CONSENT_VERSION) return null
    if (!(Date.now() - Date.parse(c.at) < MAX_AGE_MS)) return null
    return { v: c.v, analytics: c.analytics === true, ads: c.ads === true, at: c.at }
  } catch {
    return null
  }
}

/** Also the on-device record of the choice: what, when, under which version. */
function storeConsent(analytics: boolean, ads: boolean): ConsentChoice {
  const c = { v: CONSENT_VERSION, analytics, ads, at: new Date().toISOString() }
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(c))
  } catch {
    /* blocked storage: honoured for this page, asked again next visit */
  }
  return c
}

let defaulted = false
/** First thing on the page: Google ignores defaults that arrive after a tag. */
function pushConsentDefault(): void {
  if (defaulted) return
  defaulted = true
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  })
  gtag('set', 'ads_data_redaction', true)
  gtag('set', 'url_passthrough', false)
}

const g = (b: boolean) => (b ? 'granted' : 'denied')

function pushConsentUpdate(c: Pick<ConsentChoice, 'analytics' | 'ads'>): void {
  gtag('consent', 'update', {
    analytics_storage: g(c.analytics),
    ad_storage: g(c.ads),
    ad_user_data: g(c.ads),
    ad_personalization: g(c.ads),
  })
  dataLayer().push({ event: 'consent_update', consent_analytics: g(c.analytics), consent_ads: g(c.ads) })
}

const TRACKING_COOKIE = /^(_ga|_ga_.+|_gid|_gcl_.+|_fbp|_fbc)$/

/** Best effort, on the host and its parent; the browser refuses a public suffix. */
function clearTrackingCookies(): void {
  const host = location.hostname
  const parent = host.split('.').slice(-2).join('.')
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (!TRACKING_COOKIE.test(name)) continue
    for (const domain of ['', host, '.' + host, '.' + parent]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? '; domain=' + domain : ''}`
    }
  }
}

/* ----------------------------------------------------------------- GTM --- */

/**
 * Pushes the configuration and the container start NOW, so they sit ahead of
 * every queued event in the dataLayer, and injects gtm.js now or at idle.
 */
function bootGtm(ids: TrackingIds, c: ConsentChoice, defer: boolean): void {
  if (window.__mkTracking) return
  window.__mkTracking = 'loading'
  const yes = (b: boolean) => (b ? 'yes' : 'no')
  const dl = dataLayer()
  dl.push({
    // Gallery templates (the Meta Pixel) may run; Custom HTML and Custom JS may not.
    'gtm.allowlist': ['sandboxedScripts'],
    'gtm.blocklist': ['customScripts'],
    mk_ga4_id: ids.ga4Id,
    mk_gads_id: ids.gadsId,
    mk_gads_conversion_id: ids.gadsConversionId,
    mk_gads_label_whatsapp: ids.gadsLabelWhatsapp,
    mk_meta_pixel_id: ids.metaPixelId,
    // One flag per channel = "its ID is set AND the visitor said yes". The GTM
    // triggers test only these (doc 05 §4.5).
    mk_send_ga4: yes(!!ids.ga4Id && c.analytics),
    mk_send_ads: yes(!!ids.gadsId && c.ads),
    mk_send_ads_whatsapp: yes(!!ids.gadsId && !!ids.gadsLabelWhatsapp && c.ads),
    mk_send_meta: yes(!!ids.metaPixelId && c.ads),
  })
  dl.push({ 'gtm.start': Date.now(), event: 'gtm.js' })

  const inject = () => {
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(ids.gtmId)
    s.onload = () => {
      window.__mkTracking = 'loaded'
    }
    // Offline or an ad blocker: nothing to retry, nothing to show.
    s.onerror = () => {
      window.__mkTracking = 'failed'
    }
    document.head.appendChild(s)
  }
  if (!defer) return inject()
  // A returning visitor: never compete with the page's first paint on 3G.
  const idle = () =>
    window.requestIdleCallback ? window.requestIdleCallback(inject, { timeout: 4000 }) : window.setTimeout(inject, 2000)
  if (document.readyState === 'complete') idle()
  else window.addEventListener('load', idle, { once: true })
}

/* -------------------------------------------------------------- events --- */

export type CtaLocation = 'hero' | 'pricing' | 'final' | 'float' | 'nav'

export type MkEvent =
  | { event: 'page_view' }
  | { event: 'pricing_view'; section: 'tarifs' }
  | { event: 'plan_select'; plan: string }
  | { event: 'cta_whatsapp_click'; cta_location: CtaLocation; plan?: string }
  | { event: 'cta_phone_click'; cta_location: CtaLocation }
  | { event: 'login_click'; cta_location: 'nav' }
  | { event: 'lang_switch'; lang_from: string; lang_to: string }
  | { event: 'scroll_depth'; percent_scrolled: 25 | 50 | 75 | 90 }

/** off = nothing recorded; pending = banner unanswered, events wait in memory. */
let state: 'off' | 'pending' | 'on' = 'off'
const queue: Record<string, unknown>[] = []
const MAX_QUEUE = 30

function setState(next: typeof state): void {
  state = next
  if (next === 'on') for (const e of queue.splice(0)) dataLayer().push(e)
  if (next === 'off') queue.length = 0
}

/** Every key an event can carry, reset on each push: GTM's data model keeps old keys. */
const RESET = {
  cta_location: undefined,
  plan: undefined,
  lead_source: undefined,
  section: undefined,
  percent_scrolled: undefined,
  lang_from: undefined,
  lang_to: undefined,
}

/**
 * Records one event. `then` runs once the event is out (GTM's eventCallback),
 * or at once when nothing is listening — use it for a click that leaves the
 * page, so the event is not lost with the document.
 */
export function track(e: MkEvent, then?: () => void): void {
  const payload: Record<string, unknown> = {
    ...RESET,
    ...(e.event === 'cta_whatsapp_click' ? { lead_source: 'whatsapp' } : null),
    ...e,
    event_id: newEventId(),
    page_location: cleanLocation(),
    page_path: location.pathname,
    page_title: document.title,
    ui_language: document.documentElement.lang === 'ar' ? 'ar' : 'fr',
  }
  if (isDebug()) console.info('[mk-track]', state, payload)
  if (state === 'on') {
    if (then) {
      const go = once(then)
      payload.eventCallback = go
      payload.eventTimeout = 400
      // GTM blocked, slow or still loading: leave anyway.
      window.setTimeout(go, 600)
    }
    dataLayer().push(payload)
    return
  }
  if (state === 'pending' && queue.length < MAX_QUEUE) queue.push(payload)
  then?.()
}

const KEPT_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
  'gclid', 'gbraid', 'wbraid', 'gad_source', 'fbclid',
]

/** Origin + path + campaign parameters only: nothing else from the URL leaves the page. */
export function cleanLocation(href = location.href): string {
  const u = new URL(href)
  const out = new URL(u.origin + u.pathname)
  for (const k of KEPT_PARAMS) {
    const v = u.searchParams.get(k)
    if (v) out.searchParams.set(k, v.slice(0, 100))
  }
  return out.toString()
}

/**
 * A campaign-level code for the pre-filled WhatsApp message, so a lead can be
 * traced to its campaign even when the visitor refused cookies. Never a
 * per-visitor id: it cannot identify anybody, and it is never stored.
 */
export function campaignRef(search: string): string {
  const q = new URLSearchParams(search)
  const campaign = (q.get('utm_campaign') ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  if (campaign) return campaign.slice(0, 24)
  if (q.has('gclid') || q.has('gbraid') || q.has('wbraid')) return 'gads'
  if (q.has('fbclid')) return 'meta'
  return ''
}

function newEventId(): string {
  try {
    if (crypto.randomUUID) return crypto.randomUUID()
  } catch {
    /* older browser or insecure context */
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)
}

function isDebug(): boolean {
  try {
    if (new URLSearchParams(location.search).get('mk_debug') === '1') sessionStorage.setItem('mk:debug', '1')
    return sessionStorage.getItem('mk:debug') === '1'
  } catch {
    return false
  }
}

function once(fn: () => void): () => void {
  let done = false
  return () => {
    if (done) return
    done = true
    fn()
  }
}

/* ------------------------------------------------------------ decision --- */

/**
 * May this browser be tracked at all? Opt-out (?mk_notrack=1, for the
 * founders' own phones) and the test override (?mk_track=1, or Tag
 * Assistant's gtm_debug) are remembered; the override never skips the
 * "nobody signed in here" rule.
 */
function mayTrackHere(): boolean {
  if (!isPublicPath(location.pathname)) return false
  if (hasSessionHere()) return false
  const q = new URLSearchParams(location.search)
  try {
    if (q.get('mk_notrack') === '1') localStorage.setItem('mk:noTrack', '1')
    if (q.get('mk_notrack') === '0') localStorage.removeItem('mk:noTrack')
    if (q.has('mk_track') || q.has('gtm_debug')) sessionStorage.setItem('mk:forceTrack', '1')
    if (sessionStorage.getItem('mk:forceTrack') === '1') return true
    if (localStorage.getItem('mk:noTrack') === '1') return false
  } catch {
    /* storage blocked: fall through to the defaults */
  }
  if (import.meta.env.DEV) return false
  return !isShopMachine()
}

export type TrackingStatus = 'off' | 'ask' | 'on' | 'refused'

export interface Tracking {
  readonly status: TrackingStatus
  /** The stored choice, to pre-fill the banner's switches. */
  readonly current: ConsentChoice | null
  /** The visitor's answer from the banner. */
  decide(analytics: boolean, ads: boolean): void
}

/**
 * Decides once per page, pushes the consent default, and boots GTM straight
 * away for a visitor who already accepted. 'ask' means: show the banner.
 */
export function startTracking(): Tracking {
  const ids = readTrackingIds()
  let status: TrackingStatus = 'off'
  let current: ConsentChoice | null = null

  if (ids && mayTrackHere()) {
    pushConsentDefault()
    current = readConsent()
    if (!current) {
      status = 'ask'
      setState('pending')
    } else if (!current.analytics && !current.ads) {
      status = 'refused'
    } else {
      pushConsentUpdate(current)
      bootGtm(ids, current, true)
      status = 'on'
      setState('on')
    }
    track({ event: 'page_view' })
  }

  return {
    get status() {
      return status
    },
    get current() {
      return current
    },
    decide(analytics: boolean, ads: boolean) {
      if (!ids || status === 'off') return
      current = storeConsent(analytics, ads)
      if (window.__mkTracking) {
        // Tags cannot be unloaded from a live page: withdraw = clean up and reload.
        if (!analytics || !ads) clearTrackingCookies()
        window.location.reload()
        return
      }
      if (!analytics && !ads) {
        status = 'refused'
        setState('off')
        return
      }
      const wasRefused = status === 'refused'
      pushConsentUpdate(current)
      bootGtm(ids, current, false)
      status = 'on'
      // Flushes the page_view queued while the banner was up. After an earlier
      // refusal nothing was queued, so this page's view is sent now.
      setState('on')
      if (wasRefused) track({ event: 'page_view' })
    },
  }
}
