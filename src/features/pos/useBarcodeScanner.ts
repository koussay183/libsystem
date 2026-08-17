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
 * Two invariants hold whatever the scanner sends. A field the burst was typed
 * into is always given back, because the restore lives in one function that
 * only {@link reset} calls and `reset` is on every path out. And nothing thrown
 * in here is allowed to escape: both entry points — the keydown listener and
 * the flush — catch, restore, and log. A throw from here does not reach React
 * at all (it is a native listener and a timer callback), so an escaping one
 * unmounts the till to a blank page and takes the open basket with it.
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
 *
 * Letters are mapped too, now that a code can be a word: the QR labels stuck
 * on the counter for the photocopier and the printer carry text, and on AZERTY
 * the three keys that move — A/Q, Z/W and M — turn IMPRIMER into I?PRI?ER.
 * Case is taken from the shift key, so on a keyboard that already agrees with
 * the scanner the physical reading is identical to the typed one and no
 * second candidate is produced.
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
for (let c = 0; c < 26; c += 1) {
  PHYSICAL[`Key${String.fromCharCode(65 + c)}`] = String.fromCharCode(97 + c)
}

/** Is this mapping a letter, i.e. does the shift key decide its case? */
const isLetter = (ch: string) => ch >= 'a' && ch <= 'z'

/**
 * How long after a finished code a lone Enter or Tab still counts as that
 * scanner's suffix rather than as the cashier pressing a key.
 *
 * Without this the early-flush path below would hand the trailing Enter to the
 * page: with the settlement dialog open that Enter lands on the confirm button
 * and records a sale nobody agreed to.
 */
const TRAILING_SUFFIX_MS = 150

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
  /**
   * Fired once, the moment a burst is long enough to be certainly a machine.
   * The suggestion list uses it to close: a scan must never leave a dropdown
   * flickering under the cashier's hand.
   */
  onBurstStart?: () => void
  /**
   * "This is the whole code — do not wait for more."
   *
   * Without it every scan pays {@link END_OF_SCAN_MS} of silence before the
   * article appears, because the only way to know a burst has ended is that it
   * stopped. The caller knows its own catalogue, so it can answer the question
   * directly: the code matches something, and nothing longer starts with it.
   * When it says yes the article is rung up on the last character, with no
   * delay at all.
   *
   * Must stay cheap — it is asked on every character once the buffer is long
   * enough. Returning false is the answer for all but the last one.
   */
  isComplete?: (code: string, physical: string | null) => boolean
}

export interface BarcodeScanner {
  /**
   * Drops the buffer. Call it whenever the code was consumed by another path
   * (the exact-barcode match on typing, or a manual Enter) — otherwise the
   * pending burst would fire a second time and ring the article up twice.
   *
   * It also hands back the field the burst was typed into, if it borrowed one,
   * so a code consumed elsewhere does not leave its characters behind in a
   * quantity cell. Safe to call twice: the second call restores nothing.
   */
  reset: () => void
}

