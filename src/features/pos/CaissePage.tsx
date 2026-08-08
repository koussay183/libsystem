import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Grid,
  Card,
  Heading,
  Text,
  Button,
  Input,
  IconButton,
  Table,
  Badge,
  Flex,
  HStack,
  Stack,
  Separator,
  Field,
  Dialog,
  Portal,
  Alert,
  EmptyState,
} from '@chakra-ui/react'
import {
  ScanLine,
  Plus,
  Minus,
  Trash2,
  Printer,
  PauseCircle,
  PlayCircle,
  ShoppingCart,
  X,
  Pencil,
  Undo2,
  PackagePlus,
  Percent,
  Keyboard,
  AlertTriangle,
} from 'lucide-react'
import { formatMoney, parseMoney, fromMinor } from '@/lib/money'
import { useAlive } from '@/lib/useAlive'
import { useProducts, createProduct } from '@/features/stock/useProducts'
import { useCustomers } from '@/features/customers/useCustomers'
import { useShopSettings } from '@/features/settings/useShopSettings'
import { recordSale } from '@/features/sales/useSales'
import { usePosCart } from './usePosCart'
import type { PosLine } from './usePosCart'
import { Ticket } from './Ticket'
import type { TicketData } from './Ticket'
import type { PaymentMode, Product, Customer } from '@/types/models'

type PayKind = 'cash' | 'credit' | 'partial'

/**
 * Quantity is edited as free text and only committed on blur/Enter — otherwise
 * clearing the field mid-typing would momentarily read as 0 and drop the line.
 */
function QtyCell({
  value,
  onCommit,
  label,
}: {
  value: number
  onCommit: (n: number) => void
  label: string
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const commit = () => {
    const n = Number.parseInt(text, 10)
    if (Number.isFinite(n)) onCommit(n)
    else setText(String(value))
  }

  return (
    <Input
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        }
      }}
      size="lg"
      w="4.5rem"
      textAlign="center"
      fontWeight="bold"
      inputMode="numeric"
    />
  )
}

/** Searchable client list — a plain dropdown is unusable past a few dozen. */
function ClientPicker({
  customers,
  value,
  onChange,
  searchLabel,
  symbol,
}: {
  customers: Customer[]
  value: string
  onChange: (id: string) => void
  searchLabel: string
  symbol: string
}) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) || (c.phone ?? '').includes(needle),
      )
    : customers

  return (
    <Stack gap={2}>
      <Input
        size="lg"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={searchLabel}
        autoFocus
      />
      <Stack
        gap={1}
        maxH="15rem"
        overflowY="auto"
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
        p={1}
      >
        {filtered.map((c) => (
          <Button
            key={c.id}
            size="lg"
            variant={value === c.id ? 'solid' : 'ghost'}
            colorPalette="brand"
            justifyContent="space-between"
            onClick={() => onChange(c.id)}
          >
            <Text truncate>{c.name}</Text>
            {c.balance > 0 && (
              <Badge colorPalette="orange" variant="subtle">
                {formatMoney(c.balance, { symbol })}
              </Badge>
            )}
          </Button>
        ))}
      </Stack>
    </Stack>
  )
}

