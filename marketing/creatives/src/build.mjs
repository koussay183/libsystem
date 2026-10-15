// Renders the Mektebti.tn ad creatives (Meta feed + story, Google Display)
// from HTML/CSS/SVG with Playwright/Chromium, then palette-compresses the PNGs.
//
//   node marketing/creatives/src/build.mjs            # everything
//   node marketing/creatives/src/build.mjs 03 ar      # filter: concept id / lang / format
//   DEBUG_SAFE=1 node ... story                       # overlay Meta story safe zones (review only)
//
// Env: PLAYWRIGHT_MODULE (path to the 'playwright' package), CHROMIUM_PATH,
//      SHARP_MODULE (optional, path to 'sharp' for PNG palette compression).
// The logo is never redrawn: the original PNGs from public/brand/ are placed as-is.

import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { CONCEPTS, COMMON, PHONE, DISPLAY } from './copy.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(here, '..')
const REPO = path.resolve(here, '../../..')
const url = (p) => pathToFileURL(p).href
const LOGO = url(path.join(REPO, 'public/brand/logo-on-light.png'))
const FONT = (f) => url(path.join(here, 'fonts', f))

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/tmp/claude-0/shots/node_modules/playwright')
let sharp = null
try {
  sharp = require(process.env.SHARP_MODULE || 'sharp')
} catch {
  console.warn('sharp not found: PNGs are written uncompressed (set SHARP_MODULE).')
}

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s).replace(/&(?!#?\w+;)/g, '&amp;')
const ARABIC_RANGE =
  'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0898-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC'
const LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'

const fontFaces = `
@font-face{font-family:'InterV';src:url(${FONT('inter-latin-opsz-normal.woff2')}) format('woff2');font-weight:100 900;font-display:block}
${[600, 800, 900]
  .map(
    (w) => `
@font-face{font-family:'Cairo';src:url(${FONT(`cairo-arabic-${w}-normal.woff2`)}) format('woff2');font-weight:${w};unicode-range:${ARABIC_RANGE};font-display:block}
@font-face{font-family:'Cairo';src:url(${FONT(`cairo-latin-${w}-normal.woff2`)}) format('woff2');font-weight:${w};unicode-range:${LATIN_RANGE};font-display:block}`,
  )
  .join('')}`

// Real EAN-13 bars (Tunisian GS1 prefix 619) so the barcode reads as genuine.
function ean13(d12) {
  const d = d12.split('').map(Number)
  const sum = d.reduce((s, n, i) => s + n * (i % 2 ? 3 : 1), 0)
  const all = [...d, (10 - (sum % 10)) % 10]
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
  const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
  const R = L.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).join(''))
  const P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'][all[0]]
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (P[i - 1] === 'L' ? L : G)[all[i]]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[all[i]]
  return { bits: bits + '101', digits: all.join('') }
}

function barcodeSvg(code = '619401234567', { digits = true } = {}) {
  const { bits, digits: txt } = ean13(code)
  const q = 9
  const guard = (i) => i < 3 || (i >= 45 && i < 50) || i >= 92
  let rects = ''
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue
    let j = i
    while (j + 1 < bits.length && bits[j + 1] === '1' && guard(j + 1) === guard(i)) j++
    rects += `<rect x="${q + i}" y="0" width="${j - i + 1}" height="${guard(i) ? 62 : (digits ? 55 : 62)}"/>`
    i = j
  }
  const t = digits
    ? `<g font-family="InterV,Cairo" font-weight="600" font-size="9" text-anchor="middle" fill="#0B0A1F">
        <text x="${q - 4}" y="64">${txt[0]}</text>
        <text x="${q + 3 + 21}" y="64" letter-spacing="1.6">${txt.slice(1, 7)}</text>
        <text x="${q + 50 + 21}" y="64" letter-spacing="1.6">${txt.slice(7)}</text></g>`
    : ''
  return `<svg viewBox="0 0 ${95 + 2 * q} 66" width="100%" height="100%" preserveAspectRatio="none" fill="#0B0A1F">${rects}${t}</svg>`
}

function burst(n = 14, ro = 50, ri = 39) {
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro
    const a = (Math.PI * i) / n - Math.PI / 2
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`)
  }
  return `<svg viewBox="0 0 100 100" width="100%" height="100%"><polygon points="${pts.join(' ')}" fill="#FFAD20"/></svg>`
}

const ICON = {
  phone: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`,
  check: (c = '#fff') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.5l4.2 4.2L18.5 7.8"/></svg>`,
  wifiOff: `<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round">
    <g stroke="rgba(255,255,255,.55)" stroke-width="2"><path d="M2.2 9a15 15 0 0 1 19.6 0"/><path d="M5.3 12.6a10.2 10.2 0 0 1 13.4 0"/><path d="M8.6 16.1a5.3 5.3 0 0 1 6.8 0"/></g>
    <circle cx="12" cy="19.6" r="1.4" fill="rgba(255,255,255,.55)"/>
    <path d="M3.5 3.5l17 17" stroke="#FFAD20" stroke-width="2.6"/></svg>`,
  sync: `<svg viewBox="0 0 24 24" fill="none" stroke="#0B0A1F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9"/><path d="M4.5 12a7.5 7.5 0 0 1 13.2-4.9"/><path d="M18.2 3.6v3.6h-3.6"/><path d="M5.8 20.4v-3.6h3.6"/></svg>`,
  arrow: (c) =>
    `<svg viewBox="0 0 64 24" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h54"/><path d="M47 3l10 9-10 9"/></svg>`,
}

const pencilSvg = `<svg viewBox="0 0 320 44" width="100%" height="100%">
  <rect x="0" y="2" width="40" height="40" rx="9" fill="#FF8FA3"/>
  <rect x="32" y="2" width="26" height="40" fill="#C9CCD6"/><path d="M40 2v40M48 2v40" stroke="#A5A9B8" stroke-width="2"/>
  <rect x="58" y="2" width="200" height="13" fill="#FFC85A"/><rect x="58" y="15" width="200" height="14" fill="#FFAD20"/><rect x="58" y="29" width="200" height="13" fill="#E8930A"/>
  <polygon points="258,2 318,22 258,42" fill="#F3D3A1"/><polygon points="300,16 318,22 300,28" fill="#0B0A1F"/></svg>`

