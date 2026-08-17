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

/**
 * When a line happened, as a number that can always be compared.
 *
 * Both `date` and `createdAt` are plain `Date.now()` millisecond integers
 * stamped on the machine that wrote the line — `addCreditEntry`
 * (useCustomers.ts) and `recordSale` (useSales.ts) are the only two writers and
 * neither uses `serverTimestamp()`. That is not an oversight and must not be
 * "improved": a `serverTimestamp()` sentinel reads back as `null` on a document
 * that is still queued in IndexedDB, so with the line down every sort and
 * comparison in this module would fold the shop's newest lines onto one end of
 * the carnet — or, through an `orderBy` on the field, drop them from the query
 * altogether. A local stamp is the only value that exists at the moment the
 * owner writes the line, and it is the value the ledger has to be ordered by.
 *
 * The fallbacks are for lines this app did not write. A restored backup goes in
 * through `backupService` as raw JSON rows with no per-row validation, so `date`
 * can be missing or a string. `a.date - b.date` on such a row is `NaN`, and a
 * comparator that returns `NaN` leaves `Array.prototype.sort`'s ordering
 * implementation-defined — which silently scrambles the running-balance column
 * of a book the shop settles real money on. Coercing to a finite number keeps
 * the order deterministic and keeps the line in the ledger instead of losing it.
 */
export function entryTime(entry: CreditEntry): number {
  if (Number.isFinite(entry.date)) return entry.date
  if (Number.isFinite(entry.createdAt)) return entry.createdAt
  return 0
}

/** When the line was written, used only to break a same-instant tie. */
function writtenAt(entry: CreditEntry): number {
  return Number.isFinite(entry.createdAt) ? entry.createdAt : entryTime(entry)
}

/** Oldest first. `createdAt` breaks ties so two same-day lines keep their order. */
function chronological(entries: CreditEntry[]): CreditEntry[] {
  return [...entries].sort(
    (a, b) => entryTime(a) - entryTime(b) || writtenAt(a) - writtenAt(b),
  )
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
    if (before <= 0 && running > 0) startedAt = entryTime(e)
    if (running <= 0) startedAt = null
  }
  return running > 0 ? startedAt : null
}

/**
 * Date of the last money he handed over, whatever the balance is now.
 *
 * Read through `entryTime` rather than `e.date` directly: a row whose `date` is
 * not a number compares false against everything, so the payment would drop out
 * of "when did he last pay?" without a trace — and `needsReminder` below would
 * then chase a client who settled up last week.
 */
export function lastPaymentAt(entries: CreditEntry[]): number | null {
  let last: number | null = null
  for (const e of entries) {
    if (e.type !== 'payment') continue
    const at = entryTime(e)
    if (last === null || at > last) last = at
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
