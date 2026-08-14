import { useMemo, useState } from 'react'
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
  Table,
  Text,
} from '@chakra-ui/react'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/format'
import { useAlive } from '@/lib/useAlive'
import { useShopSettings } from '@/features/settings/useShopSettings'
import {
  useCustomer,
  useCustomerLedger,
  removeCustomer,
  OutstandingBalanceError,
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
export function CustomerDetailPage() {
  const { t } = useTranslation()
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

  const symbol = t('money.symbol')
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
                    return (
                      <Table.Row key={entry.id}>
                        <Table.Cell whiteSpace="nowrap">
                          {formatDate(entry.date)}
                        </Table.Cell>
                        <Table.Cell>
                          <Text fontWeight="medium">
                            {entry.label ||
                              (isDebit ? t('credit.debit') : t('credit.payment'))}
                          </Text>
                          {entry.ticketNo && (
                            <Text fontSize="sm" color="fg.muted">
                              {t('credit.fromTicket', { ref: entry.ticketNo })}
                            </Text>
                          )}
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