// ---------------------------------------------------------------- visuals
// Each visual is a fixed design box (w×h) laid out with logical properties
// (inset-inline-start…) so the Arabic version mirrors itself; it is then
// scaled to fit the stage of each format.

function vScanner(t, lang, variant = 'wide') {
  const ticket = `
    <div class="ticket-wrap" style="--rot:4deg">
      <div class="ticket ${lang}">
        <div class="tk-shop">${t.shop}</div>
        <div class="tk-no">${t.ticketNo}</div>
        <div class="tk-hr"></div>
        ${t.lines.map(([a, q, p]) => `<div class="tk-row"><span>${a} <i dir="ltr">${q}</i></span><b>${p}</b></div>`).join('')}
        <div class="tk-hr"></div>
        <div class="tk-row tk-total"><span>${t.total[0]}</span><b>${t.total[1]}</b></div>
        <div class="tk-thanks">${t.thanks}</div>
      </div>
    </div>`
  const code = `
    <div class="bc-card" dir="ltr" style="--rot:-5deg"><div class="bc">${barcodeSvg()}</div></div>
    <div class="laser" style="--rot:-5deg"></div>`
  const bip = `<div class="bip"><div class="bip-star">${burst()}</div><span>${t.bip}</span></div>`
  if (variant === 'tall') {
    return {
      w: 540, h: 560,
      html: `
      <div class="abs" style="inset-inline-end:0;top:0;width:310px">${ticket}</div>
      <div class="abs" style="inset-inline-start:0;top:400px;width:360px;height:200px">${code}</div>
      <div class="abs" style="inset-inline-start:20px;top:150px;width:170px;height:170px">${bip}</div>`,
    }
  }
  return {
    w: 900, h: 410,
    html: `
      <div class="abs" style="inset-inline-start:10px;top:110px;width:440px;height:250px">${code}</div>
      <div class="abs" style="inset-inline-start:300px;top:-6px;width:185px;height:185px">${bip}</div>
      <div class="abs" style="inset-inline-end:20px;top:0;width:330px">${ticket}</div>`,
  }
}

function vCarnet(t, lang) {
  const scribble = t.scribbles
    .map((s, i) => `<div class="nb-line" style="top:${86 + i * 58}px;--rot:${[-2, 1.5, -1, 2][i]}deg">${s}</div>`)
    .join('')
  return {
    w: 900, h: 420,
    html: `
    <div class="abs nb" style="inset-inline-start:10px;top:30px;--rot:-6deg">
      <div class="nb-rings">${'<i></i>'.repeat(8)}</div>
      <div class="nb-margin"></div>
      ${scribble}
      <svg class="nb-scrawl" viewBox="0 0 100 20"><path d="M2 12c8-9 12 6 20-2s10 7 18-1 12 6 20-2 10 6 18-1 12 5 20 0" fill="none" stroke="#3b3a8f" stroke-width="2.2" stroke-linecap="round"/></svg>
      <div class="nb-strike"></div>
    </div>
    <div class="abs flipx" style="inset-inline-start:356px;top:186px;width:70px;height:28px">${ICON.arrow('#2A12CF')}</div>
    <div class="abs card carnet" style="inset-inline-end:6px;top:6px;width:452px">
      <div class="cd-head">${t.cardTitle}</div>
      <div class="cd-due"><span>${t.dueLabel}</span><b>${t.due}</b></div>
      ${t.rows
        .map(
          ([ini, name, since, amt, late]) => `
        <div class="cd-row"><span class="av">${ini}</span><span class="nm"><b>${name}</b><i class="${late ? 'late' : ''}">${since}</i></span><b class="amt">${amt}</b></div>`,
        )
        .join('')}
    </div>`,
  }
}

function vRentree(t, lang) {
  return {
    w: 900, h: 420,
    html: `
    <div class="abs pencil" style="inset-inline-start:0;top:330px;width:330px;height:46px;--rot:-14deg">${pencilSvg}</div>
    <div class="abs" style="inset-inline-start:30px;top:70px;width:300px;height:190px">
      <div class="bc-card small" dir="ltr" style="--rot:-6deg"><div class="bc">${barcodeSvg('619401200017')}</div></div>
      <div class="laser" style="--rot:-6deg"></div>
    </div>
    <div class="abs flipx" style="inset-inline-start:340px;top:170px;width:66px;height:26px">${ICON.arrow('#FFAD20')}</div>
    <div class="abs card pack" style="inset-inline-end:10px;top:0;width:470px">
      <div class="pk-head"><b>${t.pack}</b><span class="pill amber">${t.scan}</span></div>
      ${t.items.map(([a, q]) => `<div class="pk-row"><span class="ck">${ICON.check()}</span><span class="it">${a}</span><i dir="ltr">${q}</i></div>`).join('')}
      <div class="pk-total"><span>${t.total[0]}</span><b>${t.total[1]}</b></div>
    </div>`,
  }
}

function vOffline(t, lang) {
  return {
    w: 900, h: 400,
    html: `
    <div class="abs off-disc" style="inset-inline-start:20px;top:10px">
      <div class="off-ic">${ICON.wifiOff}</div>
      <span class="pill amber big">${t.offline}</span>
    </div>
    <div class="abs card till" style="inset-inline-end:10px;top:8px;width:500px">
      <div class="tl-head"><b>${t.till}</b><span class="status"><i></i>${t.offline}</span></div>
      ${t.lines.map(([a, q, p]) => `<div class="tl-row"><span>${a} <i dir="ltr">${q}</i></span><b>${p}</b></div>`).join('')}
      <div class="tl-total"><span>${t.total[0]}</span><b>${t.total[1]}</b></div>
      <div class="tl-ok"><span class="ck green">${ICON.check()}</span>${t.saved}</div>
    </div>`,
  }
}

function vPrice(t, lang, variant = 'wide') {
  const w = variant === 'tall' ? 700 : 936
  return {
    w, h: 300, align: variant === 'tall' ? 'start' : 'center',
    html: `
    <div class="abs" style="inset-inline-start:0;top:0;width:${w}px">
      <div class="perks ${variant === 'tall' ? 'one' : ''}">${t.perks.map((p) => `<div class="perk"><span class="ck blue">${ICON.check()}</span>${p}</div>`).join('')}</div>
      ${variant === 'tall' ? '' : `<div class="fine">${t.fine}</div>`}
    </div>`,
  }
}

