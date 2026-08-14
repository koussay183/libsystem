import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  Input,
  InputGroup,
  NativeSelect,
  SimpleGrid,
  Spinner,
  Stack,
  Stat,
  Switch,
  Text,
} from '@chakra-ui/react'
import {
  Plus,
  Search,
  Users,
  ChevronRight,
  HandCoins,
  AlertTriangle,
  Wallet,
  CalendarClock,
} from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { useCustomers, useAllCreditEntries } from '@/features/customers/useCustomers'
import { CustomerForm } from './CustomerForm'
import { daysSince, debtStartedAt, groupByCustomer, needsReminder } from './ledger'

type SortKey = 'debt' | 'name' | 'oldest'

/**
 * The index of the carnet: every client, what he owes, and how long he has
 * owed it. Sorted biggest-debtor-first by default, because that is the
 * question the owner actually opens this page to answer.
 */
export function CreditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { customers, loading, error } = useCustomers()
  const { entries, error: entriesError } = useAllCreditEntries()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('debt')
  const [onlyDebtors, setOnlyDebtors] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const symbol = t('money.symbol')
  const money = (m: number) => formatMoney(m, { symbol })

  const byCustomer = useMemo(() => groupByCustomer(entries), [entries])

  /** Everything the row needs, derived once per client. */
  const rows = useMemo(() => {
    return customers.map((c) => {
      const own = byCustomer.get(c.id) ?? []
      const startedAt = debtStartedAt(own)
      return {
        customer: c,
        startedAt,
        ageDays: startedAt === null ? null : daysSince(startedAt),
        relance: needsReminder(own, c.balance),
      }
    })
  }, [customers, byCustomer])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows
    if (q !== '') {
      list = list.filter(
        (r) =>
          r.customer.name.toLowerCase().includes(q) ||
          (r.customer.phone ?? '').toLowerCase().includes(q) ||
          (r.customer.cin ?? '').toLowerCase().includes(q),
      )
    }
    if (onlyDebtors) list = list.filter((r) => r.customer.balance > 0)

    const sorted = [...list]
    if (sort === 'name') {
      sorted.sort((a, b) => a.customer.name.localeCompare(b.customer.name))
    } else if (sort === 'debt') {
      sorted.sort(
        (a, b) =>
          b.customer.balance - a.customer.balance ||
          a.customer.name.localeCompare(b.customer.name),
      )
    } else {
      // Oldest debt first; anybody who owes nothing has no clock, so he sinks
      // to the bottom rather than pretending to be the most urgent.
      sorted.sort((a, b) => {
        if (a.startedAt === null && b.startedAt === null) {
          return a.customer.name.localeCompare(b.customer.name)
        }
        if (a.startedAt === null) return 1
        if (b.startedAt === null) return -1
        return a.startedAt - b.startedAt
      })
    }
    return sorted
  }, [rows, search, onlyDebtors, sort])

  const totalOwed = customers.reduce((s, c) => s + Math.max(0, c.balance), 0)
  const withDebt = customers.filter((c) => c.balance > 0).length

  const onSearchSubmit = (e: FormEvent<HTMLFormElement>) => e.preventDefault()

  return (
    <Box>
      <Flex align="center" gap={3} mb={2} wrap="wrap">
        <Box bg="orange.subtle" color="orange.fg" p={2} borderRadius="lg">
          <HandCoins size={26} />
        </Box>
        <Heading size="2xl">{t('credit.title')}</Heading>
        <Button size="xl" colorPalette="brand" ms="auto" onClick={() => setFormOpen(true)}>
          <Plus size={22} />
          {t('customer.add')}
        </Button>
      </Flex>
      <Text color="fg.muted" mb={5}>
        {t('credit.subtitle')}
      </Text>

      {/* ---------------- What the shop is owed ---------------- */}
      <SimpleGrid columns={{ base: 2, sm: 3 }} gap={3} mb={5}>
        <Card.Root gridColumn={{ base: 'span 2', sm: 'auto' }}>
          <Card.Body>
            <HStack gap={3} align="center">
              <Box
                bg={totalOwed > 0 ? 'red.subtle' : 'green.subtle'}
                color={totalOwed > 0 ? 'red.fg' : 'green.fg'}
                p={2}
                borderRadius="lg"
              >
                <Wallet size={22} />
              </Box>
              <Stat.Root>
                <Stat.Label>{t('customer.totalOwed')}</Stat.Label>
                <Stat.ValueText color={totalOwed > 0 ? 'red.fg' : 'green.fg'}>
                  {money(totalOwed)}
                </Stat.ValueText>
              </Stat.Root>
            </HStack>
          </Card.Body>
        </Card.Root>

        <Card.Root>
          <Card.Body>
            <HStack gap={3} align="center">
              <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                <Users size={22} />
              </Box>
              <Stat.Root>
                <Stat.Label>{t('customer.customersCount')}</Stat.Label>
                <Stat.ValueText>{String(customers.length)}</Stat.ValueText>
              </Stat.Root>
            </HStack>
          </Card.Body>
        </Card.Root>

        <Card.Root>
          <Card.Body>
            <HStack gap={3} align="center">
              <Box
                bg={withDebt > 0 ? 'orange.subtle' : 'bg.muted'}
                color={withDebt > 0 ? 'orange.fg' : 'fg.muted'}
                p={2}
                borderRadius="lg"
              >
                <AlertTriangle size={22} />
              </Box>
              <Stat.Root>
                <Stat.Label>{t('customer.withDebt')}</Stat.Label>
                <Stat.ValueText color={withDebt > 0 ? 'orange.fg' : undefined}>
                  {String(withDebt)}
                </Stat.ValueText>
              </Stat.Root>
            </HStack>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* ---------------- Search, sort, filter ---------------- */}
      <form onSubmit={onSearchSubmit}>
        <Box mb={3}>
          <InputGroup
            startElement={
              <Box color="fg.muted">
                <Search size={22} />
              </Box>
            }
          >
            <Input
              size="lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('customer.searchPlaceholder')}
            />
          </InputGroup>
        </Box>
      </form>

      <Flex wrap="wrap" align="center" gap={4} mb={4}>
        <NativeSelect.Root size="lg" width="auto">
          <NativeSelect.Field
            value={sort}
            onChange={(e) => setSort(e.currentTarget.value as SortKey)}
            aria-label={t('common.filter')}
          >
            <option value="debt">{t('credit.sortByDebt')}</option>
            <option value="oldest">{t('credit.sortByOldest')}</option>
            <option value="name">{t('credit.sortByName')}</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>

        <Switch.Root
          size="lg"
          colorPalette="brand"
          checked={onlyDebtors}
          onCheckedChange={(e) => setOnlyDebtors(e.checked)}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label>{t('credit.onlyDebtors')}</Switch.Label>
        </Switch.Root>
      </Flex>

      {entriesError && (
        <Alert.Root status="error" mb={3}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{entriesError}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {/* ---------------- The clients ---------------- */}
      {loading ? (
        <Flex justify="center" align="center" py={16}>
          <Spinner size="lg" colorPalette="brand" />
        </Flex>
      ) : error ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      ) : customers.length === 0 ? (
        <EmptyState.Root size="lg">
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Users size={48} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('customer.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('customer.emptyHint')}</EmptyState.Description>
            <Button size="xl" colorPalette="brand" onClick={() => setFormOpen(true)}>
              <Plus size={22} />
              {t('customer.add')}
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : visible.length === 0 ? (
        <Card.Root>
          <Card.Body>
            <Text color="fg.muted">{t('stock.noResults')}</Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Stack gap={3}>
          {visible.map(({ customer: c, ageDays, relance }) => {
            const owes = c.balance > 0
            return (
              <Card.Root
                key={c.id}
                cursor="pointer"
                transition="background-color 0.15s"
                _hover={{ bg: 'bg.muted' }}
                onClick={() => navigate(`/credit/${c.id}`)}
              >
                <Card.Body>
                  <Flex align="center" gap={3} wrap="wrap">
                    <Box minW="0" flex="1">
                      <Text fontSize="xl" fontWeight="semibold" truncate>
                        {c.name}
                      </Text>
                      {(c.phone || c.cin) && (
                        <Text fontSize="sm" color="fg.muted">
                          {[c.phone, c.cin && `${t('customer.cinShort')} ${c.cin}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      )}
                      <Flex wrap="wrap" gap={2} mt={2}>
                        {owes && ageDays !== null && (
                          <Badge colorPalette="orange" size="md">
                            <CalendarClock size={14} />
                            {t('credit.daysOld', { count: ageDays })}
                          </Badge>
                        )}
                        {relance && (
                          <Badge
                            colorPalette="red"
                            size="md"
                            title={t('credit.reminderHint')}
                          >
                            <AlertTriangle size={14} />
                            {t('credit.reminder')}
                          </Badge>
                        )}
                      </Flex>
                    </Box>

                    <Box textAlign="end" flexShrink={0}>
                      {owes ? (
                        <Text
                          fontSize="2xl"
                          fontWeight="bold"
                          color="red.600"
                          whiteSpace="nowrap"
                        >
                          {money(c.balance)}
                        </Text>
                      ) : c.balance < 0 ? (
                        <Badge colorPalette="green" size="lg">
                          {t('credit.creditor', { amount: money(-c.balance) })}
                        </Badge>
                      ) : (
                        <Badge colorPalette="green" size="lg">
                          {t('credit.settled')}
                        </Badge>
                      )}
                    </Box>

                    <Button
                      asChild
                      size="lg"
                      variant="ghost"
                      aria-label={t('common.open')}
                      title={t('common.open')}
                      flexShrink={0}
                    >
                      <Link
                        to={`/credit/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Box _rtl={{ transform: 'rotate(180deg)' }} display="inline-flex">
                          <ChevronRight size={22} />
                        </Box>
                      </Link>
                    </Button>
                  </Flex>
                </Card.Body>
              </Card.Root>
            )
          })}
        </Stack>
      )}

      {formOpen && <CustomerForm open onClose={() => setFormOpen(false)} />}
    </Box>
  )
}
