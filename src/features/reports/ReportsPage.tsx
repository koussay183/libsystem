import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Flex,
  Heading,
  Text,
  Card,
  Table,
  Stat,
  SimpleGrid,
  Badge,
  NativeSelect,
  EmptyState,
  Spinner,
} from '@chakra-ui/react'
import { TrendingUp, TrendingDown, Wallet, BarChart3, Package } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { formatPercent } from '@/lib/format'
import { useProducts } from '@/features/stock/useProducts'

type SortKey = 'profit' | 'revenue' | 'sold'

interface Row {
  id: string
  name: string
  soldQty: number
  soldRevenue: number
  soldCost: number
  boughtQty: number
  boughtCost: number
  profit: number
  margin: number | null
}

export function ReportsPage() {
  const { t } = useTranslation()
  const { products, loading } = useProducts()
  const [sort, setSort] = useState<SortKey>('profit')

  const symbol = t('money.symbol')
  const money = (m: number) => formatMoney(m, { symbol })

  // Everything below reads the running totals kept on each product, so this
  // page stays instant no matter how many tickets have been rung up.
  const rows: Row[] = products.map((p) => {
    const soldRevenue = p.soldRevenue ?? 0
    const soldCost = p.soldCost ?? 0
    const profit = soldRevenue - soldCost
    return {
      id: p.id,
      name: p.name,
      soldQty: p.soldQty ?? 0,
      soldRevenue,
      soldCost,
      boughtQty: p.boughtQty ?? 0,
      boughtCost: p.boughtCost ?? 0,
      profit,
      margin: soldRevenue > 0 ? (profit / soldRevenue) * 100 : null,
    }
  })

  const sorted = [...rows].sort((a, b) => {
    if (sort === 'revenue') return b.soldRevenue - a.soldRevenue
    if (sort === 'sold') return b.soldQty - a.soldQty
    return b.profit - a.profit
  })

  const totalRevenue = rows.reduce((s, r) => s + r.soldRevenue, 0)
  const totalCost = rows.reduce((s, r) => s + r.soldCost, 0)
  const totalProfit = totalRevenue - totalCost
  const totalBought = rows.reduce((s, r) => s + r.boughtCost, 0)
  const hasSales = rows.some((r) => r.soldQty > 0)

  if (loading) {
    return (
      <Flex justify="center" py={16}>
        <Spinner size="xl" colorPalette="brand" />
      </Flex>
    )
  }

  return (
    <Box>
      <Flex align="center" gap={3} mb={1}>
        <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
          <BarChart3 size={24} />
        </Box>
        <Heading size="2xl">{t('reports.title')}</Heading>
      </Flex>
      <Text color="fg.muted" mb={5}>
        {t('reports.subtitle')}
      </Text>

      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap={3} mb={6}>
        <Kpi
          label={t('reports.totalRevenue')}
          value={money(totalRevenue)}
          palette="green"
          icon={<TrendingUp size={22} />}
        />
        <Kpi
          label={t('reports.totalCost')}
          value={money(totalCost)}
          palette="orange"
          icon={<TrendingDown size={22} />}
        />
        <Kpi
          label={t('reports.totalProfit')}
          value={money(totalProfit)}
          palette={totalProfit >= 0 ? 'brand' : 'red'}
          icon={<Wallet size={22} />}
        />
        <Kpi
          label={t('reports.totalBought')}
          value={money(totalBought)}
          palette="gray"
          icon={<Package size={22} />}
        />
      </SimpleGrid>

      {!hasSales ? (
        <EmptyState.Root size="lg">
          <EmptyState.Content>
            <EmptyState.Indicator>
              <BarChart3 size={48} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('reports.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('reports.emptyHint')}</EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <>
          <Flex align="center" gap={3} mb={3}>
            <Text fontWeight="semibold">{t('reports.sortBy')}</Text>
            <NativeSelect.Root size="md" width="auto">
              <NativeSelect.Field
                value={sort}
                onChange={(e) => setSort(e.currentTarget.value as SortKey)}
              >
                <option value="profit">{t('reports.byProfit')}</option>
                <option value="revenue">{t('reports.byRevenue')}</option>
                <option value="sold">{t('reports.bySold')}</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Flex>

          <Card.Root>
            <Card.Body p={0}>
              <Table.ScrollArea>
                <Table.Root size="lg">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>{t('reports.product')}</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">
                        {t('reports.sold')}
                      </Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">
                        {t('reports.revenue')}
                      </Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">
                        {t('reports.bought')}
                      </Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">
                        {t('reports.cost')}
                      </Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">
                        {t('reports.profit')}
                      </Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">
                        {t('reports.margin')}
                      </Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {sorted.map((r) => {
                      const losing = r.soldQty > 0 && r.profit <= 0
                      return (
                        <Table.Row key={r.id}>
                          <Table.Cell>
                            <Flex align="center" gap={2}>
                              <Text fontWeight="semibold">{r.name}</Text>
                              {losing && (
                                <Badge colorPalette="red" size="sm">
                                  {t('reports.loss')}
                                </Badge>
                              )}
                            </Flex>
                          </Table.Cell>
                          <Table.Cell textAlign="end">
                            {r.soldQty} {t('reports.units')}
                          </Table.Cell>
                          <Table.Cell textAlign="end">{money(r.soldRevenue)}</Table.Cell>
                          <Table.Cell textAlign="end">
                            {r.boughtQty} {t('reports.units')}
                          </Table.Cell>
                          <Table.Cell textAlign="end">{money(r.soldCost)}</Table.Cell>
                          <Table.Cell
                            textAlign="end"
                            fontWeight="bold"
                            color={r.profit >= 0 ? 'green.600' : 'red.600'}
                          >
                            {money(r.profit)}
                          </Table.Cell>
                          <Table.Cell textAlign="end">{formatPercent(r.margin)}</Table.Cell>
                        </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table.Root>
              </Table.ScrollArea>
            </Card.Body>
          </Card.Root>
        </>
      )}
    </Box>
  )
}

function Kpi({
  label,
  value,
  palette,
  icon,
}: {
  label: string
  value: string
  palette: string
  icon: React.ReactNode
}) {
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
          {/* minW={0}: a flex child will not shrink below its content, and a
              formatted amount uses no-break spaces, so it cannot wrap. */}
          <Stat.Root minW={0}>
            <Stat.Label truncate>{label}</Stat.Label>
            <Stat.ValueText fontSize={{ base: "xl", md: "2xl" }} truncate>
              {value}
            </Stat.ValueText>
          </Stat.Root>
        </Flex>
      </Card.Body>
    </Card.Root>
  )
}
