import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Card,
  Badge,
  Button,
  Dialog,
  Portal,
  Flex,
  HStack,
  NativeSelect,
  Stack,
  Text,
  Spinner,
  Alert,
  EmptyState,
} from '@chakra-ui/react'
import {
  ShoppingCart,
  Receipt,
  Printer,
  FileText,
  Plus,
  Pencil,
  HandCoins,
  History,
} from 'lucide-react'
import { formatMoney, moneySymbolKey } from '@/lib/money'
import { formatDateTime } from '@/lib/format'
import { fold } from '@/lib/textIndex'
import { HISTORY_PERIODS, spanOf } from '@/lib/dateRange'
import type { CustomDates, HistoryPeriod } from '@/lib/dateRange'
import { usePaged } from '@/lib/usePaged'
import { Pager } from '@/components/Pager'
import { PeriodFilter, isCustomDates, periodChip } from '@/components/PeriodFilter'
import { SearchInput } from '@/components/SearchInput'
import { ActiveFilters, NoResults } from '@/components/ActiveFilters'
import { oneOf, useSessionState } from '@/lib/useSessionState'
import { useSalesHistory, useSalesCount } from './useSales'
import { NewSaleInvoice } from './NewSaleInvoice'
import { SaleEditor } from './SaleEditor'
import { useCustomers } from '@/features/customers/useCustomers'
import { useShopSettings } from '@/features/settings/useShopSettings'
import { Ticket } from '@/features/pos/Ticket'
import type { TicketData } from '@/features/pos/Ticket'
import type { Sale } from '@/types/models'

type KindFilter = 'all' | 'ticket' | 'invoice'
type StatusFilter = 'all' | 'paid' | 'credit' | 'partial' | 'return'

/**
 * How many tickets are read from the server at a time, and how much further
 * each step back reaches. 500 is what this tab always read; the difference is
 * that it is now a step, not a wall.
 */
const HISTORY_STEP = 500

/**
 * How a ticket was settled, decided exactly the way its badge is drawn, so
 * the "Crédit" filter and the orange badge can never disagree about a row.
 */
function statusOf(s: Sale): 'paid' | 'credit' | 'partial' {
  if (s.mode === 'partial') return 'partial'
  return s.onCredit ? 'credit' : 'paid'
}

/** The stored name wins: it still reads correctly if the client was deleted. */
function clientName(s: Sale, nameById: Map<string, string>): string | undefined {
  return s.customerName ?? (s.customerId ? nameById.get(s.customerId) : undefined) ?? undefined
}

