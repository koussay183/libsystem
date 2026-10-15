import { memo, useDeferredValue, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Flex,
  Heading,
  Text,
  Card,
  Table,
  Stat,
  SimpleGrid,
  Badge,
  Button,
  NativeSelect,
  EmptyState,
  Spinner,
  Switch,
} from '@chakra-ui/react'
import { TrendingUp, TrendingDown, Wallet, BarChart3, Package, RotateCcw } from 'lucide-react'
import { formatMoney, moneySymbolKey } from '@/lib/money'
import { formatPercent } from '@/lib/format'
import { fold, foldedOf } from '@/lib/textIndex'
import { usePaged } from '@/lib/usePaged'
import { Pager } from '@/components/Pager'
import { SearchInput } from '@/components/SearchInput'
import { ActiveFilters } from '@/components/ActiveFilters'
import { oneOf, useSessionState } from '@/lib/useSessionState'
import { useProducts } from '@/features/stock/useProducts'

type SortKey = 'profit' | 'revenue' | 'sold'

interface Row {
  id: string
  name: string
  category: string
  soldQty: number
  soldRevenue: number
  soldCost: number
  /** Sold, but with no purchase price behind it. @see rows */
  uncosted: boolean
  boughtQty: number
  boughtCost: number
  profit: number
  margin: number | null
  /** The name folded for search. */
  folded: string
  /** Matched exactly by a scan or a typed code. */
  barcode: string
}

