/**
 * Tunisian phone numbers: eight digits, written "98 123 456", sometimes with
 * the +216 / 00216 country code in front.
 *
 * Only the display is tidied. A number that does not look Tunisian (a Libyan
 * or French client) is kept exactly as typed — the field warns, it never
 * refuses, because a shop that cannot save a customer's real number writes it
 * on paper instead.
 */

/** Digits only, with a leading + kept. */
function bare(input: string): string {
  const t = input.trim()
  const plus = t.startsWith('+')
  return (plus ? '+' : '') + t.replace(/\D/g, '')
}

/** The eight national digits, or null when the number is not a Tunisian one. */
export function tnDigits(input: string | undefined | null): string | null {
  if (!input) return null
  let d = bare(input)
  if (d.startsWith('+216')) d = d.slice(4)
  else if (d.startsWith('00216')) d = d.slice(5)
  else if (d.length === 11 && d.startsWith('216')) d = d.slice(3)
  return /^\d{8}$/.test(d) ? d : null
}

/** "98123456" -> "98 123 456". */
const group8 = (d: string) => `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`.trim()

/**
 * Formats while the owner types: digits are grouped "XX XXX XXX" as they come,
 * with the country code kept in front when he typed one. Anything with letters
 * or more digits than a Tunisian number is left alone.
 */
export function formatPhoneTyping(input: string): string {
  if (/[^\d\s+.\-/()]/.test(input)) return input
  const b = bare(input)
  let prefix = ''
  let rest = b
  if (b.startsWith('+216')) {
    prefix = '+216 '
    rest = b.slice(4)
  } else if (b.startsWith('00216')) {
    prefix = '00216 '
    rest = b.slice(5)
  } else if (b.startsWith('+')) {
    return input
  }
  if (rest.length > 8) return input
  // Let a trailing space be typed: grouping it away would fight the keyboard.
  const formatted = prefix + (rest.length > 2 ? group8(rest) : rest)
  return formatted.trimEnd() === input.trimEnd() ? input : formatted.trimEnd()
}

/** The tidy form saved with the customer: "98 123 456", or what was typed. */
export function normalizePhone(input: string): string {
  const d = tnDigits(input)
  if (!d) return input.trim()
  const b = bare(input)
  const hasCode = b.startsWith('+216') || b.startsWith('00216') || b.length === 11
  return hasCode ? `+216 ${group8(d)}` : group8(d)
}

/** True when the field is empty or holds a Tunisian number. */
export function isTnPhone(input: string): boolean {
  return input.trim() === '' || tnDigits(input) !== null
}

/** Digits only, for comparing two numbers typed differently. */
export const phoneKey = (input: string | undefined | null): string =>
  tnDigits(input) ?? (input ?? '').replace(/\D/g, '')
