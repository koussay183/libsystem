/**
 * The arithmetic of the carnet de crédit.
 *
 * A paper carnet is written top-to-bottom: the newest line goes at the bottom
 * and the running balance on the right is whatever the previous line left plus
 * what just happened. So the balance can only be computed oldest -> newest,
 * even though the screen shows the newest line first. Everything here is pure
 * and works on integer millimes, so it can be unit-tested and reused by both
 * the index page and the client page.
 */

import type { CreditEntry } from '@/types/models'

/** A client is chased again when nothing has been paid for this many days. */
export const REMINDER_DAYS = 60

const DAY_MS = 86_400_000

/**
 * What a line does to the balance. Amounts are always stored positive; the
 * `type` carries the direction — he took goods (+), he paid money back (−).
 */
export function signedAmount(entry: CreditEntry): number {
  return entry.type === 'debit' ? entry.amount : -entry.amount
}

/** Oldest first. `createdAt` breaks ties so two same-day lines keep their order. */
function chronological(entries: CreditEntry[]): CreditEntry[] {
  return [...entries].sort((a, b) => a.date - b.date || a.createdAt - b.createdAt)
}

export interface LedgerRow {
  entry: CreditEntry
  /** Balance owed by the client *after* this line. */
  balance: number
}

/**
 * Walks the entries oldest -> newest accumulating the running balance, then
 * returns them newest first — exactly how a real carnet is used: written from
 * the top down, read from the last line up.
 */
export function buildLedger(entries: CreditEntry[]): LedgerRow[] {
  let running = 0
  const rows = chronological(entries).map((entry) => {
    running += signedAmount(entry)
    return { entry, balance: running }
  })
  rows.reverse()
  return rows
}

export interface LedgerTotals {
  /** Everything he ever took on credit. */
  taken: number
  /** Everything he ever paid back. */
  paid: number
  /** taken - paid. Positive = he owes; negative = the shop owes him. */
  balance: number
}

export function ledgerTotals(entries: CreditEntry[]): LedgerTotals {
  let taken = 0
  let paid = 0
  for (const e of entries) {
    if (e.type === 'debit') taken += e.amount
    else paid += e.amount
  }
  return { taken, paid, balance: taken - paid }
}

/**
 * When the *current* run of debt started: the moment the balance last crossed
 * from settled (<= 0) to owing (> 0). Every time the account is cleared the
 * clock resets, which is what the owner means by "since when does he owe me?".
 * Null when he currently owes nothing.
 */
export function debtStartedAt(entries: CreditEntry[]): number | null {
  let running = 0
  let startedAt: number | null = null
  for (const e of chronological(entries)) {
    const before = running
    running += signedAmount(e)
    if (before <= 0 && running > 0) startedAt = e.date
    if (running <= 0) startedAt = null
  }
  return running > 0 ? startedAt : null
}

/** Date of the last money he handed over, whatever the balance is now. */
export function lastPaymentAt(entries: CreditEntry[]): number | null {
  let last: number | null = null
  for (const e of entries) {
    if (e.type === 'payment' && (last === null || e.date > last)) last = e.date
  }
  return last
}

/** Whole days elapsed since `ts`, never negative. */
export function daysSince(ts: number, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - ts) / DAY_MS))
}

/**
 * How long the client has been carrying his current debt, in days.
 * Null when he owes nothing.
 */
export function debtAgeDays(entries: CreditEntry[], now?: number): number | null {
  const started = debtStartedAt(entries)
  return started === null ? null : daysSince(started, now)
}

/**
 * Worth a reminder: he owes money and nothing has come in for REMINDER_DAYS.
 * If he has never paid a millime, the debt's own age is the clock.
 */
export function needsReminder(
  entries: CreditEntry[],
  balance: number,
  now?: number,
): boolean {
  if (balance <= 0) return false
  const reference = lastPaymentAt(entries) ?? debtStartedAt(entries)
  if (reference === null) return false
  return daysSince(reference, now) >= REMINDER_DAYS
}

/** Groups a flat feed of ledger lines by client, for the index page. */
export function groupByCustomer(entries: CreditEntry[]): Map<string, CreditEntry[]> {
  const map = new Map<string, CreditEntry[]>()
  for (const e of entries) {
    const list = map.get(e.customerId)
    if (list) list.push(e)
    else map.set(e.customerId, [e])
  }
  return map
}
