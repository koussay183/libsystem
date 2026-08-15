import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Box,
  Card,
  Badge,
  Button,
  Dialog,
  Portal,
  Flex,
  HStack,
  Input,
  InputGroup,
  NativeSelect,
  Stack,
  Text,
  Spinner,
  Alert,
  EmptyState,
} from '@chakra-ui/react'
import { ShoppingCart, Receipt, Search, Printer, FileText, Plus } from 'lucide-react'
import { formatMoney, moneySymbolKey } from '@/lib/money'
import { formatDateTime } from '@/lib/format'
import { useSales } from './useSales'
import { NewSaleInvoice } from './NewSaleInvoice'
import { useCustomers } from '@/features/customers/useCustomers'
import { useShopSettings } from '@/features/settings/useShopSettings'
import { Ticket } from '@/features/pos/Ticket'
import type { TicketData } from '@/features/pos/Ticket'
import type { Sale } from '@/types/models'

type Period = 'all' | 'today' | 'week' | 'month' | 'year'

/** Oldest timestamp kept by each period, or 0 for "everything". */
function cutoffOf(period: Period): number {
  switch (period) {
    case 'today':
      return dayjs().startOf('day').valueOf()
    case 'week':
      return dayjs().subtract(7, 'day').valueOf()
    case 'month':
      return dayjs().subtract(30, 'day').valueOf()
    case 'year':
      return dayjs().subtract(12, 'month').valueOf()
    default:
      return 0
  }
}

export function SalesTab() {
  const { t } = useTranslation()
  // A deeper window than the till's default: this tab is the sales history.
  const { sales, loading, error } = useSales(500)
  const { customers } = useCustomers()
  const { shop } = useShopSettings()

  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [preview, setPreview] = useState<TicketData | null>(null)
  const [paper, setPaper] = useState<'thermal' | 'a4'>('thermal')

  const symbol = t(moneySymbolKey())
  const money = (m: number) => formatMoney(m, { symbol })
  const nameOf = (id?: string | null) => customers.find((c) => c.id === id)?.name

  /** The stored name wins: it still reads correctly if the client was deleted. */
  const clientOf = (s: Sale) => s.customerName ?? nameOf(s.customerId) ?? undefined

  const q = search.trim().toLowerCase()
  const cutoff = cutoffOf(period)
  const filtered = sales.filter((s) => {
    if (s.date < cutoff) return false
    if (q === '') return true
    return (
      s.ticketNo.toLowerCase().includes(q) ||
      (clientOf(s) ?? '').toLowerCase().includes(q)
    )
  })

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

  const doPrint = (which: 'thermal' | 'a4') => {
    setPaper(which)
    // Let the paper class land on #print-area before the print dialog opens.
    setTimeout(() => window.print(), 50)
  }

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
        <InputGroup startElement={<Search size={22} />}>
          <Input
            size="lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('sales.searchTicket')}
          />
        </InputGroup>
        <NativeSelect.Root size="lg">
          <NativeSelect.Field
            value={period}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setPeriod(e.currentTarget.value as Period)
            }
            aria-label={t('common.period')}
          >
            <option value="all">{t('common.all')}</option>
            <option value="today">{t('dashboard.today')}</option>
            <option value="week">{t('dashboard.week')}</option>
            <option value="month">{t('dashboard.month')}</option>
            <option value="year">{t('dashboard.year')}</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Stack>

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
      ) : sales.length === 0 ? (
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
      ) : filtered.length === 0 ? (
        <Card.Root>
          <Card.Body>
            <Text color="fg.muted">{t('stock.noResults')}</Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Stack gap={3}>
          {filtered.map((s) => {
            const itemCount = s.items.reduce((n, i) => n + i.qty, 0)
            const client = clientOf(s)
            return (
              <Card.Root
                key={s.id}
                cursor="pointer"
                _hover={{ borderColor: 'brand.solid' }}
                onClick={() => setPreview(toTicket(s))}
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
                    {s.mode === 'partial' ? (
                      <Badge colorPalette="orange" size="lg" variant="subtle">
                        {t('pos.partial')}
                      </Badge>
                    ) : s.onCredit ? (
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
      )}

      {/* ---------------- Ticket detail + reprint ---------------- */}
      <Dialog.Root
        open={!!preview}
        onOpenChange={(e) => !e.open && setPreview(null)}
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
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => doPrint('thermal')}>
                  <Printer size={20} />
                  {t('sales.reprint')} 80mm
                </Button>
                <Button size="lg" variant="outline" onClick={() => doPrint('a4')}>
                  <Printer size={20} />
                  A4
                </Button>
                <Button size="lg" colorPalette="brand" onClick={() => setPreview(null)}>
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
          onRecorded={(ticket) => {
            setPaper('a4')
            setPreview(ticket)
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
