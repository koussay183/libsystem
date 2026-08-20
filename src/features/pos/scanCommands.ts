import { fold } from '@/lib/textIndex'

/**
 * BUTTONS THE SHOPKEEPER CAN SCAN.
 *
 * The owner of this shop is an old man with a queue in front of him, and the
 * scanner is already in his hand. Putting it down, finding a button with the
 * mouse and picking it up again is the slowest thing he does all day — so the
 * two or three actions he repeats a hundred times a shift are printed as
 * labels and stuck to the counter next to the reader.
 *
 * WHY THIS IS DELIBERATELY A SHORT LIST. Every command code is a code that can
 * no longer be a product, and a shop that stuck a label on every button would
 * eventually scan one by accident with a customer's article. So: opening the
 * payment, confirming it, and reprinting the last ticket. Nothing that deletes,
 * nothing that discounts, nothing that cannot be undone by scanning again.
 *
 * WHY THE CODES LOOK LIKE THIS. `CMD` + a word, letters and digits only — the
 * same alphabet the QR service labels use (see ServicesTab.cleanCode), because
 * it is the only alphabet that survives a scanner sending US scancodes to a
 * French keyboard. No supplier prints a barcode that is letters, so these
 * cannot collide with an article; they CAN collide with a service code the
 * owner invents, which is why {@link isCommandCode} is checked against the
 * shop's own services before a command is ever acted on.
 */
export type ScanCommand = 'pay' | 'confirm' | 'reprint'

/** The printed code -> what it does. Folded keys; see {@link commandOf}. */
const COMMANDS: Record<string, ScanCommand> = {
  cmdpay: 'pay',
  cmdok: 'confirm',
  cmdprint: 'reprint',
}

/** Every reserved code, as printed. For the label sheet and the collision check. */
export const COMMAND_CODES = ['CMDPAY', 'CMDOK', 'CMDPRINT'] as const

/**
 * What this scan commands, or null for "an ordinary code, carry on".
 *
 * Folded and stripped the same way a service code is, so the label still works
 * read off a keyboard that disagrees with the scanner about its layout — the
 * physical-key candidate is passed in as well and either may match.
 */
export function commandOf(code: string, physical?: string | null): ScanCommand | null {
  for (const candidate of [code, physical]) {
    if (!candidate) continue
    const key = fold(candidate).replace(/[^a-z0-9]/g, '')
    const hit = COMMANDS[key]
    if (hit) return hit
  }
  return null
}

/** True when this code is one the shop must not give to a service or article. */
export function isCommandCode(code: string): boolean {
  return commandOf(code) !== null
}