function screenUi(t) {
  return `<div class="ui"><div class="ui-bar"><i></i><i></i><i></i><span>${t.screen}</span></div>
    ${t.rows.map(([a, v, hl]) => `<div class="ui-row ${hl ? 'hl' : ''}"><span>${a}</span><b>${v}</b></div>`).join('')}</div>`
}

function vStock(t, lang) {
  return {
    w: 980, h: 420,
    html: `
    <div class="abs mon" style="inset-inline-start:0;top:0;width:410px">
      <div class="scr">${screenUi(t)}</div><div class="neck"></div><div class="foot"></div>
      <span class="dev-l">${t.a}</span>
    </div>
    <div class="abs lap" style="inset-inline-start:560px;top:46px;width:420px">
      <div class="scr">${screenUi(t)}</div><div class="kb"></div>
      <span class="dev-l">${t.b}</span>
    </div>
    <div class="abs sync" style="inset-inline-start:430px;top:84px">
      <div class="sync-ic">${ICON.sync}</div>
      <span class="live"><i></i>${t.live}</span>
    </div>`,
  }
}

const VIS = {
  '01-bip-scanner': vScanner,
  '02-fini-cahier-credit': vCarnet,
  '03-pret-rentree': vRentree,
  '04-sans-internet': vOffline,
  '05-prix-83dt': vPrice,
  '06-stock-2-postes': vStock,
}