export function SalesTab() {
  const { t } = useTranslation()
  const { customers } = useCustomers()
  const { shop } = useShopSettings()

  const [search, setSearch] = useState('')
  // Kept for the tab, so a ticket opened and closed does not lose the filters.
  const [period, setPeriod] = useSessionState<HistoryPeriod>(
    'sales.period',
    'all',
    oneOf(HISTORY_PERIODS),
  )
  const [custom, setCustom] = useSessionState<CustomDates>(
    'sales.custom',
    { from: '', to: '' },
    isCustomDates,
  )
  const [kind, setKind] = useSessionState<KindFilter>(
    'sales.kind',
    'all',
    oneOf(['all', 'ticket', 'invoice']),
  )
  const [status, setStatus] = useSessionState<StatusFilter>(
    'sales.status',
    'all',
    oneOf(['all', 'paid', 'credit', 'partial', 'return']),
  )
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const listTop = useRef<HTMLDivElement>(null)

  const span = spanOf(period, custom)
  const rangeKey = `${span.from ?? ''}|${span.to ?? ''}`

  /**
   * How far back this range has been read. Keyed on the range so a new period
   * starts again from one step — the same derive-in-render reset usePaged uses,
   * so a period switch never fires one oversized query on the way.
   */
  const [reach, setReach] = useState({ rangeKey, max: HISTORY_STEP })
  const max = reach.rangeKey === rangeKey ? reach.max : HISTORY_STEP
  const reachTo = (rows: number) =>
    setReach({ rangeKey, max: Math.max(max, Math.ceil(rows / HISTORY_STEP) * HISTORY_STEP) })

  const { sales, loading, loadingMore, complete, error } = useSalesHistory(
    span.from,
    span.to,
    max,
  )
  const serverCount = useSalesCount(span.from, span.to, `${sales[0]?.id ?? ''}|${sales.length}`)

  /**
   * THE PREVIEW FOLLOWS THE SALE, NOT A SNAPSHOT OF IT.
   *
   * It used to hold a TicketData built once on click. That dropped the sale's
   * id and client, so nothing could be edited from here — and after an edit
   * the preview would have gone on showing the old lines while the list
   * behind it showed the new ones. Holding the id and resolving it against
   * the live list on every render means the preview, and the reprint, are
   * always the ticket as it is now.
   *
   * `justRecorded` is the one case with no id in the list yet: a facture the
   * owner has just saved, whose snapshot may be a beat behind.
   */
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [justRecorded, setJustRecorded] = useState<TicketData | null>(null)
  /**
   * The ticket being corrected, by id, for the same reason as the preview: the
   * editor computes the stock and carnet corrections against the ticket it is
   * handed, so it must be handed the ticket as it is NOW. A copy taken at the
   * click would, after the other till corrected the same ticket, undo that
   * correction's counters while keeping its lines.
   */
  const [editing, setEditing] = useState<{ sale: Sale; intent: 'edit' | 'toCredit' } | null>(null)
  const [paper, setPaper] = useState<'thermal' | 'a4'>('thermal')

  const symbol = t(moneySymbolKey())
  const money = (m: number) => formatMoney(m, { symbol })

  const nameById = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers])
  /** The stored name wins: it still reads correctly if the client was deleted. */
  const clientOf = (s: Sale) => clientName(s, nameById)

  // The list follows the box at low priority, so typing never waits for it.
  const q = fold(useDeferredValue(search))
  const narrowed = q !== '' || kind !== 'all' || status !== 'all'

  /** Ticket number and client, folded once per snapshot rather than per letter. */
  const haystack = useMemo(
    () =>
      new Map(
        sales.map((s) => [s.id, [fold(s.ticketNo), fold(clientName(s, nameById) ?? '')]] as const),
      ),
    [sales, nameById],
  )

  const filtered = useMemo(() => {
    if (!narrowed) return sales
    return sales.filter((s) => {
      if (kind === 'invoice' && s.kind !== 'invoice') return false
      if (kind === 'ticket' && s.kind === 'invoice') return false
      if (status === 'return' ? !s.hasReturn : status !== 'all' && statusOf(s) !== status) {
        return false
      }
      if (q === '') return true
      const [ticketNo, client] = haystack.get(s.id) ?? ['', '']
      return ticketNo.includes(q) || client.includes(q)
    })
  }, [sales, narrowed, kind, status, q, haystack])

  /**
   * Unfiltered, the pages are counted from what the SERVER holds for the
   * period, so the last page really is the oldest ticket and every page in
   * between can be reached; turning to one that is not loaded yet reads further
   * back. Filtered, they are counted from what matched in what has been read,
   * and the "search further back" button below says that is what it is.
   */
  const knownTotal = !narrowed && !complete ? serverCount : null
  const paged = usePaged(filtered, `${rangeKey}|${q}|${kind}|${status}`, { total: knownTotal })
  const pageShort = paged.pageItems.length < paged.end - paged.start
  const goToPage = (page: number) => {
    paged.setPage(page)
    if (!narrowed && !complete) reachTo(page * paged.pageSize)
  }

  /** Money on the tickets shown — only once the whole period is in hand. */
  const filteredTotal = complete ? filtered.reduce((sum, s) => sum + s.total, 0) : null
  const shownCount = narrowed || complete ? filtered.length : (serverCount ?? sales.length)

  /** A stored sale, rebuilt into what the printable ticket expects. */
  const toTicket = (s: Sale): TicketData => ({
    ticketNo: s.ticketNo,
    date: s.date,
    lines: s.items.map((it, idx) => ({
      // Free lines have no productId, and one product can appear twice (a sale
      // line and a return line), so the index keeps the line key unique.
      id: `${s.id}-${idx}`,
      productId: it.productId,
      barcode: null,
      name: it.name,
      qty: it.qty,
      unitPrice: it.unitPrice,
      unitCost: it.unitCost,
      stock: 0,
    })),
    // Older tickets predate these fields; fall back so reprints stay correct.
    subtotal: s.subtotal ?? s.total,
    discount: s.discount ?? 0,
    total: s.total,
    paid: s.paid,
    received: s.received ?? s.paid,
    mode: s.mode,
    clientName: clientOf(s),
  })

  const previewSale = previewId ? (sales.find((s) => s.id === previewId) ?? null) : null
  const preview: TicketData | null = previewSale ? toTicket(previewSale) : justRecorded
  const openPreview = useCallback((id: string) => {
    setJustRecorded(null)
    setPreviewId(id)
  }, [])
  const closePreview = () => {
    setPreviewId(null)
    setJustRecorded(null)
  }
  const editingSale = editing
    ? (sales.find((s) => s.id === editing.sale.id) ?? editing.sale)
    : null

  const doPrint = (which: 'thermal' | 'a4') => {
    setPaper(which)
    // Let the paper class land on #print-area before the print dialog opens.
    setTimeout(() => window.print(), 50)
  }

  const resetFilters = () => {
    setSearch('')
    setPeriod('all')
    setCustom({ from: '', to: '' })
    setKind('all')
    setStatus('all')
  }
  const neverSold = !loading && !error && sales.length === 0 && period === 'all' && !narrowed

  const KIND_LABEL: Record<KindFilter, string> = {
    all: t('filters.kindAll'),
    ticket: t('filters.kindTicket'),
    invoice: t('filters.kindInvoice'),
  }
  const STATUS_LABEL: Record<StatusFilter, string> = {
    all: t('filters.paymentAll'),
    paid: t('sales.paid'),
    credit: t('sales.credit'),
    partial: t('pos.partial'),
    return: t('filters.withReturn'),
  }
  const activeFilters = [
    ...periodChip(t, period, custom, () => setPeriod('all')),
    ...(kind !== 'all'
      ? [{ key: 'kind', label: KIND_LABEL[kind], onRemove: () => setKind('all') }]
      : []),
    ...(status !== 'all'
      ? [{ key: 'status', label: STATUS_LABEL[status], onRemove: () => setStatus('all') }]
      : []),
  ]

  return (
    <Box>
      <Flex justify="flex-end" gap={3} mb={4} wrap="wrap">
        <Button size="xl" variant="outline" colorPalette="brand" onClick={() => setInvoiceOpen(true)}>
          <Plus size={22} />
          {t('sales.newInvoice')}
        </Button>
        <Button asChild size="xl" colorPalette="brand">
          <RouterLink to="/caisse">
            <ShoppingCart size={22} />
            {t('pos.title')}
          </RouterLink>
        </Button>
      </Flex>

      {/* ---------------- Find a ticket ---------------- */}
      <Stack gap={3} mb={4}>
        <SearchInput
          shortcut
          value={search}
          onChange={setSearch}
          placeholder={t('sales.searchTicket')}
        />
        <Flex gap={3} wrap="wrap" align="flex-end">
          <PeriodFilter
            period={period}
            onPeriod={setPeriod}
            custom={custom}
            onCustom={setCustom}
          />
          <Box flex="1" minW="11rem">
            <NativeSelect.Root size="lg">
              <NativeSelect.Field
                value={kind}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setKind(e.currentTarget.value as KindFilter)
                }
                aria-label={t('filters.kind')}
              >
                <option value="all">{t('filters.kindAll')}</option>
                <option value="ticket">{t('filters.kindTicket')}</option>
                <option value="invoice">{t('filters.kindInvoice')}</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Box>
          <Box flex="1" minW="11rem">
            <NativeSelect.Root size="lg">
              <NativeSelect.Field
                value={status}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setStatus(e.currentTarget.value as StatusFilter)
                }
                aria-label={t('filters.payment')}
              >
                <option value="all">{t('filters.paymentAll')}</option>
                <option value="paid">{t('sales.paid')}</option>
                <option value="credit">{t('sales.credit')}</option>
                <option value="partial">{t('pos.partial')}</option>
                <option value="return">{t('filters.withReturn')}</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Box>
        </Flex>
      </Stack>

      {/* How many, and for how much — the first thing asked of a filtered list. */}
      {!loading && !error && !neverSold && (
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
            {t('sales.countLabel', { count: shownCount })}
            {filteredTotal !== null && filtered.length > 0 && (
              <>
                {' · '}
                <Text as="span" fontWeight="bold" color="fg">
                  {money(filteredTotal)}
                </Text>
              </>
            )}
          </Text>
        </Flex>
      )}
      <ActiveFilters filters={activeFilters} onReset={resetFilters} />

      {loading ? (
        <Flex align="center" justify="center" py={16}>
          <Spinner size="xl" colorPalette="brand" />
        </Flex>
      ) : error ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      ) : neverSold ? (
        <EmptyState.Root size="lg" py={12}>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Receipt size={48} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('sales.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('sales.emptyHint')}</EmptyState.Description>
            <Button asChild size="xl" colorPalette="brand" mt={2}>
              <RouterLink to="/caisse">
                <ShoppingCart size={22} />
                {t('pos.title')}
              </RouterLink>
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : pageShort && loadingMore ? (
        // A page further back than what is loaded: it is on its way.
        <Flex align="center" justify="center" py={16}>
          <Spinner size="xl" colorPalette="brand" />
        </Flex>
      ) : filtered.length === 0 ? (
        <NoResults
          search={search}
          filtered={activeFilters.length > 0}
          onReset={resetFilters}
        />
      ) : (
        <SaleCards
          sales={paged.pageItems}
          nameById={nameById}
          symbol={symbol}
          onOpen={openPreview}
        />
      )}

      {!loading && !error && (
        <Pager
          page={paged.page}
          pageCount={paged.pageCount}
          start={paged.start}
          end={paged.end}
          total={paged.total}
          onChange={goToPage}
          anchorRef={listTop}
        />
      )}

      {/*
        A filtered search only sees what has been read so far. Said plainly,
        with the way further back right under it — "aucun résultat" over the
        newest 500 tickets is exactly how a three-week-old ticket went missing.
      */}
      {/* Also when the count is unknown (offline, slow line): then the pages
          stop at what is loaded, and this is the only way further back. */}
      {!loading && !error && !complete && (narrowed || serverCount === null) && (
        <Card.Root mt={4} variant="subtle">
          <Card.Body>
            <Flex align="center" gap={3} wrap="wrap">
              <Text color="fg.muted" flex="1" minW="14rem">
                {t('sales.searchedRecent', { count: sales.length })}
              </Text>
              <Button
                size="lg"
                variant="outline"
                colorPalette="brand"
                loading={loadingMore}
                onClick={() => reachTo(max + HISTORY_STEP)}
              >
                <History size={20} />
                {t('sales.searchOlder')}
              </Button>
            </Flex>
          </Card.Body>
        </Card.Root>
      )}

      {/* ---------------- Ticket detail + reprint ---------------- */}
      <Dialog.Root
        open={!!preview && !editing}
        onOpenChange={(e) => !e.open && closePreview()}
        size="lg"
        scrollBehavior="inside"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {t('pos.ticket')} {preview?.ticketNo}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {preview && (
                  <Stack gap={3}>
                    <Text fontSize="sm" color="fg.muted">
                      {formatDateTime(preview.date)}
                      {preview.clientName ? ` · ${preview.clientName}` : ''}
                    </Text>
                    {/* A corrected ticket says so, because the paper in the
                        client's pocket is the uncorrected one. */}
                    {previewSale?.updatedAt && (
                      <Badge colorPalette="orange" alignSelf="flex-start">
                        {t('sales.edited', { date: formatDateTime(previewSale.updatedAt) })}
                      </Badge>
                    )}

                    <Stack gap={2}>
                      {preview.lines.map((l) => (
                        <Flex key={l.id} justify="space-between" gap={3}>
                          <Box minW="0">
                            <Text truncate>{l.name}</Text>
                            <Text fontSize="sm" color="fg.muted">
                              {l.qty} × {money(l.unitPrice)}
                            </Text>
                          </Box>
                          <Text
                            fontWeight="semibold"
                            whiteSpace="nowrap"
                            color={l.qty < 0 ? 'red.600' : undefined}
                          >
                            {money(l.qty * l.unitPrice)}
                          </Text>
                        </Flex>
                      ))}
                    </Stack>

                    <Box borderTopWidth="1px" borderColor="border" pt={3}>
                      <Flex justify="space-between">
                        <Text color="fg.muted">{t('pos.total')}</Text>
                        <Text
                          fontWeight="bold"
                          fontSize="xl"
                          color={preview.total < 0 ? 'red.600' : undefined}
                        >
                          {money(preview.total)}
                        </Text>
                      </Flex>
                      <Flex justify="space-between">
                        <Text color="fg.muted">{t('sales.paid')}</Text>
                        <Text>{money(preview.paid)}</Text>
                      </Flex>
                      {preview.total - preview.paid > 0 && (
                        <Flex justify="space-between">
                          <Text color="fg.muted">{t('sales.remaining')}</Text>
                          <Text fontWeight="bold" color="red.600">
                            {money(preview.total - preview.paid)}
                          </Text>
                        </Flex>
                      )}
                    </Box>
                  </Stack>
                )}
              </Dialog.Body>
              <Dialog.Footer flexWrap="wrap" gap={2}>
                {/*
                  Correcting lives here, on the ticket the owner is looking at,
                  rather than as an icon on the list row — a row is tapped a
                  hundred times a day to reprint, and an edit icon beside the
                  reprint one is how a ticket gets changed by accident.
                */}
                {previewSale && (
                  <>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setEditing({ sale: previewSale, intent: 'edit' })}
                    >
                      <Pencil size={18} />
                      {t('common.edit')}
                    </Button>
                    {previewSale.total > 0 && previewSale.total - previewSale.paid <= 0 && (
                      <Button
                        size="lg"
                        variant="outline"
                        colorPalette="orange"
                        onClick={() => setEditing({ sale: previewSale, intent: 'toCredit' })}
                      >
                        <HandCoins size={18} />
                        {t('sales.putOnCarnet')}
                      </Button>
                    )}
                  </>
                )}
                <Box flex="1" />
                <Button size="lg" variant="outline" onClick={() => doPrint('thermal')}>
                  <Printer size={20} />
                  {t('sales.reprint')} 80mm
                </Button>
                <Button size="lg" variant="outline" onClick={() => doPrint('a4')}>
                  <Printer size={20} />
                  A4
                </Button>
                <Button size="lg" colorPalette="brand" onClick={closePreview}>
                  {t('common.close')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {invoiceOpen && (
        <NewSaleInvoice
          open
          onClose={() => setInvoiceOpen(false)}
          // Straight from "enregistrer" to the printable invoice, defaulted to A4.
          onRecorded={(ticket, saleId) => {
            setPaper('a4')
            setJustRecorded(ticket)
            setPreviewId(saleId)
          }}
        />
      )}

      {editing && editingSale && (
        <SaleEditor
          sale={editingSale}
          intent={editing.intent}
          onClose={() => setEditing(null)}
          // A voided ticket has nothing left to preview.
          onSaved={(kind) => {
            if (kind === 'voided') closePreview()
          }}
        />
      )}

      {/* Hidden on screen; revealed by the print stylesheet */}
      {preview && (
        <Ticket data={preview} shop={shop} symbol={symbol} paper={paper} />
      )}
    </Box>
  )
}

