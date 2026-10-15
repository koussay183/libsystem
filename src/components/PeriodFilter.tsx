import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Field, Flex, Input, NativeSelect } from '@chakra-ui/react'
import dayjs from 'dayjs'
import { HISTORY_PERIODS, spanOf } from '@/lib/dateRange'
import type { CustomDates, HistoryPeriod } from '@/lib/dateRange'
import type { ActiveFilter } from './ActiveFilters'

const LABEL_KEY: Record<HistoryPeriod, string> = {
  all: 'filters.periodAll',
  today: 'filters.periodToday',
  yesterday: 'filters.periodYesterday',
  week: 'filters.periodWeek',
  month: 'filters.periodMonth',
  lastMonth: 'filters.periodLastMonth',
  year: 'filters.periodYear',
  custom: 'filters.periodCustom',
}

/**
 * The chip ActiveFilters shows for a period other than "all dates": the
 * menu's own words, or the two dates themselves for a custom window.
 */
export function periodChip(
  t: (key: string) => string,
  period: HistoryPeriod,
  custom: CustomDates,
  onRemove: () => void,
): ActiveFilter[] {
  if (period === 'all') return []
  return [
    { key: 'period', label: period === 'custom' ? customLabel(t, custom) : t(LABEL_KEY[period]), onRemove },
  ]
}

/**
 * The window actually applied, oldest first and in DD/MM/YYYY — built from
 * spanOf, which swaps dates typed the wrong way round. The raw fields read
 * "2026-10-12 → 2026-10-05" for a list that was in fact 05 → 12.
 */
function customLabel(t: (key: string) => string, custom: CustomDates): string {
  const span = spanOf('custom', custom)
  if (span.from === null && span.to === null) return t(LABEL_KEY.custom)
  const fmt = (ms: number) => dayjs(ms).format('DD/MM/YYYY')
  const from = span.from === null ? '…' : fmt(span.from)
  // `to` is exclusive (the next midnight); the last day shown is the one before.
  const to = span.to === null ? '…' : fmt(span.to - 1)
  return `${from} → ${to}`
}

/** For useSessionState: a stored custom window must still be two strings. */
export const isCustomDates = (v: unknown): boolean =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as CustomDates).from === 'string' &&
  typeof (v as CustomDates).to === 'string'

/**
 * "Quand ?" for a history list: a short menu of the windows people actually
 * ask about, and two date fields when none of them fits.
 */
export function PeriodFilter({
  period,
  onPeriod,
  custom,
  onCustom,
}: {
  period: HistoryPeriod
  onPeriod: (p: HistoryPeriod) => void
  custom: CustomDates
  onCustom: (c: CustomDates) => void
}) {
  const { t } = useTranslation()
  return (
    <Flex gap={3} wrap="wrap" align="flex-end" flex="1" minW="12rem">
      <Box flex="1" minW="12rem">
        <NativeSelect.Root size="lg">
          <NativeSelect.Field
            value={period}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              onPeriod(e.currentTarget.value as HistoryPeriod)
            }
            aria-label={t('common.period')}
          >
            {HISTORY_PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(LABEL_KEY[p])}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>
      {/* Wide enough for two real date inputs, and wrapping, so the "Au"
          field no longer slides under the neighbouring select at 1024. */}
      {period === 'custom' && (
        <Flex gap={3} flex="1" wrap="wrap" minW={{ base: 'full', sm: '26rem' }}>
          <Field.Root flex="1" minW="11rem">
            <Field.Label>{t('filters.from')}</Field.Label>
            <Input
              size="lg"
              type="date"
              value={custom.from}
              onChange={(e) => onCustom({ ...custom, from: e.target.value })}
            />
          </Field.Root>
          <Field.Root flex="1" minW="11rem">
            <Field.Label>{t('filters.to')}</Field.Label>
            <Input
              size="lg"
              type="date"
              value={custom.to}
              onChange={(e) => onCustom({ ...custom, to: e.target.value })}
            />
          </Field.Root>
        </Flex>
      )}
    </Flex>
  )
}