// ---------------------------------------------------------------- CSS
const CSS = `
${fontFaces}
:root{--blue:#1800AC;--blue7:#2A12CF;--blue9:#140A85;--blue95:#0C0652;--amber:#FFAD20;--ink:#0B0A1F;--wa:#25D366}
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow:hidden}
body{font-family:'InterV','Cairo',sans-serif;font-optical-sizing:auto;-webkit-font-smoothing:antialiased;color:var(--fg)}
html[lang=ar] body{font-family:'Cairo',sans-serif}
.canvas{position:relative;width:100vw;height:100vh;overflow:hidden;display:flex;flex-direction:column}
.abs{position:absolute}
.canvas>*{position:relative;z-index:1}
.canvas>.bg{position:absolute;inset:0;z-index:0;pointer-events:none}
html[dir=rtl] .flipx{transform:scaleX(-1)}

/* themes */
.theme-blue{--fg:#fff;--fg2:rgba(255,255,255,.86);--kick:var(--amber);--em:var(--amber);
  background:radial-gradient(60% 55% at var(--gx,88%) 6%,rgba(110,95,255,.55),transparent 70%),
  radial-gradient(55% 45% at var(--gx2,4%) 100%,rgba(255,173,32,.18),transparent 70%),
  linear-gradient(165deg,#2A12CF 0%,#1800AC 48%,#0C0652 100%)}
.theme-ink{--fg:#fff;--fg2:rgba(255,255,255,.82);--kick:var(--amber);--em:var(--amber);
  background:radial-gradient(60% 50% at var(--gx,88%) 0%,rgba(42,18,207,.75),transparent 70%),
  radial-gradient(50% 40% at var(--gx2,0%) 100%,rgba(42,18,207,.45),transparent 70%),
  linear-gradient(170deg,#17134A 0%,#0B0A1F 70%)}
.theme-light{--fg:var(--ink);--fg2:#3E3C5E;--kick:var(--blue7);--em:var(--blue7);
  background:radial-gradient(55% 50% at var(--gx,92%) 0%,rgba(91,75,255,.20),transparent 70%),
  radial-gradient(50% 45% at var(--gx2,0%) 100%,rgba(255,173,32,.28),transparent 70%),
  linear-gradient(170deg,#FFFFFF 0%,#FFF8EB 100%)}
.theme-amber{--fg:var(--ink);--fg2:#2E2408;--kick:var(--blue);--em:var(--blue);
  background:radial-gradient(60% 55% at var(--gx,90%) 0%,rgba(255,255,255,.45),transparent 70%),
  radial-gradient(60% 50% at var(--gx2,0%) 100%,rgba(232,140,0,.55),transparent 70%),
  linear-gradient(165deg,#FFC14A 0%,#FFAD20 55%,#F59A00 100%)}
html[dir=rtl] .canvas{--gx:12%;--gx2:96%}
.bg .dots{position:absolute;inset:0;background-image:radial-gradient(currentColor 1.6px,transparent 2.2px);background-size:34px 34px;color:rgba(255,255,255,.10);
  -webkit-mask-image:linear-gradient(170deg,#000 0%,transparent 55%)}
.theme-light .bg .dots{color:rgba(42,18,207,.10)}
.theme-amber .bg .dots{color:rgba(11,10,31,.08)}

/* header */
.hdr{display:flex;align-items:center;justify-content:space-between;gap:20px}
.chip{background:#fff;border-radius:22px;padding:14px 22px;display:flex;box-shadow:0 12px 30px rgba(6,0,60,.28)}
.theme-light .chip,.theme-amber .chip{box-shadow:0 10px 26px rgba(11,10,31,.12)}
.chip img{display:block;width:var(--logo,280px);height:auto}
.tag{font-weight:700;font-size:24px;padding:10px 22px;border-radius:999px;border:2px solid currentColor;color:var(--fg);opacity:.8;white-space:nowrap}
html[lang=ar] .tag{font-size:26px;padding:6px 24px 10px}

/* text */
.kicker{font-weight:800;font-size:26px;letter-spacing:.14em;text-transform:uppercase;color:var(--kick)}
html[lang=ar] .kicker{letter-spacing:0;font-size:30px}
.h1{font-weight:900;font-size:var(--h1,112px);line-height:.98;letter-spacing:-.035em;color:var(--fg);font-variation-settings:'opsz' 32}
html[lang=ar] .h1{line-height:1.2;letter-spacing:0}
.h1 .ln{display:block;white-space:nowrap}
html[lang=ar] .fmt-feed{--h1:98px}
html[lang=ar] .fmt-land .col{--h1:88px}
html[lang=ar] .fmt-land .h1{line-height:1.12}
html[lang=ar] .fmt-land .sub{line-height:1.3}
html[lang=ar] .fmt-feed .h1{line-height:1.12}
html[lang=ar] .theme-light .h1 em{background:linear-gradient(transparent 56%,rgba(255,173,32,.75) 56%,rgba(255,173,32,.75) 76%,transparent 76%)}
.h1 em{font-style:normal;color:var(--em)}
.theme-light .h1 em{background:linear-gradient(transparent 64%,rgba(255,173,32,.75) 64%,rgba(255,173,32,.75) 92%,transparent 92%)}
.sub{font-weight:600;font-size:var(--sub,36px);line-height:1.28;color:var(--fg2);white-space:nowrap}
html[lang=ar] .sub{line-height:1.45}
.sub.wrap{white-space:normal}

/* stage */
.stage{flex:1 1 auto;min-height:0;position:relative}
.vis{position:absolute;left:50%;top:50%;transform-origin:50% 50%}

/* CTA */
.cta{display:flex;align-items:center;justify-content:space-between;gap:24px;background:#fff;color:var(--ink)}
.theme-light .cta{background:var(--blue);color:#fff}
.theme-amber .cta{background:var(--ink);color:#fff}
.wa{display:flex;align-items:center;gap:20px}
.wa-ic{flex:none;width:78px;height:78px;border-radius:50%;background:var(--wa);display:grid;place-items:center;box-shadow:0 6px 16px rgba(37,211,102,.35)}
.wa-ic svg{width:40px;height:40px}
.wa-l{font-size:22px;font-weight:600;opacity:.72;line-height:1.2}
html[lang=ar] .wa-l{font-size:24px;line-height:1.35}
.wa-n{font-family:'InterV','Cairo',sans-serif;font-size:46px;font-weight:900;letter-spacing:-.01em;line-height:1.05;direction:ltr;unicode-bidi:isolate;text-align:start}
html[lang=ar] .wa-n{text-align:right}
.offer{background:var(--amber);color:var(--ink);font-weight:900;font-size:30px;padding:14px 28px;border-radius:999px;white-space:nowrap}
html[lang=ar] .offer{padding:8px 28px 14px}

/* formats */
.fmt-feed{padding:58px 72px 0}
.fmt-feed .hdr{margin-bottom:40px}
.fmt-feed .kicker{margin-bottom:10px}
.fmt-feed .sub{margin-top:16px}
.fmt-feed .stage{margin:20px 0 14px}
.fmt-feed .cta{margin:0 -72px;padding:0 72px;height:140px;flex:none}
.fmt-tall45{padding-top:72px}
.fmt-tall45 .stage{margin:28px -20px 24px}

/* Meta Stories/Reels safe zone (Meta ads guide): keep the top 14% (269px), the
   bottom 35% (672px) and 6% (65px) per side free of text, logo and CTA. Every
   key element sits in y 270..1248; only the illustration runs below it. */
.fmt-story{padding:270px 72px 0;--logo:300px;--h1:136px;--sub:42px}
html[lang=ar] .fmt-story{--h1:120px}
html[lang=ar] .fmt-story .h1{line-height:1.14}
.fmt-story .hdr{margin-bottom:52px}
.fmt-story .kicker{font-size:30px;margin-bottom:14px}
html[lang=ar] .fmt-story .kicker{font-size:34px}
.fmt-story .sub{margin-top:22px}
.fmt-story .stage{margin:56px -40px 300px}
.fmt-story .cta{flex:none;height:160px;border-radius:32px;padding:0 34px;margin-top:40px;box-shadow:0 20px 50px rgba(6,0,60,.35)}
.fmt-story .fine{margin-top:22px;font-size:28px}
html[lang=ar] .fmt-story .fine{font-size:30px}
.fmt-story .wa-n{font-size:50px}
.fmt-story .offer{font-size:30px}

/* shared visual parts */
.card{background:#fff;color:var(--ink);border-radius:28px;box-shadow:0 30px 60px rgba(6,0,60,.35)}
.theme-light .card{box-shadow:0 24px 60px rgba(24,0,172,.16),0 2px 0 rgba(24,0,172,.05)}
.pill{display:inline-flex;align-items:center;gap:8px;border-radius:999px;font-weight:800;white-space:nowrap}
.pill.amber{background:var(--amber);color:var(--ink);padding:6px 16px;font-size:20px}
.pill.amber.big{font-size:30px;padding:10px 28px}
html[lang=ar] .pill.amber{padding:2px 16px 8px}
html[lang=ar] .pill.amber.big{padding:4px 28px 12px}
.ck{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--blue7)}
.ck svg{width:22px;height:22px}
.ck.green{background:#16A34A}
.ck.blue{background:var(--blue)}

/* scanner */
.bc-card{position:absolute;inset:0;background:#fff;border-radius:24px;padding:26px 34px 20px;transform:rotate(calc(var(--rot) * var(--f,1)));box-shadow:0 26px 50px rgba(5,0,50,.45)}
.bc-card.small{padding:18px 24px 14px;border-radius:18px}
.bc{width:100%;height:100%}
.laser{position:absolute;inset-inline-start:-24px;inset-inline-end:-24px;top:47%;height:7px;border-radius:4px;background:#FF2D2D;transform:rotate(calc(var(--rot) * var(--f,1)));
  box-shadow:0 0 10px 3px rgba(255,45,45,.9),0 0 46px 14px rgba(255,45,45,.35)}
.bip{position:absolute;inset:0;display:grid;place-items:center;transform:rotate(calc(-10deg * var(--f,1)))}
.bip-star{position:absolute;inset:0;filter:drop-shadow(0 14px 22px rgba(5,0,50,.4))}
.bip span{position:relative;font-weight:900;font-size:44px;color:var(--ink);letter-spacing:-.02em}
html[lang=ar] .bip span{font-size:46px;letter-spacing:0}
.ticket-wrap{filter:drop-shadow(0 26px 30px rgba(5,0,50,.45));transform:rotate(calc(var(--rot) * var(--f,1)))}
.ticket{background:#fff;color:var(--ink);padding:26px 26px 46px;font-size:21px;font-family:'DejaVu Sans Mono',monospace;
  -webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/28px 100%}
.ticket.ar{font-family:'Cairo',sans-serif;font-size:22px}
.ticket.ar .tk-row{line-height:1.5}
.tk-shop{text-align:center;font-weight:800;font-size:24px;letter-spacing:.06em}
.ticket.ar .tk-shop{letter-spacing:0;font-size:26px;font-weight:900}
.tk-no{text-align:center;font-size:16px;opacity:.6;margin-top:4px}
.tk-hr{border-top:3px dashed rgba(11,10,31,.35);margin:14px 0}
.tk-row{display:flex;justify-content:space-between;gap:10px;line-height:1.7}
.tk-row i{font-style:normal;opacity:.6}
.tk-row b{font-weight:600;font-variant-numeric:tabular-nums}
.tk-total{font-weight:800;font-size:26px}
.tk-total b{font-weight:800}
.tk-thanks{text-align:center;font-size:17px;opacity:.65;margin-top:10px}

/* carnet */
.nb{width:330px;height:370px;background:#FFFEF8;border-radius:10px 22px 22px 10px;transform:rotate(calc(var(--rot) * var(--f,1)));
  box-shadow:0 22px 44px rgba(24,0,172,.18);background-image:repeating-linear-gradient(to bottom,transparent 0 56px,#C7D0FF 56px 58px);background-position:0 26px}
.nb-margin{position:absolute;top:0;bottom:0;inset-inline-start:46px;width:3px;background:#F08A8A}
.nb-rings{position:absolute;top:-20px;inset-inline:26px;display:flex;justify-content:space-between}
.nb-rings i{position:relative;width:16px;height:36px}
.nb-rings i::before{content:'';position:absolute;left:0;right:0;top:0;height:30px;border:4px solid #4B4870;border-bottom:0;border-radius:10px 10px 0 0}
.nb-rings i::after{content:'';position:absolute;left:3px;bottom:0;width:10px;height:10px;border-radius:50%;background:#D9D6EE}
.nb-line{position:absolute;inset-inline-start:60px;font-style:italic;font-weight:600;font-size:30px;color:#3B3A8F;transform:rotate(var(--rot));white-space:nowrap;opacity:.9}
html[lang=ar] .nb-line{font-style:normal;font-size:30px}
.nb-scrawl{position:absolute;inset-inline-start:60px;top:318px;width:210px;height:30px}
.nb-strike{position:absolute;left:-40px;right:-40px;top:168px;height:26px;border-radius:13px;background:var(--amber);border:3px solid var(--ink);transform:rotate(calc(-38deg * var(--f,1)))}
.carnet{padding:24px 26px 18px}
.cd-head{font-weight:900;font-size:26px}
.cd-due{display:flex;align-items:baseline;justify-content:space-between;background:#F1F0FF;border-radius:16px;padding:12px 18px;margin:14px 0 6px}
.cd-due span{font-size:20px;font-weight:700;color:#4A4867}
.cd-due b{font-size:40px;font-weight:900;color:var(--blue);letter-spacing:-.02em}
.cd-row{display:flex;align-items:center;gap:14px;padding:11px 2px;border-bottom:2px solid #EEEDF7}
.cd-row:last-child{border-bottom:0}
.av{flex:none;width:50px;height:50px;border-radius:50%;background:#E3E0FF;color:var(--blue7);display:grid;place-items:center;font-weight:900;font-size:19px}
html[lang=ar] .av{font-size:24px}
.nm{flex:1;display:flex;flex-direction:column;line-height:1.2}
.nm b{font-size:23px;font-weight:800}
.nm i{font-style:normal;font-size:17px;color:#6B6987;font-weight:600;margin-top:2px}
.nm i.late{color:#B45309}
.amt{font-size:25px;font-weight:900;font-variant-numeric:tabular-nums}

/* rentree */
.pencil{transform:rotate(calc(var(--rot) * var(--f,1)));filter:drop-shadow(0 12px 16px rgba(5,0,50,.4))}
html[dir=rtl] .pencil svg{transform:scaleX(-1)}
.pack{padding:24px 28px 20px}
.pk-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.pk-head b{font-size:29px;font-weight:900}
.pk-row{display:flex;align-items:center;gap:14px;font-size:22px;font-weight:600;padding:7px 0}
.pk-row .ck{width:30px;height:30px}
.pk-row .ck svg{width:19px;height:19px}
.pk-row .it{flex:1}
.pk-row i{font-style:normal;color:#6B6987;font-weight:700}
.pk-total{display:flex;align-items:baseline;justify-content:space-between;border-top:3px solid #EEEDF7;margin-top:8px;padding-top:12px}
.pk-total span{font-size:22px;font-weight:800;color:#4A4867}
.pk-total b{font-size:38px;font-weight:900;color:var(--blue);letter-spacing:-.02em}

/* offline */
.off-disc{width:330px;height:330px;border-radius:50%;background:rgba(255,255,255,.06);border:4px dashed rgba(255,173,32,.55);display:grid;place-items:center}
.off-ic{width:190px;height:190px;margin-top:-30px}
.off-disc .pill{position:absolute;bottom:34px;left:50%;transform:translateX(-50%)}
.till{padding:24px 28px 22px}
.tl-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.tl-head b{font-size:30px;font-weight:900}
.status{display:inline-flex;align-items:center;gap:10px;background:#FFF1D6;color:#8A5300;font-weight:800;font-size:19px;padding:7px 16px;border-radius:999px}
.status i{width:12px;height:12px;border-radius:50%;background:#F59A00}
.tl-row{display:flex;justify-content:space-between;font-size:23px;font-weight:600;padding:9px 0;border-bottom:2px solid #EEEDF7}
.tl-row i{font-style:normal;color:#6B6987}
.tl-total{display:flex;justify-content:space-between;align-items:baseline;margin-top:10px;background:var(--blue);color:#fff;border-radius:16px;padding:12px 18px}
.tl-total span{font-size:22px;font-weight:700;opacity:.85}
.tl-total b{font-size:34px;font-weight:900}
.tl-ok{display:flex;align-items:center;gap:12px;margin-top:12px;background:#E8F8EE;color:#0F7A3A;font-weight:800;font-size:22px;border-radius:14px;padding:10px 16px}
.tl-ok .ck{width:32px;height:32px}

/* price */
.price-block{display:flex;align-items:flex-end;gap:22px;color:var(--blue);margin-top:-6px}
.price-num{font-weight:900;font-size:var(--price,300px);line-height:.8;letter-spacing:-.06em}
html[lang=ar] .price-num{font-family:'Cairo';letter-spacing:-.02em;line-height:.95}
.price-unit{display:flex;flex-direction:column;padding-bottom:6px;color:var(--ink)}
.price-unit b{font-size:calc(var(--price,300px) * .3);font-weight:900;line-height:.9;letter-spacing:-.03em}
.price-unit i{font-style:normal;font-size:calc(var(--price,300px) * .16);font-weight:700;margin-top:6px}
html[lang=ar] .price-unit b{line-height:1.1}
.price-badge{margin-inline-start:auto;align-self:center;background:var(--ink);color:var(--amber);font-weight:900;font-size:34px;padding:16px 28px;border-radius:22px;transform:rotate(calc(-4deg * var(--f,1)));white-space:nowrap;box-shadow:0 14px 30px rgba(11,10,31,.25)}
html[lang=ar] .price-badge{padding:8px 28px 18px}
.perks{display:grid;grid-template-columns:1fr 1fr;gap:16px 26px}
.perks.one{grid-template-columns:1fr}
.perks.one + .fine{white-space:nowrap}
.fmt-story .price-block{--price:350px}
.perk{display:flex;align-items:center;gap:14px;font-size:30px;font-weight:800;color:var(--ink);background:rgba(255,255,255,.55);border-radius:18px;padding:12px 16px}
.perk .ck{width:38px;height:38px}
.fine{font-size:24px;font-weight:700;color:#2E2408;text-align:start;margin-top:18px}

/* stock */
.scr{background:var(--ink);border-radius:18px;padding:12px;box-shadow:0 26px 50px rgba(5,0,50,.45)}
.mon .scr{height:270px}
.neck{width:70px;height:46px;margin:0 auto;background:linear-gradient(#C9CCD6,#9EA2B3)}
.foot{width:200px;height:14px;margin:0 auto;border-radius:8px;background:#C9CCD6}
.lap .scr{height:250px;border-radius:16px 16px 6px 6px;margin:0 22px}
.kb{height:20px;border-radius:0 0 18px 18px;background:linear-gradient(#D7DAE3,#A9ADBD)}
.ui{background:#fff;border-radius:8px;height:100%;overflow:hidden;color:var(--ink)}
.ui-bar{display:flex;align-items:center;gap:6px;background:var(--blue7);color:#fff;padding:8px 12px;font-weight:800;font-size:18px}
.ui-bar i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.55)}
.ui-bar span{margin-inline-start:8px}
.ui-row{display:flex;justify-content:space-between;align-items:center;padding:7px 14px;font-size:19px;font-weight:600;border-bottom:2px solid #F0EFF8}
.ui-row b{font-weight:800;font-variant-numeric:tabular-nums}
.ui-row.hl{background:#FFF4DF}
.ui-row.hl b{background:var(--amber);border-radius:8px;padding:0 10px;font-weight:900}
.dev-l{display:block;text-align:center;margin-top:12px;font-weight:800;font-size:26px;color:#fff}
.sync{width:110px;display:flex;flex-direction:column;align-items:center;gap:14px}
.sync-ic{width:100px;height:100px;border-radius:50%;background:var(--amber);display:grid;place-items:center;box-shadow:0 0 0 12px rgba(255,173,32,.22),0 18px 30px rgba(5,0,50,.4)}
.sync-ic svg{width:58px;height:58px}
.live{display:inline-flex;align-items:center;gap:8px;font-weight:800;font-size:20px;color:#fff;background:rgba(255,255,255,.14);padding:6px 14px;border-radius:999px;white-space:nowrap}
.live i{width:12px;height:12px;border-radius:50%;background:#2EE07A;box-shadow:0 0 0 4px rgba(46,224,122,.25)}

/* display: landscape 1200x628 */
.fmt-land{flex-direction:row;padding:0}
.fmt-land .col{flex:0 0 640px;padding:46px 0 40px;padding-inline-start:56px;display:flex;flex-direction:column;--logo:250px;--h1:104px;--sub:30px}
.fmt-land .hdr{margin-bottom:auto}
.fmt-land .kicker{margin-bottom:8px;font-size:24px}
.fmt-land .sub{margin-top:12px}
.fmt-land .stage{flex:1;margin:18px 22px}
.btn{display:inline-flex;align-items:center;align-self:flex-start;background:var(--amber);color:var(--ink);font-weight:900;font-size:28px;padding:16px 28px;border-radius:16px;box-shadow:0 10px 24px rgba(5,0,50,.35);white-space:nowrap}
html[lang=ar] .btn{padding:8px 28px 18px}
.land-wa{display:flex;align-items:center;gap:12px;margin-top:16px;font-weight:800;font-size:24px;color:#fff}
.land-wa .wa-ic{width:40px;height:40px;box-shadow:none}
.land-wa .wa-ic svg{width:22px;height:22px}
.land-wa b{direction:ltr;unicode-bidi:isolate}

/* display: 300x250 */
.fmt-mrec{padding:12px;--logo:112px}
.fmt-mrec .m-bip{position:absolute;top:6px;inset-inline-end:8px;width:76px;height:76px}
.fmt-mrec .m-bip .bip span{font-size:17px}
.fmt-mrec .m-code{position:absolute;bottom:16px;inset-inline-end:12px;width:104px;height:66px}
.fmt-mrec .bc-card{padding:7px 9px 5px;border-radius:8px;box-shadow:0 6px 14px rgba(5,0,50,.45)}
.fmt-mrec .laser{height:3px;inset-inline-start:-8px;inset-inline-end:-8px;box-shadow:0 0 4px 1px rgba(255,45,45,.9),0 0 12px 4px rgba(255,45,45,.35)}
.fmt-mrec .chip{border-radius:10px;padding:6px 9px;align-self:flex-start;box-shadow:0 4px 10px rgba(6,0,60,.3)}
.fmt-mrec .h1{--h1:38px;line-height:1;margin-top:18px;letter-spacing:-.03em}
html[lang=ar] .fmt-mrec .h1{--h1:36px;line-height:1.15;margin-top:12px}
.fmt-mrec .sub{--sub:15px;margin-top:6px;font-weight:700;line-height:1.2}
.fmt-mrec .btn{position:absolute;bottom:12px;inset-inline-start:12px;font-size:15px;padding:9px 14px;border-radius:10px;box-shadow:0 4px 10px rgba(5,0,50,.35)}
html[lang=ar] .fmt-mrec .btn{padding:4px 14px 9px}
.fmt-mrec .stage{position:absolute;inset-inline-end:4px;top:34px;width:128px;height:128px}

html[lang=ar] .pk-row,html[lang=ar] .tl-row{font-size:25px;padding:4px 0;line-height:1.35}
html[lang=ar] .pk-head b{font-size:31px}
html[lang=ar] .nm b{font-size:25px}
html[lang=ar] .nm i{font-size:19px}
html[lang=ar] .cd-due span{font-size:22px}
html[lang=ar] .cd-row{padding:7px 2px}
html[lang=ar] .ui-row{font-size:21px;padding:3px 14px}
html[lang=ar] .ui-bar{font-size:20px;padding:4px 12px 6px}
html[lang=ar] .status{font-size:21px;padding:2px 16px 6px}
html[lang=ar] .tl-ok{font-size:24px;padding:4px 16px 8px}
html[lang=ar] .perk{font-size:32px;padding:6px 16px 10px}
html[lang=ar] .fine{font-size:26px}
html[lang=ar] .dev-l{font-size:28px}
html[lang=ar] .live{font-size:22px;padding:2px 14px 6px}
.theme-logo{background:#fff}
.theme-logo .bg{display:none}
.safe{position:absolute;left:0;right:0;z-index:99;background:rgba(255,0,0,.25);border:2px dashed red}
`

