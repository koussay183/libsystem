import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Field, Flex, Input, NativeSelect } from '@chakra-ui/react'
import { HISTORY_PERIODS } from '@/lib/dateRange'
import type { CustomDates, HistoryPeriod } from '@/lib/dateRange'

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
      {period === 'custom' && (
        <Flex gap={3} flex="1" minW="16rem">
          <Field.Root flex="1">
            <Field.Label>{t('filters.from')}</Field.Label>
            <Input
              size="lg"
              type="date"
              value={custom.from}
              onChange={(e) => onCustom({ ...custom, from: e.target.value })}
            />
          </Field.Root>
          <Field.Root flex="1">
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
