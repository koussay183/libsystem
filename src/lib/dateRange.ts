import dayjs from 'dayjs'

/**
 * The date windows a history list can be read through: the sales, the
 * purchases. Calendar windows ("ce mois-ci") rather than the dashboard's
 * rolling ones ("30 derniers jours"), because that is how a facture is looked
 * for — "the one from last month", not "the one from 30 to 60 days ago".
 */
export type HistoryPeriod =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'lastMonth'
  | 'year'
  | 'custom'

export const HISTORY_PERIODS: readonly HistoryPeriod[] = [
  'all',
  'today',
  'yesterday',
  'week',
  'month',
  'lastMonth',
  'year',
  'custom',
] as const

/**
 * A half-open window in epoch-ms: `from` inclusive, `to` exclusive. `null` is
 * an open end. Half-open so two neighbouring days never both claim midnight.
 */
export interface DateSpan {
  from: number | null
  to: number | null
}

/** What the two date fields of the "choisir les dates" mode hold: YYYY-MM-DD. */
export interface CustomDates {
  from: string
  to: string
}

/** A date field's value, or null when it is empty or unreadable. */
function dayStart(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = dayjs(value)
  return d.isValid() ? d.startOf('day').valueOf() : null
}

/**
 * The window a period covers, read from the clock NOW.
 *
 * Deliberately not memoised anywhere: the shop PC keeps one tab open for days,
 * and a "today" computed once at mount quietly becomes "the day the page was
 * opened". Every boundary here moves only at a midnight, so recomputing it on
 * each render does not churn the queries keyed on it.
 */
export function spanOf(period: HistoryPeriod, custom: CustomDates, now = Date.now()): DateSpan {
  const d = dayjs(now)
  switch (period) {
    case 'all':
      return { from: null, to: null }
    case 'today':
      return { from: d.startOf('day').valueOf(), to: null }
    case 'yesterday':
      return {
        from: d.subtract(1, 'day').startOf('day').valueOf(),
        to: d.startOf('day').valueOf(),
      }
    case 'week':
      return { from: d.subtract(6, 'day').startOf('day').valueOf(), to: null }
    case 'month':
      return { from: d.startOf('month').valueOf(), to: null }
    case 'lastMonth':
      return {
        from: d.subtract(1, 'month').startOf('month').valueOf(),
        to: d.startOf('month').valueOf(),
      }
    case 'year':
      return { from: d.startOf('year').valueOf(), to: null }
    case 'custom': {
      const from = dayStart(custom.from)
      const toDay = dayStart(custom.to)
      // "Au 15/09" means through the end of the 15th.
      const to = toDay === null ? null : dayjs(toDay).add(1, 'day').valueOf()
      // Typed the wrong way round: read it the way it was meant.
      if (from !== null && to !== null && from >= to) {
        return { from: toDay, to: dayjs(from).add(1, 'day').valueOf() }
      }
      return { from, to }
    }
  }
}

/** Whether a timestamp falls inside a window. */
export function inSpan(ts: number, span: DateSpan): boolean {
  if (span.from !== null && ts < span.from) return false
  if (span.to !== null && ts >= span.to) return false
  return true
}
