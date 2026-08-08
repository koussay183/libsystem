import dayjs from 'dayjs'

/** Format an epoch-ms timestamp as DD/MM/YYYY. */
export function formatDate(ts: number): string {
  return dayjs(ts).format('DD/MM/YYYY')
}

/** Format an epoch-ms timestamp as DD/MM/YYYY HH:mm. */
export function formatDateTime(ts: number): string {
  return dayjs(ts).format('DD/MM/YYYY HH:mm')
}

/** A whole-number percentage with one decimal, e.g. "37.5 %". */
export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)} %`
}
