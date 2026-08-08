import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
  Badge,
} from '@chakra-ui/react'
import { Trash2, Plus, Minus, PackageOpen, FileText } from 'lucide-react'
import { formatMoney, parseMoney, fromMinor } from '@/lib/money'
import { useAlive } from '@/lib/useAlive'
import { ProductSearch } from '@/features/invoices/ProductSearch'
import { useCustomers } from '@/features/customers/useCustomers'
import { recordSale } from './useSales'
import type { TicketData } from '@/features/pos/Ticket'
import type { PaymentMode, Product } from '@/types/models'

interface InvoiceLine {
  productId: string
  name: string
  qty: number
  /** Dinars, editable — a wholesale price is usually negotiated down. */
  priceStr: string
  unitCost: number
}

/**
 * A proper facture de vente for a bulk sale: pick the client, add the lines at
 * whatever price was agreed, say what he pays today. Anything left unpaid goes
 * straight onto his carnet, which is why a client is mandatory in that case.
 */
export function NewSaleInvoice({
  open,
  onClose,
  onRecorded,
}: {
  open: boolean
  onClose: () => void
  onRecorded: (ticket: TicketData) => void
}) {
  const { t } = useTranslation()
  const alive = useAlive()
  const { customers } = useCustomers()
  const symbol = t('money.symbol')

  const [customerId, setCustomerId] = useState('')
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [paidStr, setPaidStr] = useState('')
  const [paidTouched, setPaidTouched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setCustomerId('')
    setLines([])
    setPaidStr('')
    setPaidTouched(false)
    setError('')
    setBusy(false)
  }, [open])

  const addProduct = (p: Product) => {
    setError('')
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id)
      if (existing)
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          qty: 1,
          priceStr: String(fromMinor(p.salePrice)),
          unitCost: p.costPrice,
        },
      ]
    })
  }
  const setQty = (id: string, qty: number) =>
    setLines((prev) => prev.map((l) => (l.productId === id ? { ...l, qty } : l)))
  const setPrice = (id: string, priceStr: string) =>
    setLines((prev) => prev.map((l) => (l.productId === id ? { ...l, priceStr } : l)))
  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.productId !== id))

  const unitPriceOf = (l: InvoiceLine) => parseMoney(l.priceStr) ?? 0
  const lineMinor = (l: InvoiceLine) => l.qty * unitPriceOf(l)
  const total = lines.reduce((s, l) => s + lineMinor(l), 0)

  // Untouched, the field follows the total: a fully-paid invoice is one click.
  const paidValue = paidTouched ? paidStr : total > 0 ? String(fromMinor(total)) : ''
  const paid = Math.min(parseMoney(paidValue) ?? 0, total)
  const remaining = Math.max(0, total - paid)
  const mode: PaymentMode = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'credit'

  const customer = customers.find((c) => c.id === customerId)

  const save = async () => {
    if (lines.length === 0) {
      setError(t('sales.emptyCartError'))
      return
    }
    // recordSale refuses an unpaid balance with nobody attached to it.
    if (remaining > 0 && !customerId) {
      setError(t('sales.needCustomer'))
      return
    }
    setError('')
    setBusy(true)
    try {
      const items = lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        qty: l.qty,
        unitPrice: unitPriceOf(l),
        unitCost: l.unitCost,
      }))
      const rec = await recordSale({
        items,
        subtotal: total,
        discount: 0,
        total,
        paid,
        received: paid,
        mode,
        customerId: customerId || null,
        customerName: customer?.name ?? null,
        kind: 'invoice',
      })
      if (!alive.current) return
      onRecorded({
        ticketNo: rec.ticketNo,
        date: rec.date,
        lines: lines.map((l, idx) => ({
          id: `${rec.id}-${idx}`,
          productId: l.productId,
          barcode: null,
          name: l.name,
          qty: l.qty,
          unitPrice: unitPriceOf(l),
          unitCost: l.unitCost,
          stock: 0,
        })),
        subtotal: total,
        discount: 0,
        total,
        paid,
        received: paid,
        mode,
        clientName: customer?.name,
      })
      onClose()
    } catch (e) {
      // Nothing was written — the form stays as it is so nothing is retyped.
      if (alive.current) setError(e instanceof Error ? e.message : t('pos.saveFailed'))
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
                  <FileText size={22} />
                </Box>
                <Box>
                  <Dialog.Title>{t('sales.newInvoice')}</Dialog.Title>
                  <Text fontSize="sm" color="fg.muted">
                    {t('sales.invoiceHint')}
                  </Text>
                </Box>
                <Badge colorPalette="brand" size="lg" ms="auto">
                  {t('sales.wholesale')}
                </Badge>
              </HStack>
            </Dialog.Header>

            <Dialog.Body>
              <Stack gap={4}>
                <Field.Root>
                  <Field.Label fontSize="lg">{t('sales.customer')}</Field.Label>
                  <NativeSelect.Root size="lg">
                    <NativeSelect.Field
                      value={customerId}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setCustomerId(e.currentTarget.value)
                        setError('')
                      }}
                    >
                      <option value="">{t('sales.selectCustomer')}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  <Field.HelperText>{t('common.optional')}</Field.HelperText>
                </Field.Root>

                <ProductSearch onPick={addProduct} placeholder={t('sales.searchProduct')} />

                {lines.length === 0 ? (
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
                      <EmptyState.Description>{t('sales.emptyCart')}</EmptyState.Description>
                    </EmptyState.Content>
                  </EmptyState.Root>
                ) : (
                  <Stack gap={2}>
                    {lines.map((l) => (
                      <Flex
                        key={l.productId}
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
                            {l.name}
                          </Text>
                          <Text fontSize="sm" color="fg.muted">
                            {formatMoney(lineMinor(l), { symbol })}
                          </Text>
                        </Box>

                        <Input
                          size="lg"
                          w="7rem"
                          textAlign="center"
                          value={l.priceStr}
                          onChange={(e) => setPrice(l.productId, e.target.value)}
                          inputMode="decimal"
                          aria-label={t('sales.unitPrice')}
                        />

                        <HStack gap={0} borderWidth="2px" borderColor="border" borderRadius="xl">
                          <IconButton
                            aria-label={t('common.decrease')}
                            variant="ghost"
                            size="lg"
                            onClick={() => setQty(l.productId, Math.max(1, l.qty - 1))}
                          >
                            <Minus size={18} />
                          </IconButton>
                          <Text
                            minW="2.5rem"
                            textAlign="center"
                            fontSize="lg"
                            fontWeight="semibold"
                          >
                            {l.qty}
                          </Text>
                          <IconButton
                            aria-label={t('common.increase')}
                            variant="ghost"
                            size="lg"
                            onClick={() => setQty(l.productId, l.qty + 1)}
                          >
                            <Plus size={18} />
                          </IconButton>
                        </HStack>

                        <IconButton
                          aria-label={t('common.remove')}
                          variant="ghost"
                          colorPalette="red"
                          size="lg"
                          onClick={() => removeLine(l.productId)}
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      </Flex>
                    ))}
                  </Stack>
                )}

                {/* ---------------- What the client pays today ---------------- */}
                <Box borderWidth="1px" borderColor="border" borderRadius="xl" p={4}>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4} alignItems="end">
                    <Field.Root>
                      <Field.Label fontSize="lg">{t('sales.amountPaidNow')}</Field.Label>
                      <Input
                        size="xl"
                        inputMode="decimal"
                        value={paidValue}
                        onChange={(e) => {
                          setPaidTouched(true)
                          setPaidStr(e.target.value)
                          setError('')
                        }}
                      />
                    </Field.Root>
                    <Box>
                      <Text color="fg.muted">{t('sales.remaining')}</Text>
                      <Text
                        fontSize="2xl"
                        fontWeight="bold"
                        color={remaining > 0 ? 'orange.600' : 'green.600'}
                      >
                        {formatMoney(remaining, { symbol })}
                      </Text>
                      {remaining > 0 && (
                        <Text fontSize="sm" color="fg.muted">
                          {t('sales.creditLabel')}
                        </Text>
                      )}
                    </Box>
                  </SimpleGrid>
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
                  {busy ? t('common.saving') : t('sales.save')}
                </Button>
              </Flex>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