/**
 * One page of tickets, memoized: while the owner types in the search box the
 * cards are drawn once, at low priority, instead of on every letter.
 */
const SaleCards = memo(function SaleCards({
  sales,
  nameById,
  symbol,
  onOpen,
}: {
  sales: readonly Sale[]
  nameById: Map<string, string>
  symbol: string
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const money = (m: number) => formatMoney(m, { symbol })
  return (
    <Stack gap={3}>
      {sales.map((s) => {
        const itemCount = s.items.reduce((n, i) => n + i.qty, 0)
        const client = clientName(s, nameById)
        const settled = statusOf(s)
        return (
          <Card.Root
            key={s.id}
            cursor="pointer"
            _hover={{ borderColor: 'brand.solid' }}
            onClick={() => onOpen(s.id)}
          >
            <Card.Body>
              <Flex align="center" gap={3} wrap="wrap">
                <Box minW="0" flex="1">
                  <HStack gap={2} mb={1} wrap="wrap">
                    <Text
                      fontSize="lg"
                      fontWeight="bold"
                      color={s.total < 0 ? 'red.600' : undefined}
                    >
                      {money(s.total)}
                    </Text>
                    <Text
                      fontSize="xs"
                      fontFamily="mono"
                      color="brand.fg"
                      bg="brand.subtle"
                      px={2}
                      py={0.5}
                      borderRadius="md"
                    >
                      {s.ticketNo}
                    </Text>
                    {s.kind === 'invoice' && (
                      <Badge colorPalette="purple" size="lg" variant="subtle">
                        <FileText size={14} />
                        {t('sales.invoice')}
                      </Badge>
                    )}
                    {s.hasReturn && (
                      <Badge colorPalette="red" size="lg" variant="subtle">
                        {t('sales.refund')}
                      </Badge>
                    )}
                  </HStack>
                  <Text fontSize="sm" color="fg.muted">
                    {formatDateTime(s.date)} · {itemCount} {t('sales.items')}
                    {client ? ` · ${client}` : ''}
                  </Text>
                </Box>
                {settled === 'partial' ? (
                  <Badge colorPalette="orange" size="lg" variant="subtle">
                    {t('pos.partial')}
                  </Badge>
                ) : settled === 'credit' ? (
                  <Badge colorPalette="orange" size="lg">
                    {t('sales.credit')}
                  </Badge>
                ) : (
                  <Badge colorPalette="green" size="lg">
                    {t('sales.paid')}
                  </Badge>
                )}
              </Flex>
            </Card.Body>
          </Card.Root>
        )
      })}
    </Stack>
  )
})