// ---------------------------------------------------------------- page builders
function textBlock(c, t, lang, fmt) {
  if (c.id === '05-prix-83dt') {
    return `<div class="txt"><div class="kicker">${t.kicker}</div>
      <div class="price-block"><span class="price-num">${t.price}</span>
      <span class="price-unit"><b>${t.cur}</b><i>${t.per}</i></span>
      <span class="price-badge">${t.badge}</span></div>
      ${fmt === 'story' ? `<div class="fine">${t.fine}</div>` : ''}</div>`
  }
  return `<div class="txt"><div class="kicker">${t.kicker}</div>
    <div class="h1">${t.h1.map((l) => `<span class="ln">${l}</span>`).join('')}</div>
    <div class="sub">${t.sub}</div></div>`
}

function cta(lang, showOffer = true) {
  const k = COMMON[lang]
  return `<div class="cta"><div class="wa"><span class="wa-ic">${ICON.phone}</span>
    <div><div class="wa-l">${k.waLabel}</div><div class="wa-n">${PHONE}</div></div></div>
    ${showOffer ? `<span class="offer">${k.offer}</span>` : ''}</div>`
}

function header(lang, withTag = true) {
  return `<div class="hdr"><div class="chip"><img src="${LOGO}" alt="Mektebti.tn"></div>
    ${withTag ? `<span class="tag">${COMMON[lang].tag}</span>` : ''}</div>`
}

