import { useCallback, useEffect, useMemo, useRef } from 'react'

/**
 * Hardware barcode scanner support — WITHOUT needing the Enter key.
 *
 * A hand scanner is just a keyboard: it "types" the code and, depending on how
 * it was configured at the factory, may or may not press Enter afterwards. The
 * shop's scanner does not, so the cashier had to hit Enter himself on every
 * article. What tells a scan apart from a human is the speed: a scanner emits
 * a character every 5–30 ms, a fast typist manages one every ~120 ms. Anything
 * arriving faster than {@link INTERCHAR_MAX_MS} per character is a machine.
 *
 * So this hook listens on the window, buffers those bursts, and hands the
 * finished code over:
 *   • on Enter / Tab, if the scanner does send a suffix — immediately;
 *   • otherwise {@link END_OF_SCAN_MS} after the last character, which is the
 *     "no Enter needed" path.
 *
 * It listens on the window rather than on the input so a scan still works when
 * the cashier has clicked somewhere else on the page — the code is never lost
 * and the field is refocused for him.
 *
 * The hook never decides whether a scan is *welcome*; it only reports one. The
 * caller ignores it when a dialog is up. That split is deliberate: the burst is
 * still recognised while a dialog is open, so the scanner's trailing Enter is
 * swallowed here instead of confirming whatever button the dialog had focused.
 */

/**
 * Maximum delay between two characters for them to still count as one machine
 * burst. 45 ms is ~1300 words per minute: comfortably above every scanner and
 * far beyond any human hand.
 */
const INTERCHAR_MAX_MS = 45

/** Silence after the last character that means "the code is complete". */
const END_OF_SCAN_MS = 65

/** Below this a burst is noise, not a barcode. */
const DEFAULT_MIN_LENGTH = 4

/**
 * Physical key → the character it carries on a US layout.
 *
 * Scanners emit US-layout scancodes unless they were reconfigured. The shop's
 * PC runs French AZERTY, where the unshifted digit row types &é"'(-è_çà — so a
 * 13-digit barcode arrives as punctuation and matches nothing. Reading the
 * physical key as well gives us the digits back. Only digits and the couple of
 * separators are mapped: letters would raise a case ambiguity for no gain,
 * since retail barcodes are numeric.
 *
 * This also rescues scanners that emulate the numeric keypad with NumLock off.
 */
const PHYSICAL: Record<string, string> = {
  Minus: '-',
  NumpadSubtract: '-',
  Period: '.',
  NumpadDecimal: '.',
}
for (let d = 0; d <= 9; d += 1) {
  PHYSICAL[`Digit${d}`] = String(d)
  PHYSICAL[`Numpad${d}`] = String(d)
}

function isEditable(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (el as HTMLInputElement).type
  // Checkboxes, radios and buttons hold no text, so a scan may safely take
  // the focus away from them.
  return type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit'
}

/**
 * Writes a value into a React-controlled input. Assigning `.value` directly is
 * invisible to React (it tracks the previous value on the DOM node), so the
 * native setter is called and an `input` event is dispatched to make React
 * pick the change up.
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  try {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } catch {
    /* best effort — the repair is a nicety, not a requirement */
  }
}

export interface BarcodeScannerOptions {
  /**
   * Receives the finished code.
   *
   * `physical` is the same burst read off the physical keys instead of the
   * characters the keyboard layout produced — non-null only when the two
   * differ, i.e. when the scanner and the OS disagree about the layout. Try
   * `code` first and fall back to `physical`.
   */
  onScan: (code: string, physical: string | null) => void
  /**
   * The scan field. A burst that starts while focus is elsewhere is redirected
   * into it, so the characters are visible where the cashier expects them.
   */
  targetRef: { current: HTMLInputElement | null }
  minLength?: number
}

export interface BarcodeScanner {
  /**
   * Drops the buffer. Call it whenever the code was consumed by another path
   * (the exact-barcode match on typing, or a manual Enter) — otherwise the
   * pending burst would fire a second time and ring the article up twice.
   */
  reset: () => void
}

export function useBarcodeScanner({
  onScan,
  targetRef,
  minLength = DEFAULT_MIN_LENGTH,
}: BarcodeScannerOptions): BarcodeScanner {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  /** What the layout typed, and what the physical keys say. */
  const typed = useRef('')
  const physical = useRef('')
  const lastAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Field that was focused when the burst started, and its value back then. */
  const hijacked = useRef<{
    el: HTMLInputElement | HTMLTextAreaElement
    value: string
  } | null>(null)

  const clearTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const reset = useCallback(() => {
    clearTimer()
    typed.current = ''
    physical.current = ''
    hijacked.current = null
  }, [])

  useEffect(() => {
    const flush = () => {
      const code = typed.current
      const alt = physical.current
      const stolen = hijacked.current
      reset()
      if (code.length < minLength) return

      // The characters landed in some other field on their way here (the
      // cashier had clicked into a quantity box). Put that field back the way
      // it was — the caller decides where the focus goes next.
      if (stolen) setNativeValue(stolen.el, stolen.value)

      onScanRef.current(code, alt !== code ? alt : null)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // A held-down key repeats every ~30 ms and would read exactly like a
      // scan; an IME composition reports a meaningless key.
      if (e.repeat || e.isComposing || e.keyCode === 229) return
      if (e.ctrlKey || e.altKey || e.metaKey) return

      if (e.key === 'Enter' || e.key === 'Tab') {
        // Only swallow the key when it really is a scanner's suffix. A human
        // pressing Enter on a half-typed name must still submit the form, and
        // Tab must still move between fields.
        if (typed.current.length >= minLength) {
          // preventDefault alone is NOT enough: it cancels the browser's own
          // action (submitting the form, clicking the focused button) but
          // React would still deliver the key to every onKeyDown on the path.
          // With the settlement dialog open that Enter reached the amount
          // field and confirmed the payment — a sale nobody agreed to. Stop
          // it here, in the capture phase, before React's root ever sees it.
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          flush()
        } else {
          reset()
        }
        return
      }

      // Anything that is not a single printable character (arrows, F-keys,
      // Backspace…) means a human is at the keyboard: the burst is over.
      if (e.key.length !== 1) {
        reset()
        return
      }

      const now = performance.now()
      const fresh = typed.current === '' || now - lastAt.current > INTERCHAR_MAX_MS
      lastAt.current = now

      if (fresh) {
        clearTimer()
        typed.current = ''
        physical.current = ''
        const active = document.activeElement
        if (active !== targetRef.current && isEditable(active)) {
          // Remember what we are about to type over, in case this turns out to
          // be a scan. Left alone otherwise — a cashier typing a quantity by
          // hand must never have the field snatched from under him.
          hijacked.current =
            active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
              ? { el: active, value: active.value }
              : null
        } else {
          hijacked.current = null
          // Focus moves during keydown, so the character itself still lands in
          // the scan field: the cashier can scan straight after clicking a
          // button, with nothing lost.
          if (active !== targetRef.current) targetRef.current?.focus()
        }
      }

      typed.current += e.key
      physical.current += PHYSICAL[e.code] ?? e.key

      // Restart the "code complete" countdown on every character. This is what
      // removes the Enter key: the burst ends by simply going quiet.
      clearTimer()
      timer.current = setTimeout(flush, END_OF_SCAN_MS)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      clearTimer()
    }
  }, [minLength, reset, targetRef])

  // Stable identity: callers keep this in effect dependency lists, and a fresh
  // object on every render would re-run them forever.
  return useMemo(() => ({ reset }), [reset])
}
