import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Card, Flex, Stat, Text } from '@chakra-ui/react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatPercent } from '@/lib/format'

interface DashboardKpiProps {
  label: string
  /** Already formatted — money, a count or a percentage. */
  value: string
  palette: string
  icon: ReactNode
  /**
   * Percentage change against the previous period. `null` means there is no
   * previous figure to compare against, and the delta line is simply hidden
   * rather than shown as a meaningless 0 %.
   */
  growth?: number | null
  /**
   * Which direction is good news. Spending going up is not a win, so the
   * "achats" tile passes `down` and gets the colours the other way round.
   */
  goodWhen?: 'up' | 'down'
}

/**
 * One headline figure: coloured icon chip, plain-French label, the number, and
 * — when we have a comparable previous period — how it moved.
 */
export function DashboardKpi({
  label,
  value,
  palette,
  icon,
  growth,
  goodWhen = 'up',
}: DashboardKpiProps) {
  const { t } = useTranslation()
  // Normalise to `number | null` up front so the JSX below narrows cleanly.
  const delta =
    growth === null || growth === undefined || !Number.isFinite(growth) ? null : growth
  const rising = delta !== null && delta > 0
  const falling = delta !== null && delta < 0
  const good = goodWhen === 'up' ? !falling : !rising

  return (
    <Card.Root>
      <Card.Body>
        <Flex align="center" gap={3}>
          <Box
            colorPalette={palette}
            bg="colorPalette.subtle"
            color="colorPalette.fg"
            p={2}
            borderRadius="lg"
            flexShrink={0}
          >
            {icon}
          </Box>
          {/* minW={0} is required: a flex child defaults to min-width:auto and
              refuses to shrink below its content. A formatted amount like
              "12 500,000 DT" uses no-break spaces, so it has no wrap
              opportunity at all and would push straight out of the card. */}
          <Stat.Root minW={0}>
            <Stat.Label truncate>{label}</Stat.Label>
            <Stat.ValueText fontSize={{ base: 'xl', md: '2xl' }} truncate>
              {value}
            </Stat.ValueText>
            {delta !== null && (
              <Stat.HelpText>
                <Flex align="center" gap={1} wrap="wrap">
                  <Flex
                    align="center"
                    gap={0.5}
                    color={good ? 'green.600' : 'red.600'}
                    fontWeight="semibold"
                  >
                    {rising ? (
                      <ArrowUpRight size={14} />
                    ) : falling ? (
                      <ArrowDownRight size={14} />
                    ) : (
                      <Minus size={14} />
                    )}
                    <Text as="span">{formatPercent(Math.abs(delta))}</Text>
                  </Flex>
                  <Text as="span" color="fg.muted">
                    {t('dashboard.growth')}
                  </Text>
                </Flex>
              </Stat.HelpText>
            )}
          </Stat.Root>
        </Flex>
      </Card.Body>
    </Card.Root>
  )
}
