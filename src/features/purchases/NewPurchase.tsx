import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import {
  Box,
  Stack,
  Flex,
  HStack,
  SimpleGrid,
  Text,
  Button,
  IconButton,
  Input,
  Field,
  NativeSelect,
  Dialog,
  Portal,
  Alert,
  EmptyState,
} from '@chakra-ui/react'
import { Trash2, Truck, PackageOpen, X } from 'lucide-react'
import { formatMoney, parseMoney, fromMinor, moneySymbolKey } from '@/lib/money'
import { useAlive } from '@/lib/useAlive'
import { useProducts } from '@/features/stock/useProducts'
import { ProductForm } from '@/features/stock/ProductForm'
import { looksLikeCode } from '@/features/stock/barcode'
import { readCount, countMessage, MAX_UNITS } from '@/features/stock/quantity'
import { useSuppliers, createSupplier } from '@/features/suppliers/useSuppliers'
import { recordPurchase, DuplicatePurchaseError } from './usePurchases'
import { PurchaseSearch } from './PurchaseSearch'
import { MoneyInput } from '@/components/MoneyInput'
import { QuantityInput } from '@/components/QuantityInput'
import { SimilarRecords } from '@/components/SimilarRecords'
import { findSimilar } from '@/lib/similar'
import { fold } from '@/lib/textIndex'
import type { Product } from '@/types/models'

interface CartItem {
  productId: string
  name: string
  /** As typed: a delivery of 200 is typed, not reached with 199 clicks on +. */
  qtyStr: string
  costStr: string // dinars, editable
}

/** Units on a line, or 0 while the text is not a usable count. */
const qtyOf = (i: CartItem) => readCount(i.qtyStr).value ?? 0

/** Sentinel option value that switches the supplier picker into free-text mode. */
const NEW_SUPPLIER = '__new__'

const DATE_FMT = 'YYYY-MM-DD'