function doc(lang, body, { w, h, theme, fmt, maxScale = 1.25, safe = '' }) {
  return `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>${CSS} html,body{width:${w}px;height:${h}px} .vis{--f:${lang === 'ar' ? -1 : 1}}</style></head>
<body><div class="canvas theme-${theme} ${fmt.split(' ').map((f) => 'fmt-' + f).join(' ')}"><div class="bg"><div class="dots"></div></div>${body}${safe}</div>
<script>
const fit = (el, min, step = 2) => {
  if (!el) return
  let fs = parseFloat(getComputedStyle(el).fontSize)
  const lines = el.querySelectorAll('.ln').length ? [...el.querySelectorAll('.ln')] : [el]
  const over = () => lines.some((l) => l.scrollWidth > el.clientWidth + 1)
  while (over() && fs > min) { fs -= step; el.style.fontSize = fs + 'px' }
  if (over() && el.classList.contains('sub')) el.classList.add('wrap')
}
window.__layout = async () => {
  await document.fonts.ready
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})))
  document.querySelectorAll('.h1').forEach((e) => fit(e, 40))
  document.querySelectorAll('.sub').forEach((e) => fit(e, e.closest('.fmt-mrec') ? 11 : 26, 1))
  document.querySelectorAll('.price-block').forEach((e) => {
    const box = e.parentElement
    const need = () => [...e.children].reduce((w, c) => w + c.offsetWidth, 0) + 22 * (e.children.length - 1) + 24
    let p = parseFloat(getComputedStyle(e).getPropertyValue('--price')) || 300
    while (need() > box.clientWidth && p > 120) { p -= 6; e.style.setProperty('--price', p + 'px') }
  })
  // Scale each visual to the stage from the real bounds of what it draws
  // (cards grow with the language), then centre it.
  document.querySelectorAll('.stage').forEach((st) => {
    const v = st.querySelector('.vis'); if (!v) return
    v.style.left = '0'; v.style.top = '0'; v.style.transformOrigin = '0 0'; v.style.transform = 'none'
    const vr = v.getBoundingClientRect()
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    v.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom)
    })
    const bw = x1 - x0, bh = y1 - y0
    const s = Math.min(st.clientWidth / bw, st.clientHeight / bh, ${maxScale})
    const cx = (x0 + x1) / 2 - vr.left, cy = (y0 + y1) / 2 - vr.top
    let tx = st.clientWidth / 2 - cx * s
    if (v.dataset.align === 'start') {
      const pad = Math.max(0, -parseFloat(getComputedStyle(st).marginInlineStart) || 0)
      tx = document.dir === 'rtl' ? st.clientWidth - pad - (x1 - vr.left) * s : pad - (x0 - vr.left) * s
    }
    // Stories: hug the CTA so the illustration stays above the reply bar.
    const ty = st.closest('.fmt-story') ? -(y0 - vr.top) * s : st.clientHeight / 2 - cy * s
    v.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')'
  })
  return true
}
</script></body></html>`
}

