import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Badge,
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  HStack,
  IconButton,
  Input,
  NativeSelect,
  Portal,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { HandCoins, Minus, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import dayjs from 'dayjs'
import { useAlive } from '@/lib/useAlive'
import {
  formatMoney,
  moneyPlaceholder,
  moneySymbolKey,
  parseMoney,
  parseQuantity,
  toInput,
} from '@/lib/money'
import { formatDateTime } from '@/lib/format'
import { ProductSearch } from '@/features/invoices/ProductSearch'
import { useCustomers } from '@/features/customers/useCustomers'
import { useProducts, isLiveProduct } from '@/features/stock/useProducts'
import {
  updateSale,
  voidSale,
  paymentModeOf,
  SaleLedgerUnreadableError,
  CustomerMissingError,
} from './useSales'
import type { SaleEdit } from './useSales'
import type { CreditEntry, Product, Sale, SaleItem } from '@/types/models'

/**
 * One line of the ticket while it is being corrected.
 *
 * Keyed by INDEX, not by product: a pack is stored as one line per article at
 * an apportioned price, the same article can sit on a sale line and a return
 * line of the same ticket, and a free "article divers" has no product at all.
 * NewSaleInvoice keys its lines by product because it only ever creates them;
 * an editor has to keep what it was handed.
 *
 * `sign` carries the return: the owner edits the quantity he can see and the
 * line stays a return, rather than being asked to type a minus sign.
 */
interface EditLine {
  name: string
  productId: string | null
  sign: 1 | -1
  qtyStr: string
  priceStr: string
  unitCost: number
}

/**
 * The stamp a chosen day becomes. Same day → the ticket's exact original
 * time (so it keeps its place among that day's tickets); another day → that
 * day at the original time-of-day. Never midnight: on a list sorted by date,
 * midnight files the ticket before everything that happened that day.
 */
function stampFor(dateStr: string, original: number): number {
  const d = dayjs(dateStr)
  if (!d.isValid()) return original
  const t = dayjs(original)
  if (d.isSame(t, 'day')) return original
  return d.hour(t.hour()).minute(t.minute()).second(t.second()).millisecond(0).valueOf()
}

/**
 * CORRECTING A TICKET THAT HAS ALREADY BEEN RUNG UP.
 *
 * A sibling of NewSaleInvoice, deliberately not a generalisation of it: that
 * form creates, and creating is simpler — one line per product, quantities
 * floored at one, no discount, no returns, no date, and a paid figure that
 * follows the total until touched. Every one of those is the wrong seed for a
 * ticket that already exists.
 *
 * `intent: 'toCredit'` is the "Mettre sur le carnet de…" button: the same
 * editor, with the paid figure emptied and the client picker put in front of
 * the owner. It is not a separate flow because it is not a separate change —
 * paid goes from the total to zero and a client is named; updateSale does the
 * rest exactly as for any other correction.
 *
 * `knownEntry` is passed by the client's page, which already holds the live
 * carnet line; anywhere else it is left undefined and updateSale goes to look.
 */
export function SaleEditor({
  sale,
  intent = 'edit',
  knownEntry,
  onClose,
  onSaved,
}: {
  sale: Sale
  intent?: 'edit' | 'toCredit'
  knownEntry?: CreditEntry | null
  onClose: () => void
  onSaved?: (kind: 'updated' | 'voided') => void
}) {
  const { t } = useTranslation()
  const alive = useAlive()
  const { customers, loading: customersLoading } = useCustomers()
  // Subscribed so the resident list is warm: isLiveProduct answers from it, and
  // a save while it is cold would write a counter update to a product this tab
  // has never heard of — which, if the product is gone, refuses the whole batch.
  useProducts()
  const symbol = t(moneySymbolKey())
  const money = (m: number) => formatMoney(m, { symbol })

  const toCredit = intent === 'toCredit'

  const [lines, setLines] = useState<EditLine[]>(() =>
    sale.items.map((it) => ({
      name: it.name,
      productId: it.productId,
      sign: it.qty < 0 ? -1 : 1,
      qtyStr: String(Math.abs(it.qty)),
      // `|| '0'`, because toInput() renders zero as an EMPTY STRING. A line
      // that costs nothing would otherwise open with a blank price box, which
      // reads as "somebody forgot to type it" rather than "this one is free".
      priceStr: toInput(it.unitPrice) || '0',
      unitCost: it.unitCost,
    })),
  )
  const [discountStr, setDiscountStr] = useState(() =>
    (sale.discount ?? 0) > 0 ? toInput(sale.discount ?? 0) : '',
  )
  const [paidStr, setPaidStr] = useState(() => (toCredit ? '' : toInput(sale.paid)))
  const [customerId, setCustomerId] = useState(sale.customerId ?? '')
  const [dateStr, setDateStr] = useState(() => dayjs(sale.date).format('YYYY-MM-DD'))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const customerRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (toCredit) setTimeout(() => customerRef.current?.focus(), 60)
  }, [toCredit])

  // --- arithmetic -----------------------------------------------------------

  const qtyOf = (l: EditLine) => parseQuantity(l.qtyStr)

  /**
   * A PRICE OF ZERO IS A PRICE, and this is what stopped the whole feature
   * working.
   *
   * toInput() renders 0 as '' and parseMoney() reads '' as "no answer", so
   * every line that costs nothing — a gift with a pack, a free article divers,
   * the 0,000 DT articles the till used to be able to create — came back as
   * null, was reported "Prix invalide", and refused the save. Nothing the owner
   * could do on that screen fixed it; the only way past was to delete the line,
   * which is the opposite of correcting the ticket.
   *
   * So: an empty box means zero. Only text that is not a number at all is
   * invalid, which is the case worth refusing — a mistyped price saved as zero
   * would quietly turn a sale into a giveaway.
   */
  const priceOf = (l: EditLine): number | null =>
    l.priceStr.trim() === '' ? 0 : parseMoney(l.priceStr)
  const signedQty = (l: EditLine) => (qtyOf(l) ?? 0) * l.sign
  const lineMinor = (l: EditLine) => signedQty(l) * (priceOf(l) ?? 0)

  const subtotal = lines.reduce((s, l) => s + lineMinor(l), 0)
  const discount = subtotal > 0 ? Math.min(Math.max(0, parseMoney(discountStr) ?? 0), subtotal) : 0
  const total = subtotal - discount
  // A pure refund has nothing to pay: the paid figure is the total, hidden.
  const refund = total <= 0
  const paid = refund ? total : Math.min(Math.max(0, parseMoney(paidStr) ?? 0), total)
  const remaining = Math.max(0, total - paid)
  const mode = paymentModeOf(total, paid)

  const customer = customers.find((c) => c.id === customerId)
  // The ticket names a client this list no longer has: he was deleted after
  // it was rung up. Shown so the owner knows who it WAS, and blocked when
  // there is money to put on his account, because there is no account.
  const customerGone =
    !customersLoading && customerId !== '' && customer === undefined
  const customerGoneName = customerGone ? sale.customerName ?? customerId : ''

  const lineProblems = lines.map((l) => {
    const q = qtyOf(l)
    const p = priceOf(l)
    if (q === null || q <= 0) return t('sales.qtyInvalid')
    if (p === null || p < 0) return t('sales.priceInvalid')
    return ''
  })
  const discountTooBig = subtotal > 0 && (parseMoney(discountStr) ?? 0) > subtotal
  const paidTooBig = !refund && (parseMoney(paidStr) ?? 0) > total
  /*
    Typed, but not a number — "2O" with a letter O, say.

    Both of these fall back to 0 in the arithmetic above, and for the paid box
    that silence is expensive: a mistyped amount would turn a ticket the client
    paid in full into a debt on his carnet, and the only sign of it would be
    the carnet line appearing. Worth a refusal, not a fallback.
  */
  const discountInvalid = discountStr.trim() !== '' && parseMoney(discountStr) === null
  const paidInvalid = !refund && paidStr.trim() !== '' && parseMoney(paidStr) === null

  // --- line edits -------------------------------------------------------------

  const patchLine = (i: number, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l, k) => (k === i ? { ...l, ...patch } : l)))

  const bump = (i: number, delta: number) => {
    const l = lines[i]
    const next = Math.max(1, (qtyOf(l) ?? 0) + delta)
    patchLine(i, { qtyStr: String(next) })
  }

  const removeLine = (i: number) => {
    if (lines.length <= 1) {
      setError(t('sales.keepOneLine'))
      return
    }
    setError('')
    setLines((prev) => prev.filter((_, k) => k !== i))
  }

  /**
   * A forgotten article. The same product on an existing sale line is simply
   * one more of it; anything else is a new line at today's shelf price and
   * today's cost — the ticket is being corrected today, and the owner can
   * still type the price that was actually agreed.
   */
  const addProduct = (p: Product) => {
    setError('')
    setLines((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id && l.sign === 1)
      if (i >= 0) {
        const cur = parseQuantity(prev[i].qtyStr) ?? 0
        return prev.map((l, k) => (k === i ? { ...l, qtyStr: String(cur + 1) } : l))
      }
      return [
        ...prev,
        {
          name: p.name,
          productId: p.id,
          sign: 1,
          qtyStr: '1',
          priceStr: toInput(p.salePrice),
          unitCost: p.costPrice,
        },
      ]
    })
  }

  // --- save / void ------------------------------------------------------------

  const buildEdit = (): SaleEdit => ({
    items: lines.map(
      (l): SaleItem => ({
        productId: l.productId,
        name: l.name,
        qty: signedQty(l),
        unitPrice: priceOf(l) ?? 0,
        unitCost: l.unitCost,
      }),
    ),
    subtotal,
    discount,
    total,
    paid,
    customerId: customerId || null,
    customerName: customer?.name ?? (customerId ? sale.customerName ?? null : null),
    date: stampFor(dateStr, sale.date),
  })

  const failWith = (e: unknown) => {
    if (e instanceof SaleLedgerUnreadableError) return t('sales.ledgerUnreadable')
    if (e instanceof CustomerMissingError) return t('sales.customerGone')
    return e instanceof Error ? e.message : t('pos.saveFailed')
  }

  const save = async () => {
    if (submitting.current) return
    setError('')
    if (lineProblems.some(Boolean)) {
      setError(lineProblems.find(Boolean) ?? '')
      return
    }
    if (discountInvalid || paidInvalid) {
      setError(t('sales.amountInvalid'))
      return
    }
    if (discountTooBig) {
      setError(t('sales.discountTooBig'))
      return
    }
    if (paidTooBig) {
      setError(t('sales.paidTooBig'))
      return
    }
    if (remaining > 0 && !customerId) {
      setError(t('sales.needCustomer'))
      return
    }
    if (remaining > 0 && customerGone) {
      setError(t('sales.customerGone'))
      return
    }
    submitting.current = true
    setBusy(true)
    try {
      await updateSale(sale, buildEdit(), { knownEntry })
      if (!alive.current) return
      onSaved?.('updated')
      onClose()
    } catch (e) {
      if (alive.current) setError(failWith(e))
    } finally {
      submitting.current = false
      if (alive.current) setBusy(false)
    }
  }

  const doVoid = async () => {
    if (submitting.current) return
    if (!window.confirm(t('sales.voidConfirm', { ref: sale.ticketNo }))) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      await voidSale(sale, { knownEntry })
      if (!alive.current) return
      onSaved?.('voided')
      onClose()
    } catch (e) {
      if (alive.current) setError(failWith(e))
    } finally {
      submitting.current = false
      if (alive.current) setBusy(false)
    }
  }

  /*
    Only the client picker needs the customers list, and `customerGone` already
    holds its tongue while it is loading. The products list is subscribed for
    isLiveProduct's benefit, not the form's — disabling Save on it meant a
    listener that was slow to warm (or that had given up) left the owner with a
    dead button and no explanation.
  */
  const loading = customersLoading

  return (
    <Dialog.Root
      open
      onOpenChange={(e) => !e.open && !busy && onClose()}
      size="xl"
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <HStack gap={3}>
                <Box
                  bg={toCredit ? 'orange.subtle' : 'brand.subtle'}
                  color={toCredit ? 'orange.fg' : 'brand.fg'}
                  p={2}
                  borderRadius="lg"
                >
                  {toCredit ? <HandCoins size={22} /> : <Pencil size={22} />}
                </Box>
                <Box minW={0}>
                  <Dialog.Title>
                    {toCredit ? t('sales.putOnCarnet') : t('sales.editTicket')}
                  </Dialog.Title>
                  <Text fontSize="sm" color="fg.muted">
                    {t('sales.ticketRef', { ref: sale.ticketNo })} · {formatDateTime(sale.date)}
                  </Text>
                </Box>
              </HStack>
            </Dialog.Header>

            <Dialog.Body>
              <Stack gap={4}>
                <Alert.Root status="info" variant="subtle">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{t('sales.editHint')}</Alert.Title>
                    {toCredit && <Alert.Description>{t('sales.wasPaid')}</Alert.Description>}
                  </Alert.Content>
                </Alert.Root>

                {/* ---- the lines ------------------------------------------ */}
                <Stack gap={2}>
                  {lines.map((l, i) => {
                    const gone = l.productId !== null && isLiveProduct(l.productId) === false
                    const problem = lineProblems[i]
                    return (
                      <Flex
                        key={i}
                        wrap="wrap"
                        align="center"
                        gap={3}
                        p={3}
                        borderWidth="1px"
                        borderColor={problem ? 'red.emphasized' : 'border'}
                        borderRadius="xl"
                        bg={l.sign < 0 ? 'red.subtle' : undefined}
                      >
                        <Box flex="1" minW="8rem">
                          <HStack gap={2} wrap="wrap">
                            <Text fontWeight="semibold">{l.name}</Text>
                            {l.sign < 0 && (
                              <Badge colorPalette="red" size="sm">
                                {t('pos.return')}
                              </Badge>
                            )}
                            {l.productId === null && (
                              <Badge colorPalette="gray" size="sm">
                                {t('pos.misc')}
                              </Badge>
                            )}
                            {gone && (
                              <Badge colorPalette="orange" size="sm" title={t('sales.productGone')}>
                                {t('sales.productGoneShort')}
                              </Badge>
                            )}
                          </HStack>
                          <Text fontSize="sm" color={problem ? 'red.fg' : 'fg.muted'}>
                            {problem || money(lineMinor(l))}
                          </Text>
                        </Box>

                        <Input
                          size="lg"
                          w="7rem"
                          textAlign="center"
                          value={l.priceStr}
                          onChange={(e) => patchLine(i, { priceStr: e.target.value })}
                          inputMode="decimal"
                          placeholder={moneyPlaceholder()}
                          aria-label={t('sales.unitPrice')}
                        />

                        <HStack gap={0} borderWidth="2px" borderColor="border" borderRadius="xl">
                          <IconButton
                            aria-label={t('common.decrease')}
                            variant="ghost"
                            size="lg"
                            onClick={() => bump(i, -1)}
                          >
                            <Minus size={18} />
                          </IconButton>
                          <Input
                            w="3.5rem"
                            size="lg"
                            variant="subtle"
                            textAlign="center"
                            fontWeight="semibold"
                            inputMode="numeric"
                            value={l.qtyStr}
                            onChange={(e) => patchLine(i, { qtyStr: e.target.value })}
                            aria-label={t('stock.quantity')}
                          />
                          <IconButton
                            aria-label={t('common.increase')}
                            variant="ghost"
                            size="lg"
                            onClick={() => bump(i, 1)}
                          >
                            <Plus size={18} />
                          </IconButton>
                        </HStack>

                        <IconButton
                          aria-label={t('sales.removeLine')}
                          title={t('sales.removeLine')}
                          variant="ghost"
                          colorPalette="red"
                          size="lg"
                          onClick={() => removeLine(i)}
                        >
                          <Trash2 size={20} />
                        </IconButton>
                      </Flex>
                    )
                  })}
                </Stack>

                {/* ---- a forgotten article ------------------------------- */}
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" color="fg.muted" mb={1}>
                    {t('sales.addProduct')}
                  </Text>
                  <ProductSearch onPick={addProduct} placeholder={t('sales.searchProduct')} />
                </Box>

                {/* ---- money ------------------------------------------------ */}
                <SimpleGrid columns={{ base: 1, sm: 3 }} gap={3}>
                  <Field.Root invalid={discountTooBig || discountInvalid}>
                    <Field.Label>{`${t('pos.discount')} (${symbol})`}</Field.Label>
                    <Input
                      size="lg"
                      inputMode="decimal"
                      value={discountStr}
                      onChange={(e) => setDiscountStr(e.target.value)}
                      placeholder={moneyPlaceholder()}
                      disabled={subtotal <= 0}
                    />
                    <Field.ErrorText>
                      {discountInvalid ? t('sales.amountInvalid') : t('sales.discountTooBig')}
                    </Field.ErrorText>
                  </Field.Root>

                  {!refund && (
                    <Field.Root invalid={paidTooBig || paidInvalid}>
                      <Field.Label>{`${t('pos.paidAtCounter')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        inputMode="decimal"
                        value={paidStr}
                        onChange={(e) => setPaidStr(e.target.value)}
                        placeholder={moneyPlaceholder()}
                        fontWeight={toCredit ? 'bold' : undefined}
                      />
                      <Field.ErrorText>
                        {paidInvalid ? t('sales.amountInvalid') : t('sales.paidTooBig')}
                      </Field.ErrorText>
                      {!paidTooBig && !paidInvalid && (
                        <Field.HelperText>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setPaidStr(toInput(total))}
                          >
                            {t('pos.payExact')}
                          </Button>
                        </Field.HelperText>
                      )}
                    </Field.Root>
                  )}

                  <Field.Root>
                    <Field.Label>{t('sales.date')}</Field.Label>
                    <Input
                      size="lg"
                      type="date"
                      value={dateStr}
                      max={dayjs().format('YYYY-MM-DD')}
                      onChange={(e) => setDateStr(e.target.value)}
                    />
                  </Field.Root>
                </SimpleGrid>

                {/* ---- the client ------------------------------------------ */}
                <Field.Root invalid={remaining > 0 && (!customerId || customerGone)}>
                  <Field.Label fontSize="lg">{t('sales.customer')}</Field.Label>
                  <NativeSelect.Root size="lg">
                    <NativeSelect.Field
                      ref={customerRef}
                      value={customerId}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setCustomerId(e.currentTarget.value)
                        setError('')
                      }}
                    >
                      <option value="">{t('sales.selectCustomer')}</option>
                      {customerGone && (
                        <option value={customerId} disabled>
                          {t('sales.customerGoneOption', { name: customerGoneName })}
                        </option>
                      )}
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  {remaining > 0 ? (
                    <Field.ErrorText>
                      {customerGone ? t('sales.customerGone') : t('sales.needCustomer')}
                    </Field.ErrorText>
                  ) : (
                    <Field.HelperText>{t('common.optional')}</Field.HelperText>
                  )}
                </Field.Root>

                {/* ---- totals --------------------------------------------- */}
                <Box borderTopWidth="1px" borderColor="border" pt={3}>
                  {discount > 0 && (
                    <Flex justify="space-between" color="fg.muted">
                      <Text>{t('pos.subtotal')}</Text>
                      <Text>{money(subtotal)}</Text>
                    </Flex>
                  )}
                  <Flex justify="space-between" align="baseline">
                    <Text fontSize="lg" fontWeight="semibold">
                      {refund ? t('pos.refundTotal') : t('pos.ticketTotal')}
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold" color={refund ? 'red.600' : 'brand.fg'}>
                      {money(Math.abs(total))}
                    </Text>
                  </Flex>
                  {!refund && (
                    <Flex justify="space-between" mt={1}>
                      <Text color="fg.muted">{t('credit.putOnAccount')}</Text>
                      <Text fontWeight="bold" color={remaining > 0 ? 'red.600' : 'green.600'}>
                        {remaining > 0
                          ? `${money(remaining)}${customer ? ` · ${customer.name}` : ''}`
                          : t('sales.paid')}
                      </Text>
                    </Flex>
                  )}
                  <Text fontSize="sm" color="fg.muted" mt={1}>
                    {mode === 'paid' ? t('sales.paid') : mode === 'partial' ? t('pos.partialShort') : t('sales.credit')}
                  </Text>
                </Box>

                {error && (
                  <Alert.Root status="error">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{error}</Alert.Title>
                    </Alert.Content>
                  </Alert.Root>
                )}
              </Stack>
            </Dialog.Body>

            <Dialog.Footer justifyContent="space-between" gap={3}>
              <Button
                size="lg"
                variant="ghost"
                colorPalette="red"
                onClick={() => void doVoid()}
                disabled={busy}
              >
                <Undo2 size={18} />
                {t('sales.voidTicket')}
              </Button>
              <HStack gap={3}>
                <Button size="lg" variant="outline" onClick={onClose} disabled={busy}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="lg"
                  colorPalette={toCredit ? 'orange' : 'brand'}
                  onClick={() => void save()}
                  loading={busy}
                  loadingText={t('common.saving')}
                  disabled={loading}
                  title={loading ? t('common.loading') : undefined}
                >
                  {t('sales.saveChanges')}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

