/**
 * Money is ALWAYS stored as an integer number of minor units (millimes for TND,
 * where 1 dinar = 1000 millimes). Never store money as a floating-point number
 * of dinars — that is how accounting apps leak fractions of a cent. All maths
 * happens on integers; we only convert to a decimal for display.
 */

export const CURRENCY = {
  code: 'TND',
  /** millimes: 1 TND = 1000 millimes -> 3 decimal places */
  decimals: 3,
  minorPerUnit: 1000,
} as const

/** An integer amount of minor units (millimes). */
export type Minor = number

// ---------------------------------------------------------------------------
// How prices are written on screen and typed into a field
// ---------------------------------------------------------------------------

/**
 * Two ways to say the same amount.
 *
 *   'dinar'   — 10,500 DT. What a price tag says.
 *   'millime' — 10 500. What a shopkeeper who counts in millimes says.
 *
 * This changes DISPLAY AND INPUT together, and nothing else: storage is always
 * integer millimes, whichever way the shop reads them. That is the whole point
 * of keeping the switch down here — every screen and every price field in the
 * app already goes through these four functions, so they all turn over at once
 * and none of them can end up disagreeing about what the number in front of
 * the owner means.
 */
export type MoneyMode = 'dinar' | 'millime'

const MODE_KEY = 'money.mode'

function readStoredMode(): MoneyMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'millime' ? 'millime' : 'dinar'
  } catch {
    return 'dinar'
  }
}

/**
 * Read from localStorage at module load, not from the shop settings.
 *
 * The settings document arrives a moment after the first paint, and a till
 * that shows dinars for half a second and then flips to millimes is a till
 * that gets misread. The setting still lives in the shop document — that is
 * what carries it to the other machine — this is only the local echo of it.
 */
let mode: MoneyMode = readStoredMode()

const listeners = new Set<() => void>()

export function getMoneyMode(): MoneyMode {
  return mode
}

export function setMoneyMode(next: MoneyMode): void {
  if (next === mode) return
  mode = next
  try {
    localStorage.setItem(MODE_KEY, next)
  } catch {
    /* private mode — the setting still holds for this session */
  }
  for (const listener of listeners) listener()
}

/** For useSyncExternalStore, so the screen redraws when the owner flips it. */
export function subscribeMoneyMode(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The i18n key for the unit, which is part of the mode.
 *
 * Every screen asks for its currency symbol through this rather than naming
 * `money.symbol` directly, so a label reading "Prix (DT)" cannot survive next
 * to a field that now wants millimes.
 */
export function moneySymbolKey(): string {
  return mode === 'millime' ? 'money.millimes' : 'money.symbol'
}

// ---------------------------------------------------------------------------

/** Convert what the owner typed into the integer millimes we store. */
export function toMinor(amount: number): Minor {
  return mode === 'millime'
    ? Math.round(amount)
    : Math.round(amount * CURRENCY.minorPerUnit)
}

/**
 * Convert stored millimes into the number the owner reads and edits.
 *
 * In millime mode this is the identity — which is exactly why every price
 * field in the app fills itself correctly with no change at the call site.
 */
export function fromMinor(minor: Minor): number {
  return mode === 'millime' ? minor : minor / CURRENCY.minorPerUnit
}

/**
 * Parse user input into integer millimes. Null when it is empty or not a
 * usable non-negative number.
 *
 * The separators mean different things in the two modes, and getting that
 * wrong is expensive: in dinars "10,500" is ten dinars and a half, while in
 * millimes it is ten thousand five hundred millimes — the same amount, but
 * read as a decimal it would come out as eleven millimes.
 */
export function parseMoney(input: string | number | null | undefined): Minor | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? toMinor(input) : null
  }
  const trimmed = input.trim()
  if (trimmed === '') return null

  const cleaned =
    mode === 'millime'
      ? // Millimes are whole; a comma or a space can only be grouping.
        trimmed.replace(/[\s,\u00a0\u202f]/g, '')
      : trimmed.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')

  if (cleaned === '') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return toMinor(value)
}

/**
 * Format integer millimes for display: 12500 -> "12,500 DT" or "12 500".
 * The unit is passed in so it can be localised (DT / د.ت / mill).
 */
export function formatMoney(
  minor: Minor,
  opts?: { symbol?: string; locale?: string },
): string {
  const locale = opts?.locale ?? 'fr-TN'
  const decimals = mode === 'millime' ? 0 : CURRENCY.decimals
  const number = fromMinor(minor).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return opts?.symbol ? `${number} ${opts.symbol}` : number
}

/**
 * The greyed-out example inside an empty price field.
 *
 * "0.000" next to a field that wants whole millimes teaches the wrong thing on
 * the one screen where the owner is deciding how to type.
 */
export function moneyPlaceholder(): string {
  return mode === 'millime' ? '0' : '0.000'
}

/**
 * Stored millimes -> the text a price field should start with.
 *
 * Zero comes back empty: a field pre-filled with "0" is a field the owner has
 * to clear before he can type, and one he can leave at zero by accident.
 *
 * It fills through `fromMinor`, so it follows the money mode. A hand-rolled
 * copy of this in the credit dialog used `.toFixed(3)`, which hard-codes the
 * dinar form and would have put "5000.000" in the box for a shop counting in
 * millimes.
 *
 * This is the one implementation of both rules, and it has to stay the one:
 * the product form and the credit dialog each carried a private copy, which is
 * how the zero-is-empty rule gets corrected in one dialog and stays wrong in
 * the other two. Every price field that starts from a stored amount comes
 * through here.
 */
export function toInput(minor: Minor): string {
  if (!minor) return ''
  return String(fromMinor(minor))
}

/**
 * Parse a typed unit count into a whole number of units.
 * Handles the separators people actually type ("1 000", "1,5") — a bare
 * `Number(x) || 0` turns those into NaN and then silently into ZERO, which
 * would wipe a product's stock without a word. Returns null when the input is
 * not a usable count, so the caller can refuse to save instead of guessing.
 */
export function parseQuantity(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  const cleaned = String(input).trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return 0
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.trunc(value)
}

/**
 * There is deliberately no margin helper in this module, and adding one back
 * would reopen a bug that cost real confusion.
 *
 * Margin is a pricing decision, not a currency concern, and it lives in exactly
 * one place: `marginFromPrices` in src/features/stock/pricing.ts, which is
 * margin ON COST — the definition the product form's margin field asks for and
 * the one `saleFromCost` prices with.
 *
 * This file used to export a `marginPercent` that was margin OF THE SALE price.
 * Its single caller was the readout under the product form's price fields, so
 * cost 1000 with margin 35 produced a sale price of 1350 and a readout of
 * "25,9 %": the owner reading the number he had typed and a different number
 * the app had derived from it, both labelled marge, in the same dialog, with no
 * way to tell which one his shelf labels ran on.
 *
 * Profit as a share of revenue is a reporting quantity, not a price input. The
 * two places that want it (ReportsPage.tsx:61, useDashboardStats.ts:89) divide
 * a profit they have already summed by a revenue they have already summed,
 * where the divisor is named on the spot and cannot be mistaken for a margin
 * somebody typed.
 */