export function CaissePage() {
  const { t } = useTranslation()
  const alive = useAlive()
  const { products, loading: productsLoading } = useProducts()
  const { customers } = useCustomers()
  const { shop } = useShopSettings()
  const cart = usePosCart()

  const scanRef = useRef<HTMLInputElement>(null)
  const [scan, setScan] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Ambiguous scan → let the cashier pick instead of guessing.
  const [matches, setMatches] = useState<Product[] | null>(null)

  // Unknown code → create the product without leaving the till.
  const [newOpen, setNewOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newError, setNewError] = useState('')

  // Free line (photocopy, binding…)
  const [miscOpen, setMiscOpen] = useState(false)
  const [miscName, setMiscName] = useState('')
  const [miscPrice, setMiscPrice] = useState('')

  // Price renegotiated on one line
  const [priceLine, setPriceLine] = useState<PosLine | null>(null)
  const [priceText, setPriceText] = useState('')

  // Whole-ticket discount
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountText, setDiscountText] = useState('')

  // Settlement
  const [payOpen, setPayOpen] = useState(false)
  const [payKind, setPayKind] = useState<PayKind>('cash')
  const [customerId, setCustomerId] = useState('')
  const [received, setReceived] = useState('')
  const [payError, setPayError] = useState('')

  /**
   * In-flight guard. `busy` is React state and only lands on the next render,
   * so a second Enter (or a held-down key repeating at ~30ms against a ~150ms
   * round-trip) would slip through and record the same ticket twice — double
   * stock movement and, on credit, double debt. A ref flips synchronously.
   */
  const submitting = useRef(false)

  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [lastTicket, setLastTicket] = useState<TicketData | null>(null)
  const [paper, setPaper] = useState<'thermal' | 'a4'>('thermal')

  const symbol = t('money.symbol')
  const money = (m: number) => formatMoney(m, { symbol })
  const focusScan = () => scanRef.current?.focus()

  const anyDialogOpen =
    payOpen || miscOpen || newOpen || discountOpen || !!matches || !!priceLine || !!ticket

  useEffect(() => {
    focusScan()
  }, [])

  /**
   * A parked ticket can outlive the product it holds: if the article was
   * deleted from the stock meanwhile, the whole atomic batch would be rejected
   * and nothing would be recorded. Catch it before the cashier tries to cash in.
   */
  const staleLines = useMemo(() => {
    // Only skip the check while the list is still loading. An empty collection
    // is a real answer: every line on a resumed ticket is genuinely stale.
    if (productsLoading) return []
    return cart.lines.filter(
      (l) => l.productId && !products.some((p) => p.id === l.productId),
    )
  }, [cart.lines, products, productsLoading])

  const canSettle = cart.lines.length > 0 && staleLines.length === 0 && !busy
  const isRefund = cart.total < 0

  // --- scanning ---------------------------------------------------------
  const submitScan = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const term = scan.trim()
    if (!term) return
    setNotice('')
    setScan('')

    const byBarcode = products.find((p) => p.barcode === term)
    if (byBarcode) {
      cart.addProduct(byBarcode)
      focusScan()
      return
    }

    const needle = term.toLowerCase()
    const found = products.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.family ?? '').toLowerCase().includes(needle),
    )

    if (found.length === 1) {
      cart.addProduct(found[0])
    } else if (found.length > 1) {
      // Never guess: picking the first alphabetical match sells the wrong item.
      setMatches(found.slice(0, 40))
      setNotice(t('pos.manyMatches', { term }))
      return
    } else {
      setNotice(t('pos.notFound', { term }))
      setNewCode(/^\d+$/.test(term) ? term : '')
      setNewName(/^\d+$/.test(term) ? '' : term)
    }
    focusScan()
  }

  const chooseMatch = (p: Product) => {
    cart.addProduct(p)
    setMatches(null)
    setNotice('')
    setScan('')
    focusScan()
  }

  // --- create a product from the till ------------------------------------
  const openNewProduct = () => {
    setNewPrice('')
    setNewCost('')
    setNewError('')
    setNewOpen(true)
  }

  const saveNewProduct = async () => {
    if (newName.trim() === '') {
      setNewError(t('stock.nameRequired'))
      return
    }
    const salePrice = parseMoney(newPrice) ?? 0
    setBusy(true)
    setNewError('')
    try {
      const id = await createProduct({
        barcode: newCode.trim() || null,
        name: newName.trim(),
        costPrice: parseMoney(newCost) ?? 0,
        salePrice,
        quantity: 0,
        lowStockThreshold: 0,
      })
      if (!alive.current) return
      cart.addProduct({
        id,
        barcode: newCode.trim() || null,
        name: newName.trim(),
        costPrice: parseMoney(newCost) ?? 0,
        salePrice,
        quantity: 0,
        lowStockThreshold: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      setNewOpen(false)
      setNotice('')
      setNewName('')
      setNewCode('')
      focusScan()
    } catch {
      if (alive.current) setNewError(t('common.error'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  // --- free line ---------------------------------------------------------
  const addMisc = () => {
    const price = parseMoney(miscPrice)
    if (miscName.trim() === '' || price === null) return
    cart.addMisc(miscName.trim(), price)
    setMiscOpen(false)
    setMiscName('')
    setMiscPrice('')
    focusScan()
  }

  // --- settlement --------------------------------------------------------
  const openPay = (kind: PayKind) => {
    if (!canSettle) return
    setPayKind(kind)
    setPayError('')
    setCustomerId('')
    setReceived('')
    setPayOpen(true)
  }

  const finish = async (
    mode: PaymentMode,
    paidNow: number,
    receivedNow: number,
    client: string | null,
  ) => {
    if (cart.lines.length === 0 || staleLines.length > 0) return
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setSaveError('')
    const snapshot = {
      lines: cart.lines,
      subtotal: cart.subtotal,
      discount: cart.discount,
      total: cart.total,
    }
    try {
      const rec = await recordSale({
        items: snapshot.lines.map(({ productId, name, qty, unitPrice, unitCost }) => ({
          productId,
          name,
          qty,
          unitPrice,
          unitCost,
        })),
        subtotal: snapshot.subtotal,
        discount: snapshot.discount,
        total: snapshot.total,
        paid: paidNow,
        received: receivedNow,
        mode,
        customerId: client,
        customerName: customers.find((c) => c.id === client)?.name ?? null,
      })
      if (!alive.current) return
      const data: TicketData = {
        ticketNo: rec.ticketNo,
        date: rec.date,
        lines: snapshot.lines,
        subtotal: snapshot.subtotal,
        discount: snapshot.discount,
        total: snapshot.total,
        paid: paidNow,
        received: receivedNow,
        mode,
        clientName: customers.find((c) => c.id === client)?.name,
      }
      setTicket(data)
      setLastTicket(data)
      cart.clear()
      setPayOpen(false)
      setCustomerId('')
      setReceived('')
    } catch {
      // The basket is deliberately left untouched: nothing was written, so the
      // cashier can simply try again instead of re-scanning the whole ticket.
      if (alive.current) {
        setSaveError(t('pos.saveFailed'))
        setPayOpen(false)
      }
    } finally {
      submitting.current = false
      if (alive.current) setBusy(false)
    }
  }

  const confirmPay = async () => {
    if (payKind === 'cash') {
      const given = parseMoney(received)
      // An empty field means "exact money" — one keystroke for the common case.
      const receivedNow = given ?? cart.total
      if (receivedNow < cart.total) {
        setPayError(t('pos.remaining'))
        return
      }
      await finish('paid', cart.total, receivedNow, null)
      return
    }

    if (!customerId) {
      setPayError(t('pos.needClient'))
      return
    }
    if (payKind === 'credit') {
      await finish('credit', 0, 0, customerId)
      return
    }
    const given = Math.max(0, parseMoney(received) ?? 0)
    const paidNow = Math.min(given, cart.total)
    await finish(paidNow > 0 ? 'partial' : 'credit', paidNow, given, customerId)
  }

  const doPrint = (which: 'thermal' | 'a4') => {
    setPaper(which)
    setTimeout(() => window.print(), 50)
  }

  const reprintLast = () => {
    if (!lastTicket) return
    setTicket(lastTicket)
  }

  // --- keyboard shortcuts (a till is driven without a mouse) -------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anyDialogOpen) return
      if (e.key === 'F2') {
        e.preventDefault()
        openPay('cash')
      } else if (e.key === 'F4') {
        e.preventDefault()
        if (cart.lines.length > 0) cart.park(`${cart.itemCount} ${t('pos.items')}`)
      } else if (e.key === 'F6') {
        e.preventDefault()
        setMiscOpen(true)
      } else if (e.key === 'Escape') {
        focusScan()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // --- quick cash denominations -----------------------------------------
  const quickCash = useMemo(() => {
    const due = cart.total
    if (due <= 0) return []
    const steps = [1000, 5000, 10000, 20000, 50000]
    const set = new Set<number>()
    for (const s of steps) {
      const v = Math.ceil(due / s) * s
      if (v > due) set.add(v)
    }
    return [...set].sort((a, b) => a - b).slice(0, 4)
  }, [cart.total])

  const receivedMinor = parseMoney(received) ?? 0
  const changeDue = Math.max(0, receivedMinor - cart.total)
  const remainingAfter = Math.max(0, cart.total - receivedMinor)

  return (
    <Box>
      <Flex align="center" gap={3} mb={5} wrap="wrap">
        <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
          <ShoppingCart size={26} />
        </Box>
        <Heading size="2xl">{t('pos.title')}</Heading>
        <Box flex="1" />
        {lastTicket && (
          <Button variant="outline" size="lg" onClick={reprintLast}>
            <Printer size={18} />
            {t('pos.reprint')}
          </Button>
        )}
      </Flex>

      <Grid templateColumns={{ base: '1fr', xl: '1fr 24rem' }} gap={5} alignItems="start">
        {/* ---------------- Left: scan + ticket lines ---------------- */}
        <Stack gap={4} minW={0}>
          <Card.Root>
            <Card.Body>
              <form onSubmit={submitScan}>
                <Flex gap={3} align="center">
                  <Box color="fg.subtle" flexShrink={0}>
                    <ScanLine size={28} />
                  </Box>
                  <Input
                    ref={scanRef}
                    size="xl"
                    autoFocus
                    value={scan}
                    onChange={(e) => setScan(e.target.value)}
                    placeholder={t('pos.scanPlaceholder')}
                    fontSize="lg"
                  />
                  <Button
                    type="button"
                    size="xl"
                    variant="outline"
                    flexShrink={0}
                    onClick={() => setMiscOpen(true)}
                  >
                    <PackagePlus size={20} />
                    <Text as="span" display={{ base: 'none', md: 'inline' }}>
                      {t('pos.misc')}
                    </Text>
                  </Button>
                </Flex>
              </form>

              {notice && (
                <Alert.Root status="warning" mt={3}>
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{notice}</Alert.Title>
                  </Alert.Content>
                  {!matches && (
                    <Button size="lg" colorPalette="brand" onClick={openNewProduct}>
                      {t('pos.createFromScan')}
                    </Button>
                  )}
                </Alert.Root>
              )}

              {staleLines.length > 0 && (
                <Alert.Root status="error" mt={3}>
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{t('pos.productDeleted')}</Alert.Title>
                    <Alert.Description>
                      {staleLines.map((l) => l.name).join(', ')}
                    </Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              )}
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body p={0}>
              {cart.lines.length === 0 ? (
                <EmptyState.Root size="lg" py={12}>
                  <EmptyState.Content>
                    <EmptyState.Indicator>
                      <ScanLine size={48} />
                    </EmptyState.Indicator>
                    <EmptyState.Title>{t('pos.emptyTicket')}</EmptyState.Title>
                    <EmptyState.Description>
                      {t('pos.emptyTicketHint')}
                    </EmptyState.Description>
                  </EmptyState.Content>
                </EmptyState.Root>
              ) : (
                <Box overflowX="auto">
                  <Table.Root size="lg">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>{t('pos.product')}</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">
                          {t('pos.unitPrice')}
                        </Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="center">
                          {t('pos.qty')}
                        </Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">
                          {t('pos.lineTotal')}
                        </Table.ColumnHeader>
                        <Table.ColumnHeader />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {cart.lines.map((l) => {
                        const isReturn = l.qty < 0
                        const stale = staleLines.some((s) => s.id === l.id)
                        return (
                          <Table.Row key={l.id} bg={isReturn ? 'red.50' : undefined}>
                            <Table.Cell>
                              <Text fontWeight="semibold">{l.name}</Text>
                              <HStack gap={2} mt={1} wrap="wrap">
                                {isReturn && (
                                  <Badge colorPalette="red">{t('pos.returnBadge')}</Badge>
                                )}
                                {l.priceEdited && (
                                  <Badge colorPalette="purple" variant="subtle">
                                    {t('pos.priceChanged')}
                                  </Badge>
                                )}
                                {stale && (
                                  <Badge colorPalette="red" variant="subtle">
                                    {t('pos.productDeleted')}
                                  </Badge>
                                )}
                                {!isReturn && l.productId && l.qty > l.stock && (
                                  <Badge colorPalette="orange" variant="subtle">
                                    {l.stock <= 0
                                      ? t('pos.outOfStock')
                                      : t('pos.stockLeft', { count: l.stock })}
                                  </Badge>
                                )}
                              </HStack>
                            </Table.Cell>
                            <Table.Cell textAlign="end" whiteSpace="nowrap">
                              {money(l.unitPrice)}
                            </Table.Cell>
                            <Table.Cell>
                              <HStack justify="center" gap={1}>
                                <IconButton
                                  aria-label={t('common.decrease')}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cart.setQty(l.id, l.qty - 1)}
                                >
                                  <Minus size={16} />
                                </IconButton>
                                <QtyCell
                                  value={l.qty}
                                  label={t('pos.editQty')}
                                  onCommit={(n) => cart.setQty(l.id, n)}
                                />
                                <IconButton
                                  aria-label={t('common.increase')}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cart.setQty(l.id, l.qty + 1)}
                                >
                                  <Plus size={16} />
                                </IconButton>
                              </HStack>
                            </Table.Cell>
                            <Table.Cell
                              textAlign="end"
                              fontWeight="bold"
                              whiteSpace="nowrap"
                              color={isReturn ? 'red.600' : undefined}
                            >
                              {money(l.qty * l.unitPrice)}
                            </Table.Cell>
                            <Table.Cell>
                              <HStack gap={1} justify="flex-end">
                                <IconButton
                                  aria-label={t('pos.editPrice')}
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setPriceLine(l)
                                    setPriceText(String(fromMinor(l.unitPrice)))
                                  }}
                                >
                                  <Pencil size={16} />
                                </IconButton>
                                <IconButton
                                  aria-label={
                                    isReturn ? t('pos.undoReturn') : t('pos.returnLine')
                                  }
                                  size="sm"
                                  variant="ghost"
                                  colorPalette={isReturn ? 'gray' : 'orange'}
                                  onClick={() => cart.toggleReturn(l.id)}
                                >
                                  <Undo2 size={16} />
                                </IconButton>
                                <IconButton
                                  aria-label={t('common.remove')}
                                  size="sm"
                                  variant="ghost"
                                  colorPalette="red"
                                  onClick={() => cart.removeLine(l.id)}
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              </HStack>
                            </Table.Cell>
                          </Table.Row>
                        )
                      })}
                    </Table.Body>
                  </Table.Root>
                </Box>
              )}
            </Card.Body>
          </Card.Root>

          <HStack gap={2} color="fg.subtle" fontSize="sm" wrap="wrap">
            <Keyboard size={16} />
            <Text>{t('pos.shortcutPay')}</Text>
            <Text>·</Text>
            <Text>{t('pos.shortcutPark')}</Text>
            <Text>·</Text>
            <Text>{t('pos.shortcutMisc')}</Text>
            <Text>·</Text>
            <Text>{t('pos.shortcutSearch')}</Text>
          </HStack>
        </Stack>

        {/* ---------------- Right: totals + actions ---------------- */}
        <Stack gap={4} position={{ xl: 'sticky' }} top={4} minW={0}>
          <Card.Root>
            <Card.Body>
              <Flex justify="space-between" color="fg.muted">
                <Text>{cart.itemCount}</Text>
                <Text>{t('pos.items')}</Text>
              </Flex>

              {cart.discount > 0 && (
                <>
                  <Separator my={3} />
                  <Flex justify="space-between">
                    <Text color="fg.muted">{t('pos.subtotal')}</Text>
                    <Text>{money(cart.subtotal)}</Text>
                  </Flex>
                  <Flex justify="space-between" color="orange.600">
                    <Text>{t('pos.discount')}</Text>
                    <Text fontWeight="semibold">-{money(cart.discount)}</Text>
                  </Flex>
                </>
              )}

              <Separator my={3} />
              <Text color="fg.muted">{isRefund ? t('pos.refundTotal') : t('pos.total')}</Text>
              <Heading size="4xl" color={isRefund ? 'red.600' : 'brand.fg'} truncate>
                {money(Math.abs(cart.total))}
              </Heading>

              {saveError && (
                <Alert.Root status="error" mt={4}>
                  <Alert.Indicator>
                    <AlertTriangle size={20} />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>{saveError}</Alert.Title>
                  </Alert.Content>
                </Alert.Root>
              )}

              <Stack gap={3} mt={5}>
                <Button
                  size="xl"
                  colorPalette="green"
                  disabled={!canSettle}
                  onClick={() => openPay('cash')}
                >
                  {isRefund ? t('pos.refundButton') : t('pos.pay')} · F2
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  colorPalette="green"
                  disabled={!canSettle || isRefund}
                  onClick={() => finish('paid', cart.total, cart.total, null)}
                >
                  {t('pos.payExact')}
                </Button>
                <HStack gap={2}>
                  <Button
                    flex="1"
                    size="lg"
                    colorPalette="orange"
                    variant="subtle"
                    disabled={!canSettle || cart.total <= 0}
                    onClick={() => openPay('partial')}
                  >
                    {t('pos.partial')}
                  </Button>
                  <Button
                    flex="1"
                    size="lg"
                    colorPalette="red"
                    variant="subtle"
                    disabled={!canSettle || cart.total <= 0}
                    onClick={() => openPay('credit')}
                  >
                    {t('pos.credit')}
                  </Button>
                </HStack>
              </Stack>

              <HStack mt={4} gap={2}>
                <Button
                  flex="1"
                  variant="outline"
                  disabled={cart.lines.length === 0}
                  onClick={() => {
                    setDiscountText(cart.discount ? String(fromMinor(cart.discount)) : '')
                    setDiscountOpen(true)
                  }}
                >
                  <Percent size={18} />
                  {t('pos.discount')}
                </Button>
                <Button
                  flex="1"
                  variant="outline"
                  disabled={cart.lines.length === 0}
                  onClick={() => cart.park(`${cart.itemCount} ${t('pos.items')}`)}
                >
                  <PauseCircle size={18} />
                  {t('pos.park')}
                </Button>
                <IconButton
                  aria-label={t('pos.clear')}
                  variant="ghost"
                  colorPalette="red"
                  disabled={cart.lines.length === 0}
                  onClick={() => {
                    if (window.confirm(t('pos.clearConfirm'))) cart.clear()
                  }}
                >
                  <Trash2 size={18} />
                </IconButton>
              </HStack>
            </Card.Body>
          </Card.Root>

          {cart.parked.length > 0 && (
            <Card.Root>
              <Card.Body>
                <Text fontWeight="bold" mb={2}>
                  {t('pos.parked')}
                </Text>
                <Stack gap={2}>
                  {cart.parked.map((s) => (
                    <Flex key={s.id} align="center" gap={2}>
                      <Button
                        flex="1"
                        variant="outline"
                        justifyContent="flex-start"
                        onClick={() => cart.resume(s.id)}
                      >
                        <PlayCircle size={18} />
                        {s.label}
                      </Button>
                      <IconButton
                        aria-label={t('common.delete')}
                        variant="ghost"
                        colorPalette="red"
                        onClick={() => cart.dropParked(s.id)}
                      >
                        <X size={16} />
                      </IconButton>
                    </Flex>
                  ))}
                </Stack>
              </Card.Body>
            </Card.Root>
          )}
        </Stack>
      </Grid>

      {/* ---------------- Ambiguous scan: choose the product ---------------- */}
      <Dialog.Root scrollBehavior="inside" open={!!matches} onOpenChange={(e) => !e.open && setMatches(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxH="92dvh">
              <Dialog.Header>
                <Dialog.Title>{t('pos.chooseProduct')}</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                    <X size={18} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body overflowY="auto">
                <Stack gap={2}>
                  {matches?.map((p) => (
                    <Button
                      key={p.id}
                      size="xl"
                      variant="outline"
                      justifyContent="space-between"
                      onClick={() => chooseMatch(p)}
                    >
                      <Text truncate>{p.name}</Text>
                      <HStack gap={3} flexShrink={0}>
                        <Text color="fg.muted" fontSize="sm">
                          {p.quantity} {t('stock.units')}
                        </Text>
                        <Text fontWeight="bold">{money(p.salePrice)}</Text>
                      </HStack>
                    </Button>
                  ))}
                </Stack>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Create a product from the till ---------------- */}
      <Dialog.Root scrollBehavior="inside" open={newOpen} onOpenChange={(e) => setNewOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{t('stock.addProduct')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap={4}>
                  <Field.Root required invalid={!!newError}>
                    <Field.Label>{t('stock.name')}</Field.Label>
                    <Input
                      size="lg"
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t('stock.namePlaceholder')}
                    />
                    <Field.ErrorText>{newError}</Field.ErrorText>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>{t('stock.barcode')}</Field.Label>
                    <Input
                      size="lg"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      inputMode="numeric"
                    />
                  </Field.Root>
                  <HStack gap={4} align="flex-start">
                    <Field.Root>
                      <Field.Label>{`${t('stock.salePrice')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        inputMode="decimal"
                        placeholder="0.000"
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>{`${t('stock.costPrice')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        value={newCost}
                        onChange={(e) => setNewCost(e.target.value)}
                        inputMode="decimal"
                        placeholder="0.000"
                      />
                    </Field.Root>
                  </HStack>
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setNewOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  loading={busy}
                  onClick={saveNewProduct}
                >
                  {t('common.save')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Free line ---------------- */}
      <Dialog.Root scrollBehavior="inside" open={miscOpen} onOpenChange={(e) => setMiscOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{t('pos.addMisc')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap={4}>
                  <Text color="fg.muted">{t('pos.miscHint')}</Text>
                  <Field.Root required>
                    <Field.Label>{t('pos.miscName')}</Field.Label>
                    <Input
                      size="lg"
                      autoFocus
                      value={miscName}
                      onChange={(e) => setMiscName(e.target.value)}
                    />
                  </Field.Root>
                  <Field.Root required>
                    <Field.Label>{`${t('pos.miscPrice')} (${symbol})`}</Field.Label>
                    <Input
                      size="lg"
                      value={miscPrice}
                      onChange={(e) => setMiscPrice(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.000"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addMisc()
                        }
                      }}
                    />
                  </Field.Root>
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setMiscOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button size="lg" colorPalette="brand" onClick={addMisc}>
                  {t('common.add')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Change one line's price ---------------- */}
      <Dialog.Root scrollBehavior="inside" open={!!priceLine} onOpenChange={(e) => !e.open && setPriceLine(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{t('pos.editPrice')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Field.Root>
                  <Field.Label>
                    {priceLine?.name} ({symbol})
                  </Field.Label>
                  <Input
                    size="xl"
                    autoFocus
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    inputMode="decimal"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const v = parseMoney(priceText)
                        if (priceLine && v !== null) cart.setPrice(priceLine.id, v)
                        setPriceLine(null)
                      }
                    }}
                  />
                </Field.Root>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setPriceLine(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  onClick={() => {
                    const v = parseMoney(priceText)
                    if (priceLine && v !== null) cart.setPrice(priceLine.id, v)
                    setPriceLine(null)
                  }}
                >
                  {t('common.save')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Ticket discount ---------------- */}
      <Dialog.Root scrollBehavior="inside" open={discountOpen} onOpenChange={(e) => setDiscountOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{t('pos.discountOnTotal')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Field.Root>
                  <Field.Label>{`${t('pos.discount')} (${symbol})`}</Field.Label>
                  <Input
                    size="xl"
                    autoFocus
                    value={discountText}
                    onChange={(e) => setDiscountText(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.000"
                  />
                  <Field.HelperText>{money(cart.subtotal)}</Field.HelperText>
                </Field.Root>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    cart.setDiscount(0)
                    setDiscountOpen(false)
                  }}
                >
                  {t('pos.noDiscount')}
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  onClick={() => {
                    cart.setDiscount(parseMoney(discountText) ?? 0)
                    setDiscountOpen(false)
                  }}
                >
                  {t('common.apply')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Settlement ---------------- */}
      <Dialog.Root scrollBehavior="inside" open={payOpen} onOpenChange={(e) => setPayOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxH="92dvh">
              <Dialog.Header>
                <Dialog.Title>
                  {payKind === 'cash'
                    ? t('pos.pay')
                    : payKind === 'credit'
                      ? t('pos.credit')
                      : t('pos.partial')}
                </Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                    <X size={18} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>

              <Dialog.Body overflowY="auto">
                <Stack gap={4}>
                  <Flex justify="space-between" align="baseline">
                    <Text color="fg.muted" fontSize="lg">
                      {isRefund ? t('pos.refundTotal') : t('pos.total')}
                    </Text>
                    <Heading size="2xl" color={isRefund ? 'red.600' : 'brand.fg'}>
                      {money(Math.abs(cart.total))}
                    </Heading>
                  </Flex>

                  {payKind !== 'cash' && (
                    <Field.Root invalid={!!payError && !customerId}>
                      <Field.Label>{t('pos.client')}</Field.Label>
                      <ClientPicker
                        customers={customers}
                        value={customerId}
                        onChange={(id) => {
                          setCustomerId(id)
                          setPayError('')
                        }}
                        searchLabel={t('pos.searchClient')}
                        symbol={symbol}
                      />
                      <Field.ErrorText>{payError}</Field.ErrorText>
                    </Field.Root>
                  )}

                  {payKind !== 'credit' && !isRefund && (
                    <Field.Root>
                      <Field.Label>
                        {payKind === 'cash'
                          ? `${t('pos.amountGiven')} (${symbol})`
                          : `${t('pos.amountReceived')} (${symbol})`}
                      </Field.Label>
                      <Input
                        size="xl"
                        autoFocus={payKind === 'cash'}
                        inputMode="decimal"
                        placeholder={
                          payKind === 'cash' ? t('pos.payExact') : '0.000'
                        }
                        value={received}
                        onChange={(e) => {
                          setReceived(e.target.value)
                          setPayError('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void confirmPay()
                          }
                        }}
                      />
                      {quickCash.length > 0 && payKind === 'cash' && (
                        <HStack gap={2} mt={2} wrap="wrap">
                          <Button
                            size="lg"
                            variant="subtle"
                            onClick={() => setReceived(String(fromMinor(cart.total)))}
                          >
                            {t('pos.payExact')}
                          </Button>
                          {quickCash.map((v) => (
                            <Button
                              key={v}
                              size="lg"
                              variant="outline"
                              onClick={() => setReceived(String(fromMinor(v)))}
                            >
                              {money(v)}
                            </Button>
                          ))}
                        </HStack>
                      )}
                    </Field.Root>
                  )}

                  <Separator />

                  {payKind === 'cash' && !isRefund && (
                    <Flex justify="space-between" align="baseline">
                      <Text color="fg.muted" fontSize="lg">
                        {t('pos.change')}
                      </Text>
                      <Heading size="3xl" color="green.600">
                        {money(changeDue)}
                      </Heading>
                    </Flex>
                  )}

                  {payKind !== 'cash' && (
                    <Flex justify="space-between">
                      <Text color="fg.muted">{t('pos.remaining')}</Text>
                      <Text fontWeight="bold" fontSize="xl" color="red.600">
                        {money(payKind === 'credit' ? cart.total : remainingAfter)}
                      </Text>
                    </Flex>
                  )}
                </Stack>
              </Dialog.Body>

              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setPayOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  loading={busy}
                  onClick={confirmPay}
                >
                  {t('pos.confirm')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Ticket after a sale ---------------- */}
      <Dialog.Root scrollBehavior="inside" open={!!ticket} onOpenChange={(e) => !e.open && setTicket(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {t('pos.saved')} — {ticket?.ticketNo}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {ticket && (
                  <Stack gap={2}>
                    <Flex justify="space-between">
                      <Text color="fg.muted">{t('pos.total')}</Text>
                      <Text fontWeight="bold">{money(ticket.total)}</Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text color="fg.muted">{t('pos.paidLabel')}</Text>
                      <Text>{money(ticket.paid)}</Text>
                    </Flex>
                    {ticket.received > ticket.total && (
                      <Flex justify="space-between" fontSize="xl">
                        <Text color="fg.muted">{t('pos.change')}</Text>
                        <Text fontWeight="bold" color="green.600">
                          {money(ticket.received - ticket.total)}
                        </Text>
                      </Flex>
                    )}
                    {ticket.total - ticket.paid > 0 && (
                      <Flex justify="space-between">
                        <Text color="fg.muted">{t('pos.creditLabel')}</Text>
                        <Text fontWeight="bold" color="red.600">
                          {money(ticket.total - ticket.paid)}
                        </Text>
                      </Flex>
                    )}
                  </Stack>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => doPrint('thermal')}>
                  <Printer size={18} />
                  80mm
                </Button>
                <Button size="lg" variant="outline" onClick={() => doPrint('a4')}>
                  <Printer size={18} />
                  A4
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  onClick={() => {
                    setTicket(null)
                    focusScan()
                  }}
                >
                  {t('pos.newTicket')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Hidden on screen; revealed by the print stylesheet */}
      {ticket && <Ticket data={ticket} shop={shop} symbol={symbol} paper={paper} />}
    </Box>
  )
}
