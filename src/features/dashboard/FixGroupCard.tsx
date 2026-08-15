import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Card,
  Collapsible,
  Flex,
  Table,
  Text,
} from '@chakra-ui/react'
import { ChevronDown, Wrench } from 'lucide-react'
import { formatMoney, moneySymbolKey } from '@/lib/money'
import { FIX_ROWS_SHOWN } from './useDashboardStats'
import type { FixRow } from './useDashboardStats'

interface FixGroupCardProps {
  /** What is wrong, in plain French. */
  title: string
  /** Why it costs money / what it blocks. */
  hint?: string
  tone: 'red' | 'orange'
  icon: ReactNode
  /** The page that actually fixes this. */
  to: string
  rows: FixRow[]
  /** Sum of the row amounts, millimes. Ignored unless `showAmount`. */
  total: number
  /** Whether this group carries a money figure at all. */
  showAmount?: boolean
  /** Renders the per-row secondary figure (units left, days late…). */
  countLabel?: (count: number) => string
}

/**
 * One problem group. Collapsed it is a single line — what is wrong, how many,
 * what it costs, and the button that goes and fixes it. Expanded it lists the
 * offenders, capped so a shop with 200 unpriced products does not produce a
 * 200-row wall.
 */
export function FixGroupCard({
  title,
  hint,
  tone,
  icon,
  to,
  rows,
  total,
  showAmount = false,
  countLabel,
}: FixGroupCardProps) {
  const { t } = useTranslation()
  const symbol = t(moneySymbolKey())
  const shown = rows.slice(0, FIX_ROWS_SHOWN)
  const truncated = rows.length > shown.length

  return (
    <Collapsible.Root>
      <Card.Root borderColor={`${tone}.muted`}>
        <Card.Body>
          <Flex align="center" gap={3} wrap="wrap">
            <Box
              colorPalette={tone}
              bg="colorPalette.subtle"
              color="colorPalette.fg"
              p={2}
              borderRadius="lg"
              flexShrink={0}
            >
              {icon}
            </Box>

            <Box flex="1" minW="10rem">
              <Flex align="center" gap={2} wrap="wrap">
                <Text fontWeight="semibold">{title}</Text>
                <Badge colorPalette={tone} size="lg">
                  {rows.length}
                </Badge>
              </Flex>
              {hint && (
                <Text fontSize="sm" color="fg.muted">
                  {hint}
                </Text>
              )}
            </Box>

            {showAmount && (
              <Text
                fontSize="lg"
                fontWeight="bold"
                color={total < 0 ? 'red.600' : 'fg'}
                whiteSpace="nowrap"
              >
                {formatMoney(total, { symbol })}
              </Text>
            )}

            <Collapsible.Trigger asChild>
              <Button size="sm" variant="outline">
                {t('dashboard.viewAll')}
                <ChevronDown size={16} />
              </Button>
            </Collapsible.Trigger>

            <Button asChild size="sm" colorPalette="brand">
              <RouterLink to={to}>
                <Wrench size={16} />
                {t('dashboard.fixNow')}
              </RouterLink>
            </Button>
          </Flex>

          <Collapsible.Content>
            <Box mt={4} overflowX="auto">
              <Table.Root size="sm" variant="outline">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>{t('common.name')}</Table.ColumnHeader>
                    {countLabel && <Table.ColumnHeader textAlign="end" />}
                    {showAmount && (
                      <Table.ColumnHeader textAlign="end">
                        {t('common.total')}
                      </Table.ColumnHeader>
                    )}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {shown.map((r) => (
                    <Table.Row key={r.id}>
                      <Table.Cell>
                        <Text fontWeight="medium">{r.name || t('common.none')}</Text>
                      </Table.Cell>
                      {countLabel && (
                        <Table.Cell textAlign="end" color="fg.muted" whiteSpace="nowrap">
                          {r.count === null ? '—' : countLabel(r.count)}
                        </Table.Cell>
                      )}
                      {showAmount && (
                        <Table.Cell
                          textAlign="end"
                          fontWeight="semibold"
                          whiteSpace="nowrap"
                          color={(r.amount ?? 0) < 0 ? 'red.600' : 'fg'}
                        >
                          {formatMoney(r.amount ?? 0, { symbol })}
                        </Table.Cell>
                      )}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
            {truncated && (
              <Text mt={2} fontSize="sm" color="fg.muted">
                {shown.length} {t('common.of')} {rows.length}
              </Text>
            )}
          </Collapsible.Content>
        </Card.Body>
      </Card.Root>
    </Collapsible.Root>
  )
}
