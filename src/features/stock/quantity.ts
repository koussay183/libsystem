/**
 * Reading a count of units typed in a back-office field, with sane bounds.
 *
 * parseQuantity (lib/money.ts) is lenient on purpose and has no ceiling, so
 * a barcode scanned into a Qté box became 6 199 990 000 047 pièces and a stock
 * value in the trillions, and "1,5" or "1.000" quietly became 1. These screens
 * read counts through here instead.
 */

/** The most units one field accepts — far above any delivery a bookshop receives. */
export const MAX_UNITS = 99_999

export type CountProblem = 'unreadable' | 'barcode' | 'tooBig'

export type CountReading = { value: number; problem?: undefined } | { value?: undefined; problem: CountProblem }

/**
 * Whole units, or the reason the text is not one.
 *
 * "1.000" and "1 000" are a thousand, as Tunisians write it. "1,5" is refused
 * rather than truncated: half a cahier is a typo, and so is "1,000" (a comma
 * is the decimal mark here, so it reads as one).
 */
export function readCount(text: string, max: number = MAX_UNITS): CountReading {
  const s = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s  ]/g, '')
  if (s === '') return { value: 0 }
  let digits: string
  if (/^\d+$/.test(s)) digits = s
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) digits = s.replace(/\./g, '')
  else return { problem: 'unreadable' }
  // Eight digits and more is what a hand scanner sends, not what anyone counts.
  if (digits.length >= 8) return { problem: 'barcode' }
  const value = Number(digits)
  if (value > max) return { problem: 'tooBig' }
  return { value }
}

/** The i18n key and options for a problem, so every screen says it the same way. */
export function countMessage(problem: CountProblem, max: number = MAX_UNITS): [string, { max: number }] {
  if (problem === 'barcode') return ['backFix.qtyLooksLikeCode', { max }]
  if (problem === 'tooBig') return ['backFix.qtyTooBig', { max }]
  return ['common.invalidNumber', { max }]
}
