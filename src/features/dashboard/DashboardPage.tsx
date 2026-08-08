import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Badge,
  Box,
  Card,
  EmptyState,
  Flex,
  Heading,
  Progress,
  SegmentGroup,
  SimpleGrid,
  Spinner,
  Stack,
  Stat,
  Table,
  Text,
} from '@chakra-ui/react'
import {
  AlertTriangle,
  Barcode,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coins,
  FileWarning,
  HandCoins,
  Layers,
  PackageX,
  Percent,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Snowflake,
  Tag,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
  Wrench,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { formatMoney } from '@/lib/money'
import { formatDate, formatPercent } from '@/lib/format'
import { useSales } from '@/features/sales/useSales'
import { usePurchases } from '@/features/purchases/usePurchases'
import { useCustomers, useAllCreditEntries } from '@/features/customers/useCustomers'
import { useProducts } from '@/features/stock/useProducts'
import { DashboardKpi } from './DashboardKpi'
import { FixGroupCard } from './FixGroupCard'
import { useDashboardStats } from './useDashboardStats'
import type { FixKind } from './useDashboardStats'
import { PERIODS, axisInterval, salesCapFor } from './periods'
import type { Period } from './periods'

/** Chart colours, matching the app's brand and "sortie" orange. */
const IN_COLOUR = '#287a76'
const OUT_COLOUR = '#d97706'
const GRID_COLOUR = '#e7e5e4'

/** A titled block with an optional one-line explanation underneath. */
function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <Box mb={8}>
      <Flex align="center" gap={2}>
        <Box color="brand.fg" flexShrink={0}>
          {icon}
        </Box>
        <Heading size="lg">{title}</Heading>
      </Flex>
      {hint && (
        <Text color="fg.muted" mt={1}>
          {hint}
        </Text>
      )}
      <Box mt={3}>{children}</Box>
    </Box>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()

  // `now` is frozen alongside the period so every aggregation memo stays
  // stable across renders; picking a period re-reads the clock.
  const [view, setView] = useState<{ period: Period; now: number }>(() => ({
    period: 'month',
    now: Date.now(),
  }))
  const { period, now } = view

  const { sales, loading: salesLoading, error: salesError } = useSales(salesCapFor(period))
  const { purchases, loading: purchasesLoading, error: purchasesError } = usePurchases()
  const { customers, error: customersError } = useCustomers()
  const { entries: creditEntries } = useAllCreditEntries()
  const { products, loading: productsLoading, error: productsError } = useProducts()

  const symbol = t('money.symbol')
  const money = (m: number) => formatMoney(m, { symbol })
  const loading = salesLoading || purchasesLoading || productsLoading
  /** The query returned exactly its limit — older tickets were left behind. */
  const truncated = !salesLoading && sales.length >= salesCapFor(period)
  const error = salesError || purchasesError || customersError || productsError

  const stats = useDashboardStats({
    period,
    now,
    sales,
    purchases,
    products,
    customers,
    creditEntries,
  })

  // On the "Aujourd'hui" view the best day is always today, which tells the
  // owner nothing — the peak hour is the useful figure there.
  const bestDay = period === 'today' ? null : stats.bestDay

  /** Everything the page needs to render one "à corriger" group. */
  const fixMeta: Record<
    FixKind,
    {
      title: string
      hint?: string
      tone: 'red' | 'orange'
      icon: ReactNode
      to: string
      showAmount?: boolean
      countLabel?: (n: number) => string
    }
  > = {
    lossMakers: {
      title: t('dashboard.lossMakers'),
      hint: t('stock.priceBelowCost'),
      tone: 'red',
      icon: <TrendingDown size={22} />,
      to: '/reports',
      showAmount: true,
      countLabel: (n) => t('dashboard.unitsLeft', { count: n }),
    },
    supplierDebt: {
      title: t('dashboard.supplierDebt'),
      hint: t('purchases.owedToSupplier'),
      tone: 'red',
      icon: <FileWarning size={22} />,
      to: '/invoices',
      showAmount: true,
    },
    creditRisk: {
      title: t('dashboard.creditRisk'),
      hint: t('credit.reminderHint'),
      tone: 'red',
      icon: <HandCoins size={22} />,
      to: '/credit',
      showAmount: true,
      countLabel: (n) => t('credit.daysOld', { count: n }),
    },
    outOfStock: {
      title: t('stock.outOfStock'),
      hint: t('pos.outOfStock'),
      tone: 'red',
      icon: <PackageX size={22} />,
      to: '/stock',
    },
    lowStock: {
      title: t('stock.lowStockBadge'),
      hint: t('dashboard.restockHint'),
      tone: 'orange',
      icon: <AlertTriangle size={22} />,
      to: '/stock',
      countLabel: (n) => t('dashboard.unitsLeft', { count: n }),
    },
    noCost: {
      title: t('dashboard.noCost'),
      hint: t('dashboard.noCostHint'),
      tone: 'orange',
      icon: <Coins size={22} />,
      to: '/stock',
      countLabel: (n) => t('dashboard.unitsLeft', { count: n }),
    },
    noBarcode: {
      title: t('dashboard.noBarcode'),
      hint: t('dashboard.noBarcodeHint'),
      tone: 'orange',
      icon: <Barcode size={22} />,
      to: '/stock',
      countLabel: (n) => t('dashboard.unitsLeft', { count: n }),
    },
  }

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
          <Wallet size={24} />
        </Box>
        <Heading size="2xl">{t('dashboard.title')}</Heading>
      </Flex>
      <Text color="fg.muted" mb={5}>
        {t('dashboard.subtitle')}
      </Text>

      {error && (
        <Alert.Root status="error" mb={5}>
          <Alert.Indicator>
            <AlertTriangle size={22} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{t('common.error')}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {/* Hitting the cap means the oldest tickets of the window were not read,
          so every figure below is a floor, not a total. Say so rather than
          quietly presenting a short number as the truth. */}
      {truncated && (
        <Alert.Root status="warning" mb={5}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('common.partialData')}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {stats.empty ? (
        <EmptyState.Root size="lg">
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Wallet size={48} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('dashboard.noData')}</EmptyState.Title>
            <EmptyState.Description>{t('dashboard.noDataHint')}</EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <>
          {/* --- Period selector ------------------------------------------ */}
          <Box mb={5} overflowX="auto">
            <SegmentGroup.Root
              value={period}
              size="lg"
              colorPalette="brand"
              onValueChange={(e) => {
                if (e.value) setView({ period: e.value as Period, now: Date.now() })
              }}
            >
              <SegmentGroup.Indicator />
              {PERIODS.map((p) => (
                <SegmentGroup.Item key={p} value={p}>
                  <SegmentGroup.ItemText>{t(`dashboard.${p}`)}</SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              ))}
            </SegmentGroup.Root>
          </Box>

          {/* --- Headline KPIs -------------------------------------------- */}
          <SimpleGrid mb={8} columns={{ base: 1, sm: 2, lg: 3, '2xl': 6 }} gap={3}>
            <DashboardKpi
              label={t('dashboard.revenue')}
              value={money(stats.current.revenue)}
              palette="green"
              icon={<TrendingUp size={22} />}
              growth={stats.growth.revenue}
            />
            <DashboardKpi
              label={t('dashboard.spending')}
              value={money(stats.current.spending)}
              palette="orange"
              icon={<TrendingDown size={22} />}
              growth={stats.growth.spending}
              goodWhen="down"
            />
            <DashboardKpi
              label={t('dashboard.profit')}
              value={money(stats.current.profit)}
              palette={stats.current.profit >= 0 ? 'brand' : 'red'}
              icon={<Wallet size={22} />}
              growth={stats.growth.profit}
            />
            <DashboardKpi
              label={t('dashboard.avgTicket')}
              value={money(stats.current.avgTicket)}
              palette="blue"
              icon={<ShoppingBag size={22} />}
              growth={stats.growth.avgTicket}
            />
            <DashboardKpi
              label={t('dashboard.ticketsCount')}
              value={String(stats.current.tickets)}
              palette="purple"
              icon={<Receipt size={22} />}
              growth={stats.growth.tickets}
            />
            <DashboardKpi
              label={t('dashboard.marginOverall')}
              value={formatPercent(stats.current.margin)}
              palette="teal"
              icon={<Percent size={22} />}
            />
          </SimpleGrid>

          {/* --- Entrées vs sorties --------------------------------------- */}
          <Card.Root mb={8}>
            <Card.Body>
              <Heading size="md" mb={4}>
                {t('dashboard.in')} / {t('dashboard.out')}
              </Heading>
              {/* dir="ltr": the chart axis always reads left-to-right, even in AR. */}
              <Box dir="ltr">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={stats.chart}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOUR} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12 }}
                      interval={axisInterval(period)}
                    />
                    <YAxis tick={{ fontSize: 12 }} width={44} />
                    <Tooltip
                      formatter={(value) =>
                        `${Number(value).toLocaleString('fr-TN')} ${symbol}`
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="in"
                      name={t('dashboard.in')}
                      fill={IN_COLOUR}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="out"
                      name={t('dashboard.out')}
                      fill={OUT_COLOUR}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Card.Body>
          </Card.Root>

          {/* --- À corriger: the heart of the page ------------------------- */}
          <Section
            icon={<Wrench size={22} />}
            title={t('dashboard.toFix')}
            hint={t('dashboard.toFixHint')}
          >
            {stats.fixGroups.length === 0 ? (
              <Alert.Root status="success">
                <Alert.Indicator>
                  <CheckCircle2 size={24} />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title fontWeight="medium">{t('dashboard.noAlerts')}</Alert.Title>
                </Alert.Content>
              </Alert.Root>
            ) : (
              <Stack gap={3}>
                {stats.fixGroups.map((g) => {
                  const meta = fixMeta[g.kind]
                  return (
                    <FixGroupCard
                      key={g.kind}
                      title={meta.title}
                      hint={meta.hint}
                      tone={meta.tone}
                      icon={meta.icon}
                      to={meta.to}
                      rows={g.rows}
                      total={g.total}
                      showAmount={meta.showAmount}
                      countLabel={meta.countLabel}
                    />
                  )
                })}
              </Stack>
            )}
          </Section>

          {/* --- Vos meilleures ventes ------------------------------------ */}
          <Section
            icon={<Trophy size={22} />}
            title={t('dashboard.bestSellers')}
            hint={t('dashboard.bestSellersHint')}
          >
            {stats.bestSellers.length === 0 ? (
              <Card.Root>
                <Card.Body>
                  <Text fontWeight="semibold">{t('reports.empty')}</Text>
                  <Text color="fg.muted">{t('reports.emptyHint')}</Text>
                </Card.Body>
              </Card.Root>
            ) : (
              <Card.Root>
                <Card.Body p={0}>
                  <Box overflowX="auto">
                    <Table.Root size="md">
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
                            {t('reports.profit')}
                          </Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">
                            {t('reports.margin')}
                          </Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {stats.bestSellers.map((r, idx) => (
                          <Table.Row key={r.id}>
                            <Table.Cell>
                              <Flex align="center" gap={2}>
                                <Badge
                                  colorPalette={idx === 0 ? 'yellow' : 'gray'}
                                  size="sm"
                                >
                                  {idx + 1}
                                </Badge>
                                <Text fontWeight="semibold">{r.name}</Text>
                              </Flex>
                            </Table.Cell>
                            <Table.Cell textAlign="end" whiteSpace="nowrap">
                              {r.soldQty} {t('reports.units')}
                            </Table.Cell>
                            <Table.Cell textAlign="end" whiteSpace="nowrap">
                              {money(r.revenue)}
                            </Table.Cell>
                            <Table.Cell
                              textAlign="end"
                              fontWeight="bold"
                              whiteSpace="nowrap"
                              color={r.profit >= 0 ? 'green.600' : 'red.600'}
                            >
                              {money(r.profit)}
                            </Table.Cell>
                            <Table.Cell textAlign="end" whiteSpace="nowrap">
                              {formatPercent(r.margin)}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                </Card.Body>
              </Card.Root>
            )}
          </Section>

          {/* --- À réapprovisionner --------------------------------------- */}
          {stats.restock.length > 0 && (
            <Section
              icon={<RefreshCw size={22} />}
              title={t('dashboard.restockSuggestions')}
              hint={t('dashboard.restockHint')}
            >
              <Card.Root>
                <Card.Body p={0}>
                  <Box overflowX="auto">
                    <Table.Root size="md">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>{t('reports.product')}</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">
                            {t('stock.inStock')}
                          </Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">
                            {t('reports.sold')}
                          </Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {stats.restock.map((r) => (
                          <Table.Row key={r.id}>
                            <Table.Cell>
                              <Text fontWeight="semibold">{r.name}</Text>
                            </Table.Cell>
                            <Table.Cell textAlign="end" whiteSpace="nowrap">
                              <Badge colorPalette={r.quantity <= 0 ? 'red' : 'orange'}>
                                {r.quantity <= 0
                                  ? t('stock.outOfStock')
                                  : t('dashboard.unitsLeft', { count: r.quantity })}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell textAlign="end" whiteSpace="nowrap">
                              {r.soldQty} {t('reports.units')}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                </Card.Body>
              </Card.Root>
            </Section>
          )}

          {/* --- Ce qui ne se vend pas ------------------------------------ */}
          {stats.deadStock.length > 0 && (
            <Section
              icon={<Snowflake size={22} />}
              title={t('dashboard.worstSellers')}
              hint={t('dashboard.deadStockHint')}
            >
              <Card.Root mb={3} bg="orange.subtle" borderColor="orange.muted">
                <Card.Body>
                  <Stat.Root>
                    <Stat.Label>{t('dashboard.cashLocked')}</Stat.Label>
                    <Stat.ValueText fontSize="2xl">
                      {money(stats.cashLocked)}
                    </Stat.ValueText>
                    <Stat.HelpText>{t('dashboard.worstSellersHint')}</Stat.HelpText>
                  </Stat.Root>
                </Card.Body>
              </Card.Root>

              <Card.Root>
                <Card.Body p={0}>
                  <Box overflowX="auto">
                    <Table.Root size="md">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>{t('reports.product')}</Table.ColumnHeader>
                          <Table.ColumnHeader>
                            {t('dashboard.deadStock')}
                          </Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">
                            {t('stock.inStock')}
                          </Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">
                            {t('common.total')}
                          </Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {stats.deadStock.slice(0, 15).map((r) => (
                          <Table.Row key={r.id}>
                            <Table.Cell>
                              <Text fontWeight="semibold">{r.name}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Badge colorPalette={r.neverSold ? 'red' : 'orange'}>
                                {r.neverSold
                                  ? t('dashboard.neverSold')
                                  : t('dashboard.notSoldSince', { count: r.days })}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell textAlign="end" whiteSpace="nowrap">
                              {r.quantity} {t('reports.units')}
                            </Table.Cell>
                            <Table.Cell
                              textAlign="end"
                              fontWeight="semibold"
                              whiteSpace="nowrap"
                            >
                              {money(r.frozen)}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                  {stats.deadStock.length > 15 && (
                    <Text p={3} fontSize="sm" color="fg.muted">
                      15 {t('common.of')} {stats.deadStock.length}
                    </Text>
                  )}
                </Card.Body>
              </Card.Root>
            </Section>
          )}

          {/* --- Catégories + meilleurs moments ---------------------------- */}
          {(stats.categories.length > 0 || bestDay || stats.bestHour) && (
            <Section icon={<Layers size={22} />} title={t('dashboard.topCategories')}>
              <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4} alignItems="start">
                {stats.categories.length > 0 && (
                  <Card.Root>
                    <Card.Body>
                      <Stack gap={4}>
                        {stats.categories.map((c) => (
                          <Box key={c.name ?? '__none__'}>
                            <Flex align="center" gap={2} mb={1} wrap="wrap">
                              <Tag size={16} />
                              <Text fontWeight="semibold" flex="1" minW="6rem">
                                {c.name ?? t('common.none')}
                              </Text>
                              <Text whiteSpace="nowrap">{money(c.revenue)}</Text>
                              <Text
                                whiteSpace="nowrap"
                                color={c.profit >= 0 ? 'green.600' : 'red.600'}
                                fontWeight="semibold"
                              >
                                {money(c.profit)}
                              </Text>
                            </Flex>
                            <Progress.Root
                              value={c.share}
                              max={100}
                              size="sm"
                              colorPalette="brand"
                            >
                              <Progress.Track>
                                <Progress.Range />
                              </Progress.Track>
                            </Progress.Root>
                          </Box>
                        ))}
                      </Stack>
                    </Card.Body>
                  </Card.Root>
                )}

                {(bestDay || stats.bestHour) && (
                  <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                    {bestDay && (
                      <DashboardKpi
                        label={t('dashboard.bestDay')}
                        value={formatDate(bestDay.value)}
                        palette="green"
                        icon={<CalendarDays size={22} />}
                      />
                    )}
                    {stats.bestHour && (
                      <DashboardKpi
                        label={t('dashboard.bestHour')}
                        value={`${String(stats.bestHour.value).padStart(2, '0')}h`}
                        palette="blue"
                        icon={<Clock size={22} />}
                      />
                    )}
                  </SimpleGrid>
                )}
              </SimpleGrid>
            </Section>
          )}
        </>
      )}
    </Box>
  )
}