export function ReportsPage() {
  const { t } = useTranslation()
  const { products, loading, error } = useProducts()
  const [sort, setSort] = useSessionState<SortKey>(
    'reports.sort',
    'profit',
    oneOf(['profit', 'revenue', 'sold']),
  )
  const [search, setSearch] = useState('')
  const [category, setCategory] = useSessionState('reports.category', '')
  const [onlySold, setOnlySold] = useSessionState('reports.onlySold', true)
  const listTop = useRef<HTMLDivElement>(null)

  const symbol = t(moneySymbolKey())
  const money = (m: number) => formatMoney(m, { symbol })

  // Everything below reads the running totals kept on each product, so this
  // page stays instant no matter how many tickets have been rung up. Built once
  // per snapshot: it used to be rebuilt, re-folded and re-sorted per letter.
  const rows: Row[] = useMemo(() => products.map((p) => {
    const soldRevenue = p.soldRevenue ?? 0
    const soldCost = p.soldCost ?? 0
    const profit = soldRevenue - soldCost
    /*
      AN ARTICLE WITH NO PURCHASE PRICE IS NOT AN ARTICLE THAT COST NOTHING.

      The till's quick-create dialog lets the cashier save a scanned book with
      the cost field blank, because a queue at the counter beats a correct
      margin — and it writes costPrice 0. Every unit sold then adds 0 to
      soldCost, so this page reported those articles as 100 % profit for ever,
      and they sorted straight to the top of "les plus rentables". The owner was
      being told his best-performing stock was whichever articles nobody had
      taken the time to cost.

      A bookshop does not sell anything for nothing, so revenue with no cost
      behind it means "not costed yet", not "free". Say that instead of a
      number: an honest blank sends him to the article to fill the price in,
      where a confident 100 % never would.
    */
    const uncosted = (p.soldQty ?? 0) > 0 && soldCost === 0 && soldRevenue > 0
    return {
      id: p.id,
      name: p.name,
      category: p.category ?? '',
      soldQty: p.soldQty ?? 0,
      soldRevenue,
      soldCost,
      boughtQty: p.boughtQty ?? 0,
      boughtCost: p.boughtCost ?? 0,
      profit,
      uncosted,
      margin: uncosted || soldRevenue <= 0 ? null : (profit / soldRevenue) * 100,
      // From the shared fold cache, so this is a lookup for an unchanged article.
      folded: foldedOf(p).name,
      barcode: p.barcode ?? '',
    }
  }), [products])

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category ?? ''))].sort((a, b) => a.localeCompare(b)),
    [products],
  )

  // The table follows the box at low priority, so typing never waits for it.
  const deferred = useDeferredValue(search)
  const q = fold(deferred)
  // The box says "Scanner ou taper un code": a scanned barcode must find its
  // article, not only a name.
  const code = deferred.trim()
  const sorted = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (!onlySold || r.soldQty !== 0) &&
            (category === '' || r.category === category) &&
            (q === '' || r.folded.includes(q) || (code !== '' && r.barcode === code)),
        )
        .sort((a, b) => {
          if (sort === 'revenue') return b.soldRevenue - a.soldRevenue
          if (sort === 'sold') return b.soldQty - a.soldQty
          // An uncosted article's "profit" is its whole revenue, so ranked by that
          // number it went straight to the top of "les plus rentables" — the very
          // thing the comment above says must not happen. It sinks below every
          // article whose profit is real, still visible, with its orange badge.
          if (a.uncosted !== b.uncosted) return a.uncosted ? 1 : -1
          return b.profit - a.profit
        }),
    [rows, onlySold, category, q, code, sort],
  )
  const paged = usePaged(sorted, `${sort}|${q}|${category}|${onlySold}`, { persist: 'reports' })
  const resetFilters = () => {
    setSearch('')
    setCategory('')
    setOnlySold(true)
  }
  const activeFilters =
    category === ''
      ? []
      : [
          {
            key: 'category',
            label: t('smart.filterChip', {
              name: t('filters.category'),
              value: category || t('filters.categoryNone'),
            }),
            onRemove: () => setCategory(''),
          },
        ]

  const { totalRevenue, totalCost, totalBought, totalProfit, uncostedRevenue, hasSales } =
    useMemo(() => {
      let totalRevenue = 0
      let totalCost = 0
      let totalBought = 0
      let totalProfit = 0
      let uncostedRevenue = 0
      let hasSales = false
      for (const r of rows) {
        totalRevenue += r.soldRevenue
        totalCost += r.soldCost
        totalBought += r.boughtCost
        // Same rule as the rows: an uncosted article's revenue is not profit.
        // Summed in, the headline said the opposite of the badge below it.
        if (r.uncosted) uncostedRevenue += r.soldRevenue
        else totalProfit += r.profit
        if (r.soldQty > 0) hasSales = true
      }
      return { totalRevenue, totalCost, totalBought, totalProfit, uncostedRevenue, hasSales }
    }, [rows])

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
        <Box bg="pink.subtle" color="pink.fg" p={2} borderRadius="lg">
          <BarChart3 size={24} />
        </Box>
        <Heading size="2xl">{t('reports.title')}</Heading>
      </Flex>
      <Text color="fg.muted" mb={1}>
        {t('reports.subtitle')}
      </Text>
      {/* These are lifetime counters; Argent's figures are per period. Said
          here so the two screens do not look like they disagree. */}
      <Text color="fg.muted" fontSize="sm" mb={5}>
        {t('platformFix.reportsLifetime')}{' '}
        <RouterLink to="/dashboard" style={{ textDecoration: 'underline' }}>
          {t('platformFix.reportsSeePeriod')}
        </RouterLink>
      </Text>

      <SimpleGrid columns={{ base: 1, sm: 2, '2xl': 4 }} gap={3} mb={6}>
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
          note={
            uncostedRevenue > 0
              ? t('platformFix.profitExcludes', { amount: money(uncostedRevenue) })
              : undefined
          }
        />
        <Kpi
          label={t('reports.totalBought')}
          value={money(totalBought)}
          palette="gray"
          icon={<Package size={22} />}
        />
      </SimpleGrid>

      {/* Telling him the shop sold nothing when in fact nothing LOADED is the
          one thing this page must never do. */}
      {error ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('common.error')}</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      ) : !hasSales ? (
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
          <Flex gap={3} mb={3} wrap="wrap" align="center" ref={listTop}>
            <Box flex="2" minW="14rem">
              <SearchInput
                shortcut
                value={search}
                onChange={setSearch}
                count={q !== '' ? sorted.length : undefined}
                placeholder={t('stock.searchPlaceholder')}
              />
            </Box>
            <NativeSelect.Root size="lg" flex="1" minW="11rem">
              <NativeSelect.Field
                value={category}
                onChange={(e) => setCategory(e.currentTarget.value)}
                aria-label={t('filters.category')}
              >
                <option value="">{t('filters.categoryAll')}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c || t('filters.categoryNone')}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <NativeSelect.Root size="lg" flex="1" minW="11rem">
              <NativeSelect.Field
                value={sort}
                onChange={(e) => setSort(e.currentTarget.value as SortKey)}
                aria-label={t('reports.sortBy')}
              >
                <option value="profit">{t('reports.byProfit')}</option>
                <option value="revenue">{t('reports.byRevenue')}</option>
                <option value="sold">{t('reports.bySold')}</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Switch.Root
              size="lg"
              colorPalette="brand"
              checked={onlySold}
              onCheckedChange={(e) => setOnlySold(e.checked)}
            >
              <Switch.HiddenInput />
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label>{t('filters.onlySold')}</Switch.Label>
            </Switch.Root>
          </Flex>
          <ActiveFilters filters={activeFilters} onReset={resetFilters} />

          <Card.Root>
            <Card.Body p={0}>
              <Table.ScrollArea>
                {/* Acheté and Coût des ventes give way below 2xl, so Bénéfice
                    is not cut off at 1366 and 1024. */}
                <Table.Root size={{ base: 'md', '2xl': 'lg' }}>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>{t('reports.product')}</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">
                        {t('reports.sold')}
                      </Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">
                        {t('reports.revenue')}
                      </Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end" hideBelow="2xl">
                        {t('reports.bought')}
                      </Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end" hideBelow="2xl">
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
                    {paged.pageItems.length === 0 && (
                      <Table.Row>
                        <Table.Cell colSpan={7}>
                          <Flex align="center" gap={3} wrap="wrap">
                            <Text color="fg.muted">
                              {q !== ''
                                ? t('smart.noMatchFor', { term: search.trim() })
                                : t('stock.noResults')}
                            </Text>
                            <Button size="sm" variant="outline" onClick={resetFilters}>
                              <RotateCcw size={14} />
                              {t('smart.showAll')}
                            </Button>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    )}
                    <ReportRows rows={paged.pageItems} symbol={symbol} />
                  </Table.Body>
                </Table.Root>
              </Table.ScrollArea>
            </Card.Body>
          </Card.Root>
          <Pager
            page={paged.page}
            pageCount={paged.pageCount}
            start={paged.start}
            end={paged.end}
            total={paged.total}
            onChange={paged.setPage}
            anchorRef={listTop}
          />
        </>
      )}
    </Box>
  )
}