function metaPage(c, lang, fmt) {
  const t = c[lang]
  const isPrice = c.id === '05-prix-83dt'
  const v = VIS[c.id](t, lang, fmt === 'story' && isPrice ? 'tall' : 'wide')
  const [w, h] = { feed: [1080, 1080], feed45: [1080, 1350], story: [1080, 1920] }[fmt]
  const safe =
    process.env.DEBUG_SAFE && fmt === 'story'
      ? `<div class="safe" style="top:0;height:269px"></div><div class="safe" style="bottom:0;height:672px"></div>`
      : ''
  const stage = `<div class="stage"><div class="vis" data-align="${v.align || 'center'}" style="width:${v.w}px;height:${v.h}px">${v.html}</div></div>`
  const body =
    fmt === 'story'
      ? `${header(lang)}${textBlock(c, t, lang, fmt)}${cta(lang, !isPrice)}${stage}`
      : `${header(lang)}${textBlock(c, t, lang, fmt)}${stage}${cta(lang, !isPrice)}`
  const cls = fmt === 'feed45' ? 'feed tall45' : fmt
  return { w, h, html: doc(lang, body, { w, h, theme: c.theme, fmt: cls, maxScale: fmt === 'story' ? 1.4 : fmt === 'feed45' ? 1.25 : 1.1, safe }) }
}

