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

/** Convert a decimal amount of dinars into integer millimes. */
export function toMinor(amountInUnits: number): Minor {
  return Math.round(amountInUnits * CURRENCY.minorPerUnit)
}

/** Convert integer millimes back into a decimal amount of dinars. */
export function fromMinor(minor: Minor): number {
  return minor / CURRENCY.minorPerUnit
}

/**
 * Parse user input ("12,500", "12.5", "12 500") into integer millimes.
 * Returns null when the input is empty or not a valid non-negative number.
 */
export function parseMoney(input: string | number | null | undefined): Minor | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? toMinor(input) : null
  }
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return toMinor(value)
}

/**
 * Format integer millimes for display, e.g. 12500 -> "12,500 DT".
 * The currency symbol is passed in so it can be localised (DT / د.ت).
 */
export function formatMoney(
  minor: Minor,
  opts?: { symbol?: string; locale?: string },
): string {
  const locale = opts?.locale ?? 'fr-TN'
  const number = fromMinor(minor).toLocaleString(locale, {
    minimumFractionDigits: CURRENCY.decimals,
    maximumFractionDigits: CURRENCY.decimals,
  })
  return opts?.symbol ? `${number} ${opts.symbol}` : number
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

/** Profit margin as a percentage of the sale price. Guards divide-by-zero. */
export function marginPercent(costMinor: Minor, saleMinor: Minor): number | null {
  if (saleMinor <= 0) return null
  return ((saleMinor - costMinor) / saleMinor) * 100
}