/** One page of the table, memoized so typing in the search box does not redraw it. */
const ReportRows = memo(function ReportRows({
  rows,
  symbol,
}: {
  rows: readonly Row[]
  symbol: string
}) {
  const { t } = useTranslation()
  const money = (m: number) => formatMoney(m, { symbol })
  // No empty-state row here: the page renders the one with "Tout afficher".
  return (
    <>
      {rows.map((r) => {
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
            <Table.Cell textAlign="end" hideBelow="2xl">
              {r.boughtQty} {t('reports.units')}
            </Table.Cell>
            <Table.Cell textAlign="end" hideBelow="2xl">
              {r.uncosted ? '—' : money(r.soldCost)}
            </Table.Cell>
            <Table.Cell
              textAlign="end"
              fontWeight="bold"
              // A profit computed against no cost is not a profit, so it is
              // not painted as one.
              color={r.uncosted ? 'fg.muted' : r.profit >= 0 ? 'green.fg' : 'red.fg'}
            >
              {/* Its revenue is not a profit; the badge says why (hidden with
                  the cost column below 2xl, so it is repeated here). */}
              {r.uncosted ? (
                <Badge colorPalette="orange" size="sm" title={t('reports.uncostedHint')}>
                  {t('reports.uncosted')}
                </Badge>
              ) : (
                money(r.profit)
              )}
            </Table.Cell>
            <Table.Cell textAlign="end" title={r.uncosted ? t('reports.uncostedHint') : undefined}>
              {r.uncosted ? '—' : formatPercent(r.margin)}
            </Table.Cell>
          </Table.Row>
        )
      })}
    </>
  )
})

function Kpi({
  label,
  value,
  palette,
  icon,
  note,
}: {
  label: string
  value: string
  palette: string
  icon: ReactNode
  /** A caveat under the figure. */
  note?: string
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
            {/* Not truncated: "1 106,800 DT" cut to "1106,800 D" is a wrong
                number, not a shorter one. The grid gives it room instead. */}
            <Stat.ValueText fontSize={{ base: 'xl', md: '2xl' }} whiteSpace="nowrap">
              {value}
            </Stat.ValueText>
            {note && (
              <Text fontSize="xs" color="orange.fg">
                {note}
              </Text>
            )}
          </Stat.Root>
        </Flex>
      </Card.Body>
    </Card.Root>
  )
}