export function NewPurchase({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const alive = useAlive()
  const { suppliers } = useSuppliers()
  const { products } = useProducts()
  const symbol = t(moneySymbolKey())
  const searchRef = useRef<HTMLInputElement>(null)
  /** Each line's quantity box, to put the cursor there after a scan. */
  const qtyRefs = useRef(new Map<string, HTMLInputElement>())
  /**
   * The article the owner is creating on the spot, from a code or a name that
   * found nothing. The delivery stays open underneath it.
   */
  const [creating, setCreating] = useState<string | null>(null)
  const createdLine = useRef(false)
  /**
   * A free-text field (supplier, reference, note) has the cursor. The scanner
   * hook borrows any field a fast burst lands in and puts it back, which is
   * right for a quantity box and wrong for a reference being typed.
   */
  const [freeText, setFreeText] = useState(false)
  const freeTextProps = {
    onFocus: () => setFreeText(true),
    onBlur: () => setFreeText(false),
  }
  const supplierNames = suppliers.map((s) => s.name)

  const [supplier, setSupplier] = useState('')
  const [typingSupplier, setTypingSupplier] = useState(false)
  const [reference, setReference] = useState('')
  const [dateStr, setDateStr] = useState(() => dayjs().format(DATE_FMT))
  const [note, setNote] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * Set when recordPurchase recognised this invoice as one entered moments ago.
   *
   * The second press of the button goes through, deliberately: two identical
   * deliveries inside ten minutes is unusual, not impossible, and the owner is
   * the one who knows which it is. What the guard removes is doing it BY
   * ACCIDENT — which doubles the stock as well as the paperwork, and leaves
   * nothing in the data to say which of the two invoices was the mistake.
   */
  const [duplicate, setDuplicate] = useState(false)

  /**
   * The amount handed over now. Until the owner touches it, it follows the
   * running total — paying the whole invoice is then a single click.
   */
  const [paidStr, setPaidStr] = useState('')
  const [paidTouched, setPaidTouched] = useState(false)

  /** Names already sent to createSupplier, so a second blur cannot duplicate them. */
  const createdRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    setSupplier('')
    setTypingSupplier(false)
    setReference('')
    setDateStr(dayjs().format(DATE_FMT))
    setNote('')
    setCart([])
    setPaidStr('')
    setPaidTouched(false)
    setError('')
    setBusy(false)
    setDuplicate(false)
    setCreating(null)
    setFreeText(false)
    createdRef.current = new Set()
  }, [open])

  /**
   * Scanning the same article again still adds one. Either way the cursor goes
   * to that line's quantity, text selected: scan, type 120, scan the next one.
   */
  const addLine = (productId: string, name: string, costPrice: number) => {
    setError('')
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId)
      if (existing)
        return prev.map((i) =>
          i.productId === productId
            ? { ...i, qtyStr: String(Math.min(MAX_UNITS, qtyOf(i) + 1)) }
            : i,
        )
      return [...prev, { productId, name, qtyStr: '1', costStr: String(fromMinor(costPrice)) }]
    })
    setTimeout(() => {
      const el = qtyRefs.current.get(productId)
      el?.focus()
      el?.select()
    }, 30)
  }
  const addProduct = (p: Product) => addLine(p.id, p.name, p.costPrice)
  const setQty = (id: string, qtyStr: string) =>
    setCart((prev) => prev.map((i) => (i.productId === id ? { ...i, qtyStr } : i)))
  const setCost = (id: string, costStr: string) =>
    setCart((prev) => prev.map((i) => (i.productId === id ? { ...i, costStr } : i)))
  const removeItem = (id: string) =>
    setCart((prev) => prev.filter((i) => i.productId !== id))

  const lineMinor = (i: CartItem) => qtyOf(i) * (parseMoney(i.costStr) ?? 0)
  const total = cart.reduce((s, i) => s + lineMinor(i), 0)

  // Untouched field mirrors the total; once edited it keeps what was typed.
  const paidValue = paidTouched ? paidStr : total > 0 ? String(fromMinor(total)) : ''
  const paidMinor = Math.min(parseMoney(paidValue) ?? 0, total)
  const owed = Math.max(0, total - paidMinor)

  const pickSupplier = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.currentTarget.value
    if (value === NEW_SUPPLIER) {
      adopted.current = false
      setTypingSupplier(true)
      setSupplier('')
    } else {
      setTypingSupplier(false)
      setSupplier(value)
    }
  }

  /** Existing suppliers that look like the name being typed. */
  const similarSuppliers = typingSupplier ? findSimilar(suppliers, supplier, '') : []
  /** Set once an existing supplier was picked, so a late blur creates nothing. */
  const adopted = useRef(false)
  const adoptSupplier = (name: string) => {
    adopted.current = true
    setTypingSupplier(false)
    setSupplier(name)
  }

  /** A freshly typed name is registered as a supplier once, on blur. */
  const commitNewSupplier = (e: FocusEvent<HTMLInputElement>) => {
    const name = e.currentTarget.value.trim()
    if (!name || adopted.current) return
    if (supplierNames.includes(name)) return
    // "sotupa" typed for the existing "Sotupa" is that supplier, not a second
    // one whose purchases would never add up with the first's.
    const same = suppliers.find((s) => fold(s.name) === fold(name))
    if (same) {
      adoptSupplier(same.name)
      return
    }
    if (createdRef.current.has(name)) return
    createdRef.current.add(name)
    // createSupplier is synchronous now (it no longer waits for the server),
    // so there is no promise to catch. Wrapped instead, because shopPath()
    // throws if no shop is selected.
    try {
      createSupplier({ name })
    } catch {
      // Seeding the shared list is best-effort, but let it be retried rather
      // than leaving a name marked "created" that never reached Firestore.
      createdRef.current.delete(name)
    }
  }

  /**
   * A back-dated invoice keeps the chosen day; today's keeps the current time so
   * several invoices entered the same day still sort in the order they arrived.
   */
  const chosenDate = () => {
    // dateStr is ISO "YYYY-MM-DD", which dayjs parses natively as local midnight.
    const d = dayjs(dateStr)
    if (!d.isValid()) return Date.now()
    return d.isSame(dayjs(), 'day') ? Date.now() : d.valueOf()
  }

  /**
   * recordPurchase hands the invoice and the stock it brings in to the local
   * cache and returns, so this await settles in a microtask instead of waiting
   * for a server acknowledgement. Closing the dialog therefore now claims
   * exactly one thing — the delivery is recorded on this machine — and that
   * claim is true with the line down. Whether the facture has reached Firestore
   * is the header's sync badge's business; it used to be answered by a spinner
   * that, offline, simply never stopped, and the owner's only way out was to
   * cancel and re-enter the delivery.
   *
   * The try/catch stays: recordPurchase still rejects on the two failures the
   * owner can act on — an invoice with more distinct products than one batch
   * holds, and no shop selected.
   */
  const save = async (force = false) => {
    if (cart.length === 0) {
      setError(t('purchases.emptyItemsError'))
      return
    }
    // A cost or a payment that cannot be read is refused, not taken as zero.
    // "2,5O0" (a letter O) used to save the line at cost 0 — the invoice total
    // and the bought cost came out short — and "1OO" in the paid box left the
    // whole invoice owed to a supplier who had in fact been paid.
    const unreadable =
      cart.some((i) => i.costStr.trim() !== '' && parseMoney(i.costStr) === null) ||
      (paidValue.trim() !== '' && parseMoney(paidValue) === null)
    if (unreadable) {
      setError(t('sales.amountInvalid'))
      return
    }
    // A quantity has to be a real count: 0, "12a" or a barcode typed in the
    // box would otherwise go into the stock and the supplier's bill.
    for (const i of cart) {
      const read = readCount(i.qtyStr)
      if (read.problem || read.value <= 0) {
        const [key, options] = read.problem ? countMessage(read.problem) : ['common.invalidNumber', {}]
        setError(`${t('backFix.lineQty', { name: i.name })} ${t(key, options)}`)
        qtyRefs.current.get(i.productId)?.focus()
        return
      }
    }
    setError('')
    setBusy(true)
    try {
      await recordPurchase({
        supplier: supplier.trim() || undefined,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        date: chosenDate(),
        items: cart.map((i) => ({
          productId: i.productId,
          name: i.name,
          qty: qtyOf(i),
          unitCost: parseMoney(i.costStr) ?? 0,
        })),
        total,
        paid: paidMinor,
      }, force)
      if (alive.current) onClose()
    } catch (e) {
      if (!alive.current) return
      if (e instanceof DuplicatePurchaseError) {
        // Not an error: a question. The invoice is not written, the form is
        // untouched, and the next press of the same button records it.
        setDuplicate(true)
        setError('')
        return
      }
      // A purchase that silently fails to save would leave the stock wrong.
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  /**
   * Every way out goes through here. Escape and the × used to close straight
   * away, and with them a 35-line delivery being typed; a click beside the
   * dialog does nothing now.
   */
  const dirty = cart.length > 0 || reference.trim() !== '' || note.trim() !== ''
  const requestClose = () => {
    if (busy) return
    if (dirty && !window.confirm(t('backFix.discardPurchase'))) return
    onClose()
  }

  return (
    <>
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) requestClose()
      }}
      closeOnInteractOutside={false}
      size="xl"
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <HStack gap={3}>
                <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                  <Truck size={22} />
                </Box>
                <Dialog.Title>{t('purchases.new')}</Dialog.Title>
              </HStack>
              <Dialog.CloseTrigger asChild>
                <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                  <X size={18} />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <Stack gap={4}>
                <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                  <Field.Root>
                    <Field.Label>
                      {t('purchases.supplier')}
                      <Text as="span" fontWeight="normal" color="fg.muted" ms={1}>
                        ({t('common.optional')})
                      </Text>
                    </Field.Label>
                    {typingSupplier ? (
                      <Input
                        size="lg"
                        autoFocus
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        onFocus={freeTextProps.onFocus}
                        onBlur={(e) => {
                          setFreeText(false)
                          commitNewSupplier(e)
                        }}
                        placeholder={t('supplier.namePlaceholder')}
                      />
                    ) : (
                      <NativeSelect.Root size="lg">
                        <NativeSelect.Field value={supplier} onChange={pickSupplier}>
                          <option value="">{t('common.select')}</option>
                          {supplierNames.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                          <option value={NEW_SUPPLIER}>{t('supplier.add')}</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    )}
                    {typingSupplier && (
                      <Box mt={2} w="full">
                        <SimilarRecords
                          matches={similarSuppliers}
                          onPick={(s) => adoptSupplier(s.name)}
                        />
                      </Box>
                    )}
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>{t('purchases.date')}</Field.Label>
                    <Input
                      size="lg"
                      type="date"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>{t('purchases.reference')}</Field.Label>
                    <Input
                      size="lg"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      {...freeTextProps}
                    />
                    <Field.HelperText>{t('common.optional')}</Field.HelperText>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>{t('purchases.note')}</Field.Label>
                    <Input
                      size="lg"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      {...freeTextProps}
                    />
                    <Field.HelperText>{t('purchases.attachHint')}</Field.HelperText>
                  </Field.Root>
                </SimpleGrid>

                <PurchaseSearch
                  products={products}
                  onPick={addProduct}
                  onCreate={setCreating}
                  scanEnabled={!creating && !freeText}
                  inputRef={searchRef}
                />

                {cart.length === 0 ? (
                  <EmptyState.Root
                    borderWidth="2px"
                    borderStyle="dashed"
                    borderColor="border"
                    borderRadius="xl"
                  >
                    <EmptyState.Content>
                      <EmptyState.Indicator>
                        <PackageOpen size={40} />
                      </EmptyState.Indicator>
                      <EmptyState.Description>
                        {t('sales.emptyCart')}
                      </EmptyState.Description>
                    </EmptyState.Content>
                  </EmptyState.Root>
                ) : (
                  <Stack gap={2}>
                    {cart.map((i) => (
                      <Flex
                        key={i.productId}
                        wrap="wrap"
                        align="center"
                        gap={3}
                        p={3}
                        borderWidth="1px"
                        borderColor="border"
                        borderRadius="xl"
                      >
                        <Box flex="1" minW="8rem">
                          <Text fontWeight="semibold" truncate>
                            {i.name}
                          </Text>
                          <Text fontSize="sm" color="fg.muted">
                            {formatMoney(lineMinor(i), { symbol })}
                          </Text>
                        </Box>

                        <Box w="7rem">
                          {/* A visible label: a bare "13.09" could be HT,
                              TTC, per unit or per line. */}
                          <Text fontSize="xs" color="fg.muted" mb={1} truncate>
                            {t('purchases.unitCost')}
                          </Text>
                          <MoneyInput
                            size="lg"
                            preview={false}
                            textAlign="center"
                            placeholder=""
                            value={i.costStr}
                            onChange={(v) => setCost(i.productId, v)}
                            aria-label={`${t('purchases.unitCost')} — ${i.name}`}
                          />
                        </Box>

                        <Box w="10rem">
                          <Text fontSize="xs" color="fg.muted" mb={1}>
                            {t('stock.quantity')}
                          </Text>
                          <QuantityInput
                            ref={(el: HTMLInputElement | null) => {
                              if (el) qtyRefs.current.set(i.productId, el)
                              else qtyRefs.current.delete(i.productId)
                            }}
                            min={1}
                            max={MAX_UNITS}
                            value={i.qtyStr}
                            onChange={(v) => setQty(i.productId, v)}
                            aria-label={`${t('stock.quantity')} — ${i.name}`}
                            onKeyDown={(e) => {
                              // Enter: that is the count, back to the scanner.
                              if (e.key !== 'Enter') return
                              e.preventDefault()
                              searchRef.current?.focus()
                            }}
                          />
                        </Box>

                        <IconButton
                          aria-label={t('common.remove')}
                          variant="ghost"
                          colorPalette="red"
                          size="lg"
                          onClick={() => removeItem(i.productId)}
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      </Flex>
                    ))}
                  </Stack>
                )}

                {/* ---------------- Paying the supplier ---------------- */}
                <Box borderWidth="1px" borderColor="border" borderRadius="xl" p={4}>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4} alignItems="end">
                    <Field.Root>
                      <Field.Label fontSize="lg">{t('purchases.amountPaid')}</Field.Label>
                      <MoneyInput
                        size="xl"
                        value={paidValue}
                        onChange={(v) => {
                          setPaidTouched(true)
                          setPaidStr(v)
                        }}
                      />
                    </Field.Root>
                    <Box>
                      <Text color="fg.muted">{t('purchases.owedToSupplier')}</Text>
                      <Text
                        fontSize="2xl"
                        fontWeight="bold"
                        color={owed > 0 ? 'red.600' : 'green.600'}
                      >
                        {formatMoney(owed, { symbol })}
                      </Text>
                    </Box>
                  </SimpleGrid>
                </Box>

                {/* The second sentence is the one that matters on a line that
                    drops for days: the facture is kept on this machine as soon
                    as it is saved, and the badge in the header — not this
                    dialog — says when it has actually reached the server. */}
                <Text fontSize="sm" color="fg.muted">
                  {t('purchases.updatesStock')} {t('purchases.savedOnDevice')}
                </Text>

                {error && (
                  <Alert.Root status="error">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{error}</Alert.Title>
                    </Alert.Content>
                  </Alert.Root>
                )}

                {duplicate && (
                  <Alert.Root status="warning">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{t('purchases.duplicateTitle')}</Alert.Title>
                      <Alert.Description>{t('purchases.duplicateBody')}</Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                )}
              </Stack>
            </Dialog.Body>

            <Dialog.Footer>
              <Flex align="center" justify="space-between" gap={4} w="full">
                <Box>
                  <Text fontSize="sm" color="fg.muted">
                    {t('common.total')}
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold" color="brand.fg">
                    {formatMoney(total, { symbol })}
                  </Text>
                </Box>
                <HStack gap={2}>
                <Button size="xl" variant="outline" onClick={requestClose} disabled={busy}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="xl"
                  colorPalette="brand"
                  px={8}
                  loading={busy}
                  disabled={busy}
                  // Passing the warning back in as `force`: the second press of
                  // the same button is the owner's answer to the question.
                  onClick={() => void save(duplicate)}
                >
                  {busy
                    ? t('common.saving')
                    : duplicate
                      ? t('purchases.duplicateConfirm')
                      : t('purchases.save')}
                </Button>
                </HStack>
              </Flex>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>

    {/* Stacked over the delivery, which stays open underneath. No quantity is
        asked: this purchase is what brings the stock in. */}
    {creating !== null && (
      <ProductForm
        open
        quick
        noStock
        initialBarcode={looksLikeCode(creating) ? creating : undefined}
        initialName={looksLikeCode(creating) ? undefined : creating}
        onClose={() => {
          setCreating(null)
          // Created: addLine has put the cursor on its quantity. Cancelled:
          // back to the scanner.
          if (!createdLine.current) setTimeout(() => searchRef.current?.focus(), 30)
          createdLine.current = false
        }}
        onSaved={({ id, input, created }) => {
          if (!created) return
          createdLine.current = true
          addLine(id, input.name, input.costPrice)
        }}
      />
    )}
    </>
  )
}
