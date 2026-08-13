/**
 * Audible feedback for the till.
 *
 * A scan that makes no sound and no visible change is the fastest way to ring
 * an article up twice — or not at all: the cashier is looking at the customer
 * and at the goods, not at the screen. A short beep tells him the article
 * landed without him having to read anything.
 *
 * WebAudio is used instead of an <audio> file so there is nothing to download
 * and no latency on the first scan of the day. The context is created lazily,
 * because browsers refuse to start audio before a user gesture — the first
 * scan (a keystroke) is that gesture.
 */

const KEY = 'pos.sound'

type Ctor = typeof AudioContext

let ctx: AudioContext | null = null

/** Sound is on unless the owner explicitly turned it off. */
export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* private mode — the setting simply does not persist */
  }
}

function audio(): AudioContext | null {
  if (ctx) return ctx
  const Ctor: Ctor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

/**
 * One note. `at` is an offset in seconds so a two-note chime can be scheduled
 * in a single call without a setTimeout (which would drift).
 */
function tone(freq: number, seconds: number, at = 0, volume = 0.08) {
  const c = audio()
  if (!c) return
  // A tab restored from the background comes back suspended; without this the
  // first beep after a break is silent.
  if (c.state === 'suspended') void c.resume().catch(() => {})

  const start = c.currentTime + at
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square' // carries better than a sine over a noisy shop
  osc.frequency.value = freq
  // Ramps instead of hard starts/stops: a square wave switched on abruptly
  // clicks, and on cheap PC speakers the click is louder than the note.
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds)
  osc.connect(gain).connect(c.destination)
  osc.start(start)
  osc.stop(start + seconds + 0.02)
}

/** Article added — the short, bright blip of a supermarket till. */
export function beepOk() {
  if (!soundEnabled()) return
  tone(1180, 0.07)
}

/** Unknown code / nothing found — lower and longer, clearly "not that". */
export function beepError() {
  if (!soundEnabled()) return
  tone(320, 0.12)
  tone(240, 0.16, 0.13)
}

/** Ticket cashed in — a small two-note rise, the "it is done" sound. */
export function beepDone() {
  if (!soundEnabled()) return
  tone(880, 0.09)
  tone(1320, 0.14, 0.1)
}

/** Something needs a look (out of stock, deleted product) — a single warning. */
export function beepWarn() {
  if (!soundEnabled()) return
  tone(560, 0.16)
}
