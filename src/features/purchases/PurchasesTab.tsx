import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Flex,
  Stack,
  SimpleGrid,
  Text,
  Button,
  IconButton,
  Input,
  InputGroup,
  NativeSelect,
  Table,
  Badge,
  Card,
  Stat,
  Spinner,
  Alert,
  EmptyState,
} from '@chakra-ui/react'
import { Plus, Truck, Wallet, Search, Trash2 } from 'lucide-react'
import { formatMoney, moneySymbolKey } from '@/lib/money'
import { formatDate } from '@/lib/format'
import { fold } from '@/lib/textIndex'
import { inSpan, spanOf } from '@/lib/dateRange'
import type { CustomDates, HistoryPeriod } from '@/lib/dateRange'
import { usePaged } from '@/lib/usePaged'
import { Pager } from '@/components/Pager'
import { PeriodFilter } from '@/components/PeriodFilter'
import { useProducts } from '@/features/stock/useProducts'
import { usePurchases, purchaseOwed, purchaseStatus, removePurchase } from './usePurchases'
import type { PurchaseStatus } from './usePurchases'
import { NewPurchase } from './NewPurchase'
import { SettlePurchase } from './SettlePurchase'
import type { Purchase } from '@/types/models'

const ALL = '__all__'

/** `as const` keeps the palettes as literals, which is what colorPalette expects. */
const STATUS_STYLE = {
  paid: { palette: 'green', key: 'purchases.paidFull' },
  partial: { palette: 'orange', key: 'purchases.paidPartial' },
  unpaid: { palette: 'red', key: 'purchases.unpaid' },
} as const satisfies Record<PurchaseStatus, { palette: string; key: string }>