function displayPage(lang, size) {
  const c = CONCEPTS[0]
  const t = c[lang]
  const d = DISPLAY[lang]
  if (size === '1200x1200') {
    const p = metaPage(c, lang, 'feed')
    return { ...p, scale: 1200 / 1080 }
  }
  if (size === '1200x628') {
    const v = vScanner(t, lang, 'tall')
    const body = `<div class="col">${header(lang, false)}
      <div class="kicker">${d.kicker}</div>
      <div class="h1">${t.h1.map((l) => `<span class="ln">${l}</span>`).join('')}</div>
      <div class="sub">${t.sub}</div>
      <div style="margin-top:26px" class="btn">${d.button}</div>
      <div class="land-wa"><span class="wa-ic">${ICON.phone}</span><span>${lang === 'ar' ? 'واتساب' : 'WhatsApp'}</span><b>${PHONE}</b></div></div>
      <div class="stage"><div class="vis" style="width:${v.w}px;height:${v.h}px">${v.html}</div></div>`
    return { w: 1200, h: 628, html: doc(lang, body, { w: 1200, h: 628, theme: 'blue', fmt: 'land', maxScale: 1 }) }
  }
  if (size.endsWith('clean')) {
    // Responsive Display Ads: Google advises no text, logo or button overlaid
    // on marketing images (headlines and logo are uploaded as separate assets).
    const sq = size.startsWith('1200x1200')
    const v = vScanner(t, lang, sq ? 'tall' : 'wide')
    const [w, h] = sq ? [1200, 1200] : [1200, 628]
    const body = `<div class="stage" style="margin:${sq ? 110 : 54}px ${sq ? 110 : 90}px"><div class="vis" style="width:${v.w}px;height:${v.h}px">${v.html}</div></div>`
    return { w, h, html: doc(lang, body, { w, h, theme: 'blue', fmt: 'clean', maxScale: 1.6 }) }
  }
  if (size === 'logo') {
    const body = `<img src="${LOGO}" alt="Mektebti.tn" style="width:470px;margin:auto">`
    return { w: 512, h: 128, html: doc(lang, body, { w: 512, h: 128, theme: 'logo', fmt: 'logo' }) }
  }
  // 300x250: fixed layout, no stage scaling at this size
  const body = `<div class="chip"><img src="${LOGO}" alt="Mektebti.tn"></div>
    <div class="m-bip" style="--f:${lang === 'ar' ? -1 : 1}"><div class="bip"><div class="bip-star">${burst()}</div><span>${t.bip}</span></div></div>
    <div class="h1">${t.h1.map((l) => `<span class="ln">${l}</span>`).join('')}</div>
    <div class="sub">${d.kicker}</div>
    <div class="m-code" style="--f:${lang === 'ar' ? -1 : 1}"><div class="bc-card" dir="ltr" style="--rot:-6deg"><div class="bc">${barcodeSvg()}</div></div><div class="laser" style="--rot:-6deg"></div></div>
    <div class="btn">${d.short}</div>`
  return { w: 300, h: 250, html: doc(lang, body, { w: 300, h: 250, theme: 'blue', fmt: 'mrec', maxScale: 1 }) }
}

// ---------------------------------------------------------------- render
const filters = process.argv.slice(2)
const want = (...keys) => filters.every((f) => keys.some((k) => k.includes(f)))

const jobs = []
for (const c of CONCEPTS) {
  for (const lang of ['fr', 'ar']) {
    for (const fmt of ['feed', 'feed45', 'story']) {
      const size = { feed: '1080x1080', feed45: '1080x1350', story: '1080x1920' }[fmt]
      const out = path.join(OUT, 'meta', lang, `${c.id}_${size}.png`)
      if (want(c.id, lang, fmt, size, 'meta')) jobs.push({ out, make: () => metaPage(c, lang, fmt) })
    }
  }
}
for (const lang of ['fr', 'ar']) {
  for (const size of ['1200x628', '1200x1200', '300x250', '1200x628-clean', '1200x1200-clean']) {
    const out = path.join(OUT, 'google-display', `01-bip-scanner_${size}_${lang}.png`)
    if (want('01-bip-scanner', lang, size, 'display', 'google')) jobs.push({ out, make: () => displayPage(lang, size) })
  }
}
if (want('logo', 'display', 'google')) {
  jobs.push({ out: path.join(OUT, 'google-display', 'logo-landscape_512x128.png'), make: () => displayPage('fr', 'logo') })
}

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mektebti-ads-'))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
let total = 0
for (const [i, job] of jobs.entries()) {
  const { w, h, html, scale = 1 } = job.make()
  const file = path.join(tmp, `p${i}.html`)
  await fs.writeFile(file, html)
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale })
  page.on('pageerror', (e) => console.error('page error', e.message))
  await page.goto(url(file))
  await page.evaluate(() => window.__layout())
  let png = await page.screenshot({ type: 'png' })
  await page.close()
  const W = Math.round(w * scale), H = Math.round(h * scale)
  if (sharp) {
    const small = W * H <= 300 * 250
    png = await sharp(png)
      .resize(W, H, { fit: 'fill' })
      .png({ palette: true, quality: small ? 100 : 92, colours: 256, effort: 10, dither: 0.9, compressionLevel: 9 })
      .toBuffer()
  }
  await fs.mkdir(path.dirname(job.out), { recursive: true })
  await fs.writeFile(job.out, png)
  total += png.length
  console.log(`${path.relative(REPO, job.out)}  ${W}x${H}  ${(png.length / 1024).toFixed(0)} KB`)
}
await browser.close()
await fs.rm(tmp, { recursive: true, force: true })
console.log(`${jobs.length} files, ${(total / 1024).toFixed(0)} KB total`)
