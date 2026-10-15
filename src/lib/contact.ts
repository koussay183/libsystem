/**
 * How a shop reaches Mektebti: renewals, a forgotten password, an account to
 * switch on. Kept in one place so the plan banner, the login screen and the
 * account messages cannot end up pointing at different numbers.
 *
 * Same number as CONTACT in src/features/landing/copy.ts — that file is the
 * landing's and stays out of the till bundle, so the number is written twice.
 */
export const CONTACT = {
  /** Local 8 digits, without +216. */
  phone: '98158160',
} as const

/** "+216 98 158 160", the way it is read aloud. */
export const CONTACT_DISPLAY = `+216 ${CONTACT.phone.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3')}`

export const CONTACT_TEL = `tel:+216${CONTACT.phone}`

/** A WhatsApp chat with the message already typed; the owner only presses send. */
export function whatsappLink(text: string): string {
  return `https://wa.me/216${CONTACT.phone}?text=${encodeURIComponent(text)}`
}
