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
import { Trash2, Truck, Plus, Minus, PackageOpen } from 'lucide-react'
import { formatMoney, parseMoney, fromMinor, moneySymbolKey } from '@/lib/money'
import { useAlive } from '@/lib/useAlive'
import { ProductSearch } from '@/features/invoices/ProductSearch'
import { useSuppliers, createSupplier } from '@/features/suppliers/useSuppliers'
import { recordPurchase } from './usePurchases'
import type { Product } from '@/types/models'

interface CartItem {
  productId: string
  name: string
  qty: number
  costStr: string // dinars, editable
}

/** Sentinel option value that switches the supplier picker into free-text mode. */
const NEW_SUPPLIER = '__new__'

const DATE_FMT = 'YYYY-MM-DD'

export function NewPurchase({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const alive = useAlive()
  const { suppliers } = useSuppliers()
  const symbol = t(moneySymbolKey())
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
    createdRef.current = new Set()
  }, [open])

  const addProduct = (p: Product) => {
    setError('')
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id)
      if (existing)
        return prev.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i))
      return [
        ...prev,
        { productId: p.id, name: p.name, qty: 1, costStr: String(fromMinor(p.costPrice)) },
      ]
    })
  }
  const setQty = (id: string, qty: number) =>
    setCart((prev) => prev.map((i) => (i.productId === id ? { ...i, qty } : i)))
  const setCost = (id: string, costStr: string) =>
    setCart((prev) => prev.map((i) => (i.productId === id ? { ...i, costStr } : i)))
  const removeItem = (id: string) =>
    setCart((prev) => prev.filter((i) => i.productId !== id))

  const lineMinor = (i: CartItem) => i.qty * (parseMoney(i.costStr) ?? 0)
  const total = cart.reduce((s, i) => s + lineMinor(i), 0)

  // Untouched field mirrors the total; once edited it keeps what was typed.
  const paidValue = paidTouched ? paidStr : total > 0 ? String(fromMinor(total)) : ''
  const paidMinor = Math.min(parseMoney(paidValue) ?? 0, total)
  const owed = Math.max(0, total - paidMinor)

  const pickSupplier = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.currentTarget.value
    if (value === NEW_SUPPLIER) {
      setTypingSupplier(true)
      setSupplier('')
    } else {
      setTypingSupplier(false)
      setSupplier(value)
    }
  }

  /** A freshly typed name is registered as a supplier once, on blur. */
  const commitNewSupplier = (e: FocusEvent<HTMLInputElement>) => {
    const name = e.currentTarget.value.trim()
    if (!name) return
    if (supplierNames.includes(name)) return
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
  const save = async () => {
    if (cart.length === 0) {
      setError(t('purchases.emptyItemsError'))
      return
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
          qty: i.qty,
          unitCost: parseMoney(i.costStr) ?? 0,
        })),
        total,
        paid: paidMinor,
      })
      if (alive.current) onClose()
    } catch (e) {
      // A purchase that silently fails to save would leave the stock wrong.
      if (alive.current) setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
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
                        onBlur={commitNewSupplier}
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
                    />
                    <Field.HelperText>{t('common.optional')}</Field.HelperText>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>{t('purchases.note')}</Field.Label>
                    <Input
                      size="lg"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <Field.HelperText>{t('purchases.attachHint')}</Field.HelperText>
                  </Field.Root>
                </SimpleGrid>

                <ProductSearch
                  onPick={addProduct}
                  placeholder={t('purchases.searchProduct')}
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

                        <Input
                          size="lg"
                          w="7rem"
                          textAlign="center"
                          value={i.costStr}
                          onChange={(e) => setCost(i.productId, e.target.value)}
                          inputMode="decimal"
                          aria-label={t('purchases.unitCost')}
                        />

                        <HStack
                          gap={0}
                          borderWidth="2px"
                          borderColor="border"
                          borderRadius="xl"
                        >
                          <IconButton
                            aria-label={t('common.decrease')}
                            variant="ghost"
                            size="lg"
                            onClick={() => setQty(i.productId, Math.max(1, i.qty - 1))}
                          >
                            <Minus size={18} />
                          </IconButton>
                          <Text minW="2.5rem" textAlign="center" fontSize="lg" fontWeight="semibold">
                            {i.qty}
                          </Text>
                          <IconButton
                            aria-label={t('common.increase')}
                            variant="ghost"
                            size="lg"
                            onClick={() => setQty(i.productId, i.qty + 1)}
                          >
                            <Plus size={18} />
                          </IconButton>
                        </HStack>

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
                      <Input
                        size="xl"
                        inputMode="decimal"
                        value={paidValue}
                        onChange={(e) => {
                          setPaidTouched(true)
                          setPaidStr(e.target.value)
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
                <Button
                  size="xl"
                  colorPalette="brand"
                  px={8}
                  loading={busy}
                  disabled={busy}
                  onClick={save}
                >
                  {busy ? t('common.saving') : t('purchases.save')}
                </Button>
              </Flex>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