export function PurchasesTab() {
  const { t } = useTranslation()
  const { purchases, loading, error } = usePurchases()
  // Kept warm so removePurchase can tell a deleted article from a live one
  // (isLiveProduct answers from this list, and says "don't know" without it).
  useProducts()

  const [open, setOpen] = useState(false)
  /**
   * The invoice being paid, by id — resolved against the live list, so the
   * dialog's "reste à payer" and its cap follow a payment made on the other
   * machine. A copy taken at the click let the same 1000 be paid twice.
   */
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [supplier, setSupplier] = useState(ALL)
  const [status, setStatus] = useState<PurchaseStatus | typeof ALL>(ALL)
  const [period, setPeriod] = useState<HistoryPeriod>('all')
  const [custom, setCustom] = useState<CustomDates>({ from: '', to: '' })
  const [actionError, setActionError] = useState('')
  const listTop = useRef<HTMLDivElement>(null)
  const settling = settlingId ? (purchases.find((p) => p.id === settlingId) ?? null) : null

  const symbol = t(moneySymbolKey())
  const money = (m: number) => formatMoney(m, { symbol })

  /** Money still owed across every supplier — the number the owner cannot see today. */
  const totalOwed = purchases.reduce((s, p) => s + purchaseOwed(p), 0)
  const totalBought = purchases.reduce((s, p) => s + p.total, 0)

  const supplierNames = useMemo(() => {
    const names = new Set<string>()
    for (const p of purchases) if (p.supplier) names.add(p.supplier)
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [purchases])

  // The table follows the box at low priority, so typing never waits for it.
  const q = fold(useDeferredValue(search))
  const span = spanOf(period, custom)

  /** Supplier, reference and note, folded once per snapshot rather than per letter. */
  const haystack = useMemo(
    () =>
      new Map(
        purchases.map((p) => [
          p.id,
          [fold(p.supplier ?? ''), fold(p.reference ?? ''), fold(p.note ?? '')],
        ]),
      ),
    [purchases],
  )

  const filtered = useMemo(
    () =>
      purchases.filter((p) => {
        if (!inSpan(p.date, span)) return false
        if (status !== ALL && purchaseStatus(p) !== status) return false
        if (supplier !== ALL && (p.supplier ?? '') !== supplier) return false
        if (q === '') return true
        return (haystack.get(p.id) ?? []).some((field) => field.includes(q))
      }),
    // `span` is rebuilt each render; its two bounds are what it means.
    [purchases, span.from, span.to, status, supplier, q, haystack],
  )
  const narrowed = q !== '' || supplier !== ALL || status !== ALL || period !== 'all'
  const paged = usePaged(
    filtered,
    `${q}|${supplier}|${status}|${span.from ?? ''}|${span.to ?? ''}`,
  )
  const filteredTotal = filtered.reduce((s, p) => s + p.total, 0)
  const filteredOwed = filtered.reduce((s, p) => s + purchaseOwed(p), 0)
  const onSettle = useCallback((id: string) => setSettlingId(id), [])
  const resetFilters = () => {
    setSearch('')
    setSupplier(ALL)
    setStatus(ALL)
    setPeriod('all')
    setCustom({ from: '', to: '' })
  }

  /**
   * removePurchase enqueues the stock reversal and the delete and returns, so the
   * row leaves this table on the next local snapshot whether or not there is a
   * line. That matters as much as the old hang did: while the reversal batch was
   * awaited the stock had already been rolled back in the cache, yet the invoice
   * stayed on screen with its Supprimer button, so a second impatient click took
   * the delivery off the shelf again.
   *
   * The catch is still earning its place — shopPath() throws synchronously when no
   * shop is selected — but a write the server refuses is reported by the sync
   * badge in the header, not here.
   */
  const onDelete = useCallback(
    async (p: Purchase) => {
      if (!window.confirm(t('purchases.deleteConfirm'))) return
      setActionError('')
      try {
        await removePurchase(p)
      } catch (e) {
        setActionError(e instanceof Error ? e.message : t('common.error'))
      }
    },
    [t],
  )

  return (
    <Box>
      <Flex justify="flex-end" mb={4}>
        <Button size="xl" colorPalette="brand" onClick={() => setOpen(true)}>
          <Plus size={22} />
          {t('purchases.new')}
        </Button>
      </Flex>

      {/* ---------------- What is still owed ---------------- */}
      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3} mb={5}>
        <Card.Root borderColor={totalOwed > 0 ? 'red.300' : undefined}>
          <Card.Body>
            <Flex align="center" gap={3}>
              <Box
                bg={totalOwed > 0 ? 'red.subtle' : 'brand.subtle'}
                color={totalOwed > 0 ? 'red.fg' : 'brand.fg'}
                p={2}
                borderRadius="lg"
              >
                <Wallet size={22} />
              </Box>
              <Stat.Root>
                <Stat.ValueText color={totalOwed > 0 ? 'red.600' : undefined}>
                  {money(totalOwed)}
                </Stat.ValueText>
                <Stat.Label>{t('purchases.totalOwedSuppliers')}</Stat.Label>
              </Stat.Root>
            </Flex>
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Body>
            <Flex align="center" gap={3}>
              <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                <Truck size={22} />
              </Box>
              <Stat.Root>
                <Stat.ValueText>{money(totalBought)}</Stat.ValueText>
                <Stat.Label>{t('supplier.totalPurchased')}</Stat.Label>
              </Stat.Root>
            </Flex>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* ---------------- Filters ---------------- */}
      <Stack gap={3} mb={4}>
        <InputGroup startElement={<Search size={22} />}>
          <Input
            size="lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('supplier.searchPlaceholder')}
          />
        </InputGroup>
        <Flex gap={3} wrap="wrap">
          <Box flex="1" minW="12rem">
            <NativeSelect.Root size="lg">
              <NativeSelect.Field
                value={supplier}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setSupplier(e.currentTarget.value)
                }
                aria-label={t('purchases.supplier')}
              >
                <option value={ALL}>{t('common.all')}</option>
                {supplierNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Box>
          <Box flex="1" minW="12rem">
            <NativeSelect.Root size="lg">
              <NativeSelect.Field
                value={status}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setStatus(e.currentTarget.value as PurchaseStatus | typeof ALL)
                }
                aria-label={t('purchases.status')}
              >
                <option value={ALL}>{t('filters.paymentAll')}</option>
                <option value="unpaid">{t('purchases.unpaid')}</option>
                <option value="partial">{t('purchases.paidPartial')}</option>
                <option value="paid">{t('purchases.paidFull')}</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Box>
        </Flex>
        <PeriodFilter period={period} onPeriod={setPeriod} custom={custom} onCustom={setCustom} />
      </Stack>

      {/* What the filtered invoices add up to: how much was bought from him this month. */}
      {!loading && !error && purchases.length > 0 && (
        <Flex
          ref={listTop}
          align="center"
          gap={3}
          mb={3}
          wrap="wrap"
          color="fg.muted"
          fontSize="sm"
        >
          <Text>
            {t('purchases.countLabel', { count: filtered.length })}
            {filtered.length > 0 && (
              <>
                {' · '}
                <Text as="span" fontWeight="bold" color="fg">
                  {money(filteredTotal)}
                </Text>
                {filteredOwed > 0 && (
                  <>
                    {' · '}
                    <Text as="span" fontWeight="bold" color="red.600">
                      {t('purchases.owedLabel', { amount: money(filteredOwed) })}
                    </Text>
                  </>
                )}
              </>
            )}
          </Text>
          {narrowed && (
            <Button size="xs" variant="ghost" onClick={resetFilters}>
              {t('filters.clear')}
            </Button>
          )}
        </Flex>
      )}

      {actionError && (
        <Alert.Root status="error" mb={4}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{actionError}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {loading ? (
        <Flex justify="center" align="center" py={16}>
          <Spinner size="xl" colorPalette="brand" />
        </Flex>
      ) : error ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      ) : purchases.length === 0 ? (
        <EmptyState.Root size="lg" py={12}>
          <EmptyState.Content>
            <EmptyState.Indicator color="fg.muted">
              <Truck size={48} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('purchases.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('purchases.emptyHint')}</EmptyState.Description>
            <Button size="xl" colorPalette="brand" mt={2} onClick={() => setOpen(true)}>
              <Plus size={22} />
              {t('purchases.new')}
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : filtered.length === 0 ? (
        <Card.Root>
          <Card.Body>
            <Text color="fg.muted">{t('stock.noResults')}</Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Box overflowX="auto">
          <Table.Root size="lg" striped>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>{t('common.date')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('purchases.supplier')}</Table.ColumnHeader>
                <Table.ColumnHeader display={{ base: 'none', lg: 'table-cell' }}>
                  {t('purchases.reference')}
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">{t('common.total')}</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end" display={{ base: 'none', md: 'table-cell' }}>
                  {t('sales.paid')}
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  {t('purchases.owedToSupplier')}
                </Table.ColumnHeader>
                <Table.ColumnHeader>{t('purchases.status')}</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  {t('common.actions')}
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              <PurchaseRows
                purchases={paged.pageItems}
                symbol={symbol}
                onSettle={onSettle}
                onDelete={onDelete}
              />
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      {!loading && !error && (
        <Pager
          page={paged.page}
          pageCount={paged.pageCount}
          start={paged.start}
          end={paged.end}
          total={paged.total}
          onChange={paged.setPage}
          anchorRef={listTop}
        />
      )}

      {open && <NewPurchase open onClose={() => setOpen(false)} />}
      {settling && (
        <SettlePurchase open purchase={settling} onClose={() => setSettlingId(null)} />
      )}
    </Box>
  )
}

/** One page of invoices, memoized so typing in the search box does not redraw it. */
const PurchaseRows = memo(function PurchaseRows({
  purchases,
  symbol,
  onSettle,
  onDelete,
}: {
  purchases: readonly Purchase[]
  symbol: string
  onSettle: (id: string) => void
  onDelete: (p: Purchase) => void
}) {
  const { t } = useTranslation()
  const money = (m: number) => formatMoney(m, { symbol })
  return (
    <>
      {purchases.map((p) => {
        const owed = purchaseOwed(p)
        const style = STATUS_STYLE[purchaseStatus(p)]
        const itemCount = (p.items ?? []).reduce((n, i) => n + i.qty, 0)
        return (
          <Table.Row key={p.id}>
            <Table.Cell whiteSpace="nowrap">{formatDate(p.date)}</Table.Cell>
            <Table.Cell>
              <Text fontWeight="semibold">{p.supplier || t('common.none')}</Text>
              <Text fontSize="sm" color="fg.muted">
                {itemCount} {t('purchases.items')}
              </Text>
            </Table.Cell>
            <Table.Cell display={{ base: 'none', lg: 'table-cell' }}>
              <Text>{p.reference || '—'}</Text>
              {p.note && (
                <Text fontSize="sm" color="fg.muted" truncate maxW="14rem">
                  {p.note}
                </Text>
              )}
            </Table.Cell>
            <Table.Cell textAlign="end" whiteSpace="nowrap" fontWeight="bold">
              {money(p.total)}
            </Table.Cell>
            <Table.Cell
              textAlign="end"
              whiteSpace="nowrap"
              display={{ base: 'none', md: 'table-cell' }}
            >
              {money(p.paid ?? 0)}
            </Table.Cell>
            <Table.Cell
              textAlign="end"
              whiteSpace="nowrap"
              fontWeight="bold"
              color={owed > 0 ? 'red.600' : 'fg.muted'}
            >
              {money(owed)}
            </Table.Cell>
            <Table.Cell>
              <Badge colorPalette={style.palette} size="lg">
                {t(style.key)}
              </Badge>
            </Table.Cell>
            <Table.Cell textAlign="end">
              <Flex gap={1} justify="flex-end">
                {owed > 0 && (
                  <Button size="lg" colorPalette="brand" onClick={() => onSettle(p.id)}>
                    <Wallet size={20} />
                    {t('purchases.settle')}
                  </Button>
                )}
                <IconButton
                  aria-label={t('common.delete')}
                  title={t('common.delete')}
                  size="lg"
                  variant="outline"
                  colorPalette="red"
                  onClick={() => onDelete(p)}
                >
                  <Trash2 size={20} />
                </IconButton>
              </Flex>
            </Table.Cell>
          </Table.Row>
        )
      })}
    </>
  )
})
