/**
 * The four windows the "Argent" page can be read through, and the maths that
 * turns each one into (a) a date range, (b) the equivalent previous range for
 * the growth comparison, and (c) the buckets the chart is drawn from.
 *
 * Kept free of React and of i18n on purpose: pure date maths, easy to reason
 * about and to check by hand.
 *
 * Every function here takes `now` and reads no clock of its own, so none of
 * these boundaries can go stale on their own — but that puts the burden on the
 * caller: a `now` captured once at mount silently turns "aujourd'hui" into "the
 * day the page was opened" on a shop PC whose tab is never closed. Nothing in
 * this file may be memoised at module scope for the same reason. See
 * `useDayStart` and how `DashboardPage` refreshes `now` at midnight.
 */

import dayjs from 'dayjs'

export type Period = 'today' | 'week' | 'month' | 'year'

/** Display order of the period selector. */
export const PERIODS: readonly Period[] = ['today', 'week', 'month', 'year'] as const

export interface Range {
  /** Inclusive epoch-ms lower bound. */
  start: number
  /** Inclusive epoch-ms upper bound. */
  end: number
}

export interface Bucket {
  /** Matches what `bucketKey` returns for any timestamp inside the bucket. */
  key: string
  /** Short axis label — numeric only, so it reads the same in FR and AR. */
  label: string
}

/**
 * How a timestamp is collapsed into a bucket. Numeric formats only: dayjs is
 * not locale-configured in this app, so `dddd`/`MMMM` would leak English.
 */
const KEY_FORMAT: Record<Period, string> = {
  today: 'YYYY-MM-DD-HH',
  week: 'YYYY-MM-DD',
  month: 'YYYY-MM-DD',
  year: 'YYYY-MM',
}

/** The window the KPIs and the chart cover. */
export function periodRange(period: Period, now: number): Range {
  const d = dayjs(now)
  switch (period) {
    case 'today':
      return { start: d.startOf('day').valueOf(), end: d.endOf('day').valueOf() }
    case 'week':
      return {
        start: d.subtract(6, 'day').startOf('day').valueOf(),
        end: d.endOf('day').valueOf(),
      }
    case 'month':
      return {
        start: d.subtract(29, 'day').startOf('day').valueOf(),
        end: d.endOf('day').valueOf(),
      }
    case 'year':
      return {
        start: d.subtract(11, 'month').startOf('month').valueOf(),
        end: d.endOf('month').valueOf(),
      }
  }
}

/**
 * The window of the same length sitting immediately before `periodRange`.
 * "30 derniers jours" therefore compares against the 30 days before those.
 */
export function previousRange(period: Period, now: number): Range {
  const { start } = periodRange(period, now)
  const s = dayjs(start)
  const shifted = (amount: number, unit: 'day' | 'month'): Range => ({
    start: s.subtract(amount, unit).valueOf(),
    end: start - 1,
  })
  switch (period) {
    case 'today':
      return shifted(1, 'day')
    case 'week':
      return shifted(7, 'day')
    case 'month':
      return shifted(30, 'day')
    case 'year':
      return shifted(12, 'month')
  }
}

/** Every bucket of the window, oldest first — the chart's x axis. */
export function buildBuckets(period: Period, now: number): Bucket[] {
  const d = dayjs(now)
  const key = KEY_FORMAT[period]
  switch (period) {
    case 'today': {
      const midnight = d.startOf('day')
      return Array.from({ length: 24 }, (_, i) => {
        const h = midnight.add(i, 'hour')
        return { key: h.format(key), label: h.format('HH[h]') }
      })
    }
    case 'week':
    case 'month': {
      const length = period === 'week' ? 7 : 30
      const first = d.startOf('day').subtract(length - 1, 'day')
      return Array.from({ length }, (_, i) => {
        const day = first.add(i, 'day')
        return { key: day.format(key), label: day.format('DD/MM') }
      })
    }
    case 'year': {
      const first = d.startOf('month').subtract(11, 'month')
      return Array.from({ length: 12 }, (_, i) => {
        const m = first.add(i, 'month')
        return { key: m.format(key), label: m.format('MM/YY') }
      })
    }
  }
}

/** Which bucket a timestamp falls into, for the current period. */
export function bucketKey(period: Period, ts: number): string {
  return dayjs(ts).format(KEY_FORMAT[period])
}

/**
 * How many x-axis labels recharts may skip. 30 daily labels do not fit on a
 * phone, so we thin them out rather than let them overlap.
 */
export function axisInterval(period: Period): number {
  switch (period) {
    case 'today':
      return 3
    case 'month':
      return 4
    default:
      return 0
  }
}

/**
 * How many tickets to subscribe to for a given period. The 12-month view needs
 * a far deeper history than "today" does, and the cap keeps Firestore reads
 * bounded for a shop that rings up thousands of tickets.
 */
export function salesCapFor(period: Period): number {
  // Sized for the shop's busiest realistic run, not its quietest: a stationery
  // shop at the rentrée can ring 30+ tickets a day, so 400 covered barely two
  // weeks of a "30 jours" view and the growth comparison — which needs the
  // PRECEDING period too — fell entirely outside the window and silently
  // reported no previous activity at all.
  switch (period) {
    case 'today':
      return 500
    case 'week':
      return 1500
    case 'month':
      return 4000
    case 'year':
      return 12000
  }
}
