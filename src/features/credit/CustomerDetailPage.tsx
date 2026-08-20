import { Fragment, useMemo, useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Trash2,
  Coins,
  HandCoins,
  Receipt,
  Printer,
  Pencil,
  CalendarClock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  EmptyState,
  Flex,
  Heading,
  HStack,
  Separator,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react'
import { formatMoney, moneySymbolKey } from '@/lib/money'
import { useSale } from '@/features/sales/useSales'
import type { CreditEntry } from '@/types/models'
import { formatDate } from '@/lib/format'
import { useAlive } from '@/lib/useAlive'
import { useShopSettings } from '@/features/settings/useShopSettings'
import {
  useCustomer,
  useCustomerLedger,
  removeCustomer,
  OutstandingBalanceError,
  LedgerUnreadableError,
} from '@/features/customers/useCustomers'
import { CreditEntryForm } from './CreditEntryForm'
import { CustomerForm } from './CustomerForm'
import { CarnetPrint } from './CarnetPrint'
import {
  buildLedger,
  ledgerTotals,
  debtAgeDays,
  needsReminder,
} from './ledger'

/**
 * One page of the carnet de crédit: who he is, what he owes right now, and
 * every line of his history with the running balance down the side.
 */

/**
 * WHAT THAT LINE OF THE CARNET WAS FOR.
 *
 * The carnet answered "how much" and refused to answer "for what". A client
 * who disputes 17,500 DT is not disputing the arithmetic — he wants to know
 * which articles it was, and the owner had to leave the carnet, walk to the
 * Factures screen and search a ticket number to tell him. Every one of those
 * lines already carries its saleId; nothing was following it.
 *
 * Opened one at a time, and only when clicked: the fetch is deliberate work,
 * and a client page can hold a hundred lines.
 */
function SaleDetailRow({ entry, symbol }: { entry: CreditEntry; symbol: string }) {
  const { t } = useTranslation()
  const { sale, loading, missing } = useSale(entry.saleId)
  const money = (m: number) => formatMoney(m, { symbol })

  return (
    <Table.Row bg="bg.subtle">
      <Table.Cell colSpan={5} p={0}>
        <Box px={{ base: 3, md: 6 }} py={4}>
          {loading ? (
            <HStack gap={3} color="fg.muted">
              <Spinner size="sm" />
              <Text>{t('common.loading')}</Text>
            </HStack>
          ) : missing || !sale ? (
            /* Offline and never cached on THIS machine, most often: the
               ticket was rung up on the other till. Not an error worth a red
               banner — the amount above is still correct and still owed. */
            <Text color="fg.muted">{t('credit.itemsUnavailable')}</Text>
          ) : (
            <Stack gap={3}>
              <HStack gap={2} color="fg.muted">
                <ShoppingBag size={18} />
                <Text fontWeight="semibold">
                  {t('credit.itemsTitle', { count: sale.items.length })}
                </Text>
              </HStack>

              <Stack gap={1}>
                {sale.items.map((it, i) => (
                  <Flex
                    key={`${it.productId ?? 'x'}-${i}`}
                    align="center"
                    gap={3}
                    py={1}
                    borderBottomWidth="1px"
                    borderColor="border"
                  >
                    <Text minW={0} flex="1">
                      {it.name}
                      {it.qty < 0 && (
                        <Badge colorPalette="orange" ms={2} size="sm">
                          {t('pos.return')}
                        </Badge>
                      )}
                    </Text>
                    <Text color="fg.muted" whiteSpace="nowrap">
                      {it.qty} × {money(it.unitPrice)}
                    </Text>
                    <Text fontWeight="bold" whiteSpace="nowrap" minW="6rem" textAlign="end">
                      {money(it.qty * it.unitPrice)}
                    </Text>
                  </Flex>
                ))}
              </Stack>

              {/*
                THE PARTIAL SETTLEMENT, SPELLED OUT.

                This is the case the owner asked for by name. On a "partiel"
                the client paid something at the counter and the rest became
                this carnet line — so the ticket total and the amount owed are
                two different numbers, and showing only the articles would
                leave him explaining why they do not add up to the line above.
              */}
              <Flex gap={4} wrap="wrap" pt={1}>
                <Box>
                  <Text fontSize="sm" color="fg.muted">
                    {t('pos.ticketTotal')}
                  </Text>
                  <Text fontWeight="bold">{money(sale.total)}</Text>
                </Box>
                {sale.paid > 0 && (
                  <Box>
                    <Text fontSize="sm" color="fg.muted">
                      {t('pos.paidAtCounter')}
                    </Text>
                    <Text fontWeight="bold" color="green.600">
                      {money(sale.paid)}
                    </Text>
                  </Box>
                )}
                <Box>
                  <Text fontSize="sm" color="fg.muted">
                    {t('credit.putOnAccount')}
                  </Text>
                  <Text fontWeight="bold" color="red.600">
                    {money(sale.total - sale.paid)}
                  </Text>
                </Box>
                {(sale.discount ?? 0) > 0 && (
                  <Box>
                    <Text fontSize="sm" color="fg.muted">
                      {t('pos.discount')}
                    </Text>
                    <Text fontWeight="bold">-{money(sale.discount ?? 0)}</Text>
                  </Box>
                )}
              </Flex>
            </Stack>
          )}
        </Box>
      </Table.Cell>
    </Table.Row>
  )
}

export function CustomerDetailPage() {
  const { t } = useTranslation()
  /**
   * The one carnet line whose articles are open.
   *
   * One at a time, deliberately: a client page can hold a hundred lines and
   * every open row is a document read. It is also how the row reads on paper —
   * you follow one line with your finger, you do not unfold the whole carnet.
   */
  const [openId, setOpenId] = useState<string | null>(null)
  const { id } = useParams()
  const navigate = useNavigate()
  const alive = useAlive()
  const { customer, loading, error } = useCustomer(id)
  const { entries, loading: ledgerLoading, error: ledgerError } = useCustomerLedger(id)
  const { shop } = useShopSettings()

  const [payOpen, setPayOpen] = useState(false)
  const [debitOpen, setDebitOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const symbol = t(moneySymbolKey())
  const money = (m: number) => formatMoney(m, { symbol })

  // The running balance can only be built oldest -> newest; the table then
  // shows it newest first, the way the owner reads his notebook.
  const rows = useMemo(() => buildLedger(entries), [entries])
  const totals = useMemo(() => ledgerTotals(entries), [entries])
  const ageDays = useMemo(() => debtAgeDays(entries), [entries])
  const relance = useMemo(
    () => needsReminder(entries, customer?.balance ?? 0),
    [entries, customer],
  )

  if (loading) {
    return (
      <Flex align="center" justify="center" py={16}>
        <Spinner size="xl" colorPalette="brand" />
      </Flex>
    )
  }
  if (error) {
    return (
      <Alert.Root status="error">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{error}</Alert.Title>
        </Alert.Content>
      </Alert.Root>
    )
  }
  if (!customer) return <Navigate to="/credit" replace />

  const owes = customer.balance > 0
  const advance = customer.balance < 0

  const onDelete = async () => {
    if (!window.confirm(t('customer.deleteConfirm'))) return
    setDeleting(true)
    setDeleteError('')
    try {
      await removeCustomer(customer.id)
      if (alive.current) navigate('/credit', { replace: true })
    } catch (err) {
      if (alive.current) {
        // A refused delete is not a failure — it is the app protecting a debt.
        setDeleteError(
          err instanceof OutstandingBalanceError
            ? t('credit.cannotDeleteDebtor', {
                amount: formatMoney(err.balance, { symbol }),
              })
            : // Not an error message but an instruction, and the only one in the
              // app that asks the owner to wait for a line: his ledger lines
              // could not be read, and deleting him without them would leave
              // money on the books under a name nobody can look up.
              err instanceof LedgerUnreadableError
              ? t('credit.cannotDeleteOffline')
              : err instanceof Error
                ? err.message
                : t('common.error'),
        )
      }
    } finally {
      if (alive.current) setDeleting(false)
    }
  }

  return (
    <Box>
      <Button variant="ghost" size="lg" mb={3} onClick={() => navigate('/credit')}>
        <Box _rtl={{ transform: 'rotate(180deg)' }} display="inline-flex">
          <ArrowLeft size={22} />
        </Box>
        {t('common.back')}
      </Button>

      {/* ---------------- Who he is, and what he owes ---------------- */}
      <Card.Root mb={5}>
        <Card.Body p={6}>
          <Flex wrap="wrap" align="start" justify="space-between" gap={4}>
            <Box minW="0">
              <Heading size="2xl">{customer.name}</Heading>
              {customer.phone && (
                <Text mt={1} fontSize="lg" color="fg.muted">
                  {customer.phone}
                </Text>
              )}
              {customer.cin && (
                <Text mt={1} fontSize="lg" color="fg.muted">
                  {t('customer.cinShort')} {customer.cin}
                </Text>
              )}
              {customer.note && (
                <Text mt={1} color="fg.muted">
                  {customer.note}
                </Text>
              )}
              <Text mt={2} fontSize="sm" color="fg.muted">
                {t('credit.since', { date: formatDate(customer.createdAt) })}
              </Text>

              <Flex wrap="wrap" gap={2} mt={3}>
                {owes && ageDays !== null && (
                  <Badge colorPalette="orange" size="lg">
                    <CalendarClock size={16} />
                    {t('credit.daysOld', { count: ageDays })}
                  </Badge>
                )}
                {relance && (
                  <Badge colorPalette="red" size="lg" title={t('credit.reminderHint')}>
                    <AlertTriangle size={16} />
                    {t('credit.reminder')}
                  </Badge>
                )}
              </Flex>
            </Box>

            {/* The balance is deliberately the biggest thing on the page. */}
            <Box textAlign="end" minW="0">
              <Text fontSize="lg" color="fg.muted">
                {t('customer.balance')}
              </Text>
              <Text
                fontSize={{ base: '5xl', md: '6xl' }}
                lineHeight="1.1"
                fontWeight="bold"
                color={owes ? 'red.600' : 'green.600'}
              >
                {owes
                  ? money(customer.balance)
                  : advance
                    ? money(-customer.balance)
                    : t('credit.settled')}
              </Text>
              {/* He paid more than he owed: the shop is the one holding money. */}
              {advance && (
                <Text fontSize="lg" fontWeight="semibold" color="green.600">
                  {t('credit.creditor', { amount: money(-customer.balance) })}
                </Text>
              )}
            </Box>
          </Flex>

          {/* ---------------- The two buttons that matter ---------------- */}
          <Flex wrap="wrap" gap={3} mt={6}>
            <Button
              size="xl"
              colorPalette="green"
              flex={{ base: '1 1 100%', sm: '1 1 auto' }}
              onClick={() => setPayOpen(true)}
            >
              <Coins size={24} />
              {t('credit.recordPayment')}
            </Button>
            <Button
              size="xl"
              colorPalette="red"
              variant="subtle"
              flex={{ base: '1 1 100%', sm: '1 1 auto' }}
              onClick={() => setDebitOpen(true)}
            >
              <HandCoins size={24} />
              {t('credit.recordDebit')}
            </Button>
            <Button size="xl" variant="outline" onClick={() => window.print()}>
              <Printer size={22} />
              {t('credit.printCarnet')}
            </Button>
            <Button size="xl" variant="ghost" onClick={() => setEditOpen(true)}>
              <Pencil size={20} />
              {t('common.edit')}
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* ---------------- Totals ---------------- */}
      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3} mb={5}>
        <Card.Root>
          <Card.Body>
            <Text fontSize="sm" color="fg.muted">
              {t('credit.totalTaken')}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="red.600">
              {money(totals.taken)}
            </Text>
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Body>
            <Text fontSize="sm" color="fg.muted">
              {t('credit.totalPaid')}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="green.600">
              {money(totals.paid)}
            </Text>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* ---------------- The carnet itself ---------------- */}
      <Heading size="xl" mb={3}>
        {t('credit.carnet')}
      </Heading>

      {ledgerError && (
        <Alert.Root status="error" mb={3}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{ledgerError}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {ledgerLoading ? (
        <Flex justify="center" py={10}>
          <Spinner size="lg" colorPalette="brand" />
        </Flex>
      ) : rows.length === 0 ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Receipt size={40} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('credit.noEntries')}</EmptyState.Title>
            <EmptyState.Description>{t('credit.subtitle')}</EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <Card.Root>
          <Card.Body p={0}>
            <Box overflowX="auto">
              <Table.Root size="lg">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>{t('common.date')}</Table.ColumnHeader>
                    <Table.ColumnHeader>{t('credit.label')}</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      {t('credit.out')}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      {t('credit.in')}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      {t('credit.runningBalance')}
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {rows.map(({ entry, balance }) => {
                    const isDebit = entry.type === 'debit'
                    const openable = !!entry.saleId
                    const isOpen = openId === entry.id
                    return (
                      <Fragment key={entry.id}>
                      <Table.Row
                        onClick={openable ? () => setOpenId(isOpen ? null : entry.id) : undefined}
                        cursor={openable ? 'pointer' : undefined}
                        _hover={openable ? { bg: 'bg.muted' } : undefined}
                      >
                        <Table.Cell whiteSpace="nowrap">
                          {formatDate(entry.date)}
                        </Table.Cell>
                        <Table.Cell>
                          <HStack gap={2} align="start">
                            {/* Only the lines that HAVE a ticket behind them
                                open. A payment the owner wrote by hand has
                                nothing further to show, and a chevron on it
                                would be a promise the row cannot keep. */}
                            {openable && (
                              <Box color="fg.muted" mt={1} flexShrink={0}>
                                {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </Box>
                            )}
                            <Box minW={0}>
                              <Text fontWeight="medium">
                                {entry.label ||
                                  (isDebit ? t('credit.debit') : t('credit.payment'))}
                              </Text>
                              {entry.ticketNo && (
                                <Text fontSize="sm" color="fg.muted">
                                  {t('credit.fromTicket', { ref: entry.ticketNo })}
                                  {openable && !isOpen && ` · ${t('credit.seeItems')}`}
                                </Text>
                              )}
                            </Box>
                          </HStack>
                        </Table.Cell>
                        <Table.Cell
                          textAlign="end"
                          whiteSpace="nowrap"
                          fontWeight="bold"
                          color="red.600"
                        >
                          {isDebit ? money(entry.amount) : '—'}
                        </Table.Cell>
                        <Table.Cell
                          textAlign="end"
                          whiteSpace="nowrap"
                          fontWeight="bold"
                          color="green.600"
                        >
                          {isDebit ? '—' : money(entry.amount)}
                        </Table.Cell>
                        <Table.Cell
                          textAlign="end"
                          whiteSpace="nowrap"
                          fontWeight="bold"
                          color={balance > 0 ? 'red.600' : 'green.600'}
                        >
                          {money(balance)}
                        </Table.Cell>
                      </Table.Row>
                      {isOpen && <SaleDetailRow entry={entry} symbol={symbol} />}
                      </Fragment>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
          </Card.Body>
        </Card.Root>
      )}

      {/* ---------------- Danger zone ---------------- */}
      <Box mt={8}>
        <Separator mb={5} />
        {deleteError && (
          <Alert.Root status="error" mb={3}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{deleteError}</Alert.Title>
            </Alert.Content>
          </Alert.Root>
        )}
        <HStack>
          <Button
            size="lg"
            variant="ghost"
            colorPalette="red"
            onClick={onDelete}
            disabled={deleting}
          >
            <Trash2 size={20} />
            {deleting ? t('common.saving') : t('common.delete')}
          </Button>
        </HStack>
      </Box>

      {payOpen && (
        <CreditEntryForm
          open
          onClose={() => setPayOpen(false)}
          customerId={customer.id}
          type="payment"
          balance={customer.balance}
        />
      )}
      {debitOpen && (
        <CreditEntryForm
          open
          onClose={() => setDebitOpen(false)}
          customerId={customer.id}
          type="debit"
          balance={customer.balance}
        />
      )}
      {editOpen && (
        <CustomerForm open onClose={() => setEditOpen(false)} customer={customer} />
      )}

      {/* Hidden on screen; the only thing the print stylesheet reveals. */}
      <CarnetPrint
        customer={customer}
        rows={rows}
        totals={totals}
        shopName={shop.name}
        symbol={symbol}
      />
    </Box>
  )
}