export function useBarcodeScanner({
  onScan,
  targetRef,
  minLength = DEFAULT_MIN_LENGTH,
  onBurstStart,
  isComplete,
}: BarcodeScannerOptions): BarcodeScanner {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  // Held in a ref so a caller that re-creates the callback every render does
  // not re-arm the window listener under a scan in progress.
  const onBurstStartRef = useRef(onBurstStart)
  onBurstStartRef.current = onBurstStart

  const isCompleteRef = useRef(isComplete)
  isCompleteRef.current = isComplete

  /** What the layout typed, and what the physical keys say. */
  const typed = useRef('')
  const physical = useRef('')
  const lastAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** When the last code went out, so its trailing Enter can be recognised. */
  const flushedAt = useRef(0)
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

  /**
   * Gives back the field the burst was typed into.
   *
   * This is the ONLY place that restores it, and {@link reset} is the only
   * caller — which is what makes the restore unmissable, because every path out
   * of this module goes through `reset`. It used to be a line near the end of
   * `flush`, and two paths reached the exit without it: the sub-`minLength`
   * early return, and `reset` itself (called when a non-printable key ends the
   * burst). A cashier who had clicked into a ticket quantity cell and then
   * scanned a short code, or pressed an arrow key mid-burst, kept the burst
   * characters in that cell — and `usePosCart.setQty` clamps to MAX_QTY, so the
   * customer's ticket showed a quantity of up to 999.
   *
   * `burst` is the buffer as it stood; it is what tells a scan apart from a
   * cashier's own keystrokes.
   */
  const giveBack = useCallback((burst: string) => {
    const stolen = hijacked.current
    // Cleared first and unconditionally, so a second call can never write this
    // snapshot again: several exit paths run in sequence (flush → reset, then
    // the catch that guards the handler), and a repeated restore is exactly how
    // a value from before the scan ends up on top of what the cashier has typed
    // since.
    hijacked.current = null
    if (!stolen) return

    // A single character is never a burst. The machine test is the *gap*
    // between characters (INTERCHAR_MAX_MS), so a buffer that never grew past
    // one character was typed by a hand — each of those keystrokes is "fresh"
    // and re-snapshots the field, and undoing it would silently delete a
    // character every time somebody types anywhere outside the scan field.
    if (burst.length < 2) return

    // The field can have been re-rendered away in the meantime (the ticket row
    // it belonged to removed by the scan itself). Writing to a detached node
    // repairs nothing and dispatches an input event into a dead tree.
    if (!stolen.el.isConnected) return

    // Already back to what it was: React reverted it, or the burst never
    // reached it. Nothing to give back, and writing would be a no-op event.
    if (stolen.el.value === stolen.value) return

    // Restore only while the field is still recognisably the one we borrowed.
    // A literal "does it still contain the burst" test is not enough on its
    // own: the ticket's quantity cell is controlled, so React has already run
    // the burst through setQty's MAX_QTY clamp and the field reads 999 rather
    // than the digits that were sent. Focus never left it in that case — we
    // deliberately do not steal it, see the hijack branch below — so "still the
    // active element" covers the controlled inputs and the substring test
    // covers the plain ones whose focus has moved on.
    if (!stolen.el.value.includes(burst) && document.activeElement !== stolen.el) return

    setNativeValue(stolen.el, stolen.value)
  }, [])

  const reset = useCallback(() => {
    clearTimer()
    // Before the buffer is dropped: giveBack needs it to recognise its own
    // characters. This ordering is load-bearing.
    giveBack(typed.current)
    typed.current = ''
    physical.current = ''
  }, [giveBack])

  useEffect(() => {
    const emit = () => {
      const code = typed.current
      const alt = physical.current
      // reset() puts the borrowed field back (see giveBack) — including on the
      // sub-minLength return just below, which is the path that used to leave a
      // short burst sitting in the cashier's quantity cell. The restore happens
      // before onScan, as it always did: the caller decides where the focus
      // goes next.
      reset()
      if (code.length < minLength) return
      flushedAt.current = performance.now()
      onScanRef.current(code, alt !== code ? alt : null)
    }

    /**
     * `emit` calls straight into the caller's `onScan`, which on the till is the
     * whole synchronous lookup over three in-memory indexes. If that throws, the
     * throw must not leave this module: it is reached either from a native
     * window listener or from a setTimeout, so React never sees it and there is
     * nothing above to catch it — the till would go to a blank page mid-sale,
     * open basket included. Contain it, put the buffer and the borrowed field
     * back into a sane state, and say so loudly on the console since there is no
     * telemetry here.
     */
    const flush = () => {
      try {
        emit()
      } catch (err) {
        // reset() has already run inside emit() unless the throw came before it,
        // and it is idempotent (giveBack has nulled the ref), so this is the
        // unconditional cleanup that makes the guarantee hold either way.
        reset()
        console.error(
          '[useBarcodeScanner] onScan threw and was contained; the scan was dropped, the buffer cleared and the borrowed field restored.',
          err,
        )
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      // A held-down key repeats every ~30 ms and would read exactly like a
      // scan; an IME composition reports a meaningless key.
      if (e.repeat || e.isComposing || e.keyCode === 229) return
      if (e.ctrlKey || e.altKey || e.metaKey) return

      if (e.key === 'Enter' || e.key === 'Tab') {
        // The code went out a moment ago — on the timer, or on the last
        // character because the caller recognised it. This key is that
        // scanner's suffix arriving late, and it must not reach the page.
        if (
          typed.current.length === 0 &&
          performance.now() - flushedAt.current < TRAILING_SUFFIX_MS
        ) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return
        }
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
      const mapped = PHYSICAL[e.code]
      physical.current +=
        mapped === undefined
          ? e.key
          : isLetter(mapped) && e.shiftKey
            ? mapped.toUpperCase()
            : mapped

      // Exactly at the threshold, not past it, so this fires once per burst.
      if (typed.current.length === minLength) onBurstStartRef.current?.()

      // The catalogue recognises what is in the buffer and nothing longer
      // starts with it, so there is nothing left to wait for. This is what
      // takes the delay between the beep and the line on the ticket down to
      // nothing on the codes the shop actually sells.
      if (typed.current.length >= minLength && isCompleteRef.current) {
        const alt = physical.current !== typed.current ? physical.current : null
        if (isCompleteRef.current(typed.current, alt)) {
          // This character has been consumed by the code that just went out.
          // Let the browser type it and it lands in the scan field a moment
          // AFTER the caller emptied that field, leaving the last digit of
          // every scan sitting there to corrupt the next one.
          e.preventDefault()
          clearTimer()
          flush()
          return
        }
      }

      // Restart the "code complete" countdown on every character. This is what
      // removes the Enter key: the burst ends by simply going quiet.
      clearTimer()
      timer.current = setTimeout(flush, END_OF_SCAN_MS)
    }

    /**
     * The listener the window actually gets. Everything above runs inside a
     * native capture-phase handler, so a throw does not even reach React's event
     * dispatch: it escapes as an uncaught error, and until it is caught nowhere
     * the whole till unmounts to a blank page with the basket in it. The caller's
     * `isComplete` is the realistic source — it is asked on every character once
     * the buffer is long enough — and a throw there lands between the last
     * character and `e.preventDefault()`, leaving the previous character's timer
     * armed and a stray digit in the field. So: drop the buffer, give the
     * borrowed field back, swallow the character that caused it rather than let
     * it corrupt the next scan, and keep selling.
     */
    const onKeyDown = (e: KeyboardEvent) => {
      try {
        handleKey(e)
      } catch (err) {
        reset()
        if (e.cancelable) e.preventDefault()
        console.error(
          '[useBarcodeScanner] the keydown handler threw and was contained; the buffer was dropped and the borrowed field restored. Key:',
          e.key,
          err,
        )
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      // Unmounting mid-burst is an exit too, and the borrowed field can live
      // outside the tree that is going away (the shell's search box while the
      // till navigates). reset() rather than clearTimer() alone so it is given
      // back; giveBack checks the node is still in the document, so a field that
      // is unmounting with us is left alone.
      reset()
    }
  }, [minLength, reset, targetRef])

  // Stable identity: callers keep this in effect dependency lists, and a fresh
  // object on every render would re-run them forever.
  return useMemo(() => ({ reset }), [reset])
}
