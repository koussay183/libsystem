import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Flex,
  Heading,
  HStack,
  IconButton,
  Input,
  Portal,
  Spinner,
  Stack,
  Switch,
  Table,
  Text,
} from '@chakra-ui/react'
import { Boxes, Pencil, Plus, Trash2, X } from 'lucide-react'
import { formatMoney, fromMinor, parseMoney, parseQuantity } from '@/lib/money'
import { useAlive } from '@/lib/useAlive'
import { useProducts } from '@/features/stock/useProducts'
import { ProductSearch } from '@/features/invoices/ProductSearch'
import {
  usePacks,
  createPack,
  updatePack,
  removePack,
  resolvePack,
  packToLines,
  linesTotal,
} from './usePacks'
import type { Pack, PackItem, Product } from '@/types/models'

/**
 * Packs: several articles sold together for one price.
 *
 * A pack holds no stock of its own — it is a recipe plus a price. At the till
 * it dissolves back into its articles, so the shelf count and the per-article
 * profit stay exactly as truthful as on any other ticket.
 */
export function PacksPage() {
  const { t } = useTranslation()
  const { packs, loading, error } = usePacks()
  const { products, loading: productsLoading } = useProducts()
  const [editing, setEditing] = useState<Pack | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [actionError, setActionError] = useState('')

  const symbol = t('money.symbol')
  const money = (m: number) => formatMoney(m, { symbol })

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (pack: Pack) => {
    setEditing(pack)
    setFormOpen(true)
  }

  const onDelete = async (pack: Pack) => {
    if (!window.confirm(t('packs.deleteConfirm'))) return
    setActionError('')
    try {
      await removePack(pack.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const toggleActive = async (pack: Pack) => {
    setActionError('')
    try {
      const { id, createdAt, updatedAt, ...rest } = pack
      void id
      void createdAt
      void updatedAt
      await updatePack(pack.id, { ...rest, active: !(pack.active !== false) })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  return (
    <Box>
      <Flex align="center" gap={3} mb={2} wrap="wrap">
        <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
          <Boxes size={26} />
        </Box>
        <Heading size="2xl">{t('packs.title')}</Heading>
        <Button size="xl" colorPalette="brand" ms="auto" onClick={openNew}>
          <Plus size={22} />
          {t('packs.add')}
        </Button>
      </Flex>
      <Text color="fg.muted" mb={5}>
        {t('packs.subtitle')}
      </Text>

      {actionError && (
        <Alert.Root status="error" mb={4}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{actionError}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {loading ? (
        <Flex justify="center" py={16}>
          <Spinner size="xl" colorPalette="brand" />
        </Flex>
      ) : error ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      ) : packs.length === 0 ? (
        <EmptyState.Root size="lg">
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Boxes size={48} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('packs.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('packs.emptyHint')}</EmptyState.Description>
            <Button size="xl" colorPalette="brand" mt={2} onClick={openNew}>
              <Plus size={22} />
              {t('packs.add')}
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <Card.Root>
          <Card.Body p={0}>
            <Box overflowX="auto">
              <Table.Root size="lg">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>{t('packs.name')}</Table.ColumnHeader>
                    <Table.ColumnHeader
                      textAlign="end"
                      display={{ base: 'none', md: 'table-cell' }}
                    >
                      {t('packs.normalTotal')}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">{t('packs.price')}</Table.ColumnHeader>
                    <Table.ColumnHeader
                      textAlign="end"
                      display={{ base: 'none', lg: 'table-cell' }}
                    >
                      {t('packs.saving')}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader
                      textAlign="center"
                      display={{ base: 'none', sm: 'table-cell' }}
                    >
                      {t('packs.active')}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      {t('common.actions')}
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {packs.map((pack) => {
                    const info = resolvePack(pack, products)
                    const broken = !productsLoading && info.missing.length > 0
                    return (
                      <Table.Row key={pack.id}>
                        <Table.Cell>
                          <Text fontWeight="semibold">{pack.name}</Text>
                          <HStack gap={2} mt={1} wrap="wrap">
                            <Text fontSize="sm" color="fg.muted">
                              {t('packs.itemsCount', { count: pack.items.length })}
                            </Text>
                            {broken && (
                              <Badge colorPalette="red" variant="subtle" size="sm">
                                {t('packs.brokenShort')}
                              </Badge>
                            )}
                            {pack.active === false && (
                              <Badge colorPalette="gray" variant="subtle" size="sm">
                                {t('packs.inactive')}
                              </Badge>
                            )}
                          </HStack>
                        </Table.Cell>
                        <Table.Cell
                          textAlign="end"
                          whiteSpace="nowrap"
                          color="fg.muted"
                          display={{ base: 'none', md: 'table-cell' }}
                        >
                          {money(info.normalTotal)}
                        </Table.Cell>
                        <Table.Cell
                          textAlign="end"
                          whiteSpace="nowrap"
                          fontWeight="bold"
                          color="brand.fg"
                        >
                          {money(pack.price)}
                        </Table.Cell>
                        <Table.Cell
                          textAlign="end"
                          whiteSpace="nowrap"
                          color="green.fg"
                          display={{ base: 'none', lg: 'table-cell' }}
                        >
                          {info.saving > 0 ? `-${money(info.saving)}` : '—'}
                        </Table.Cell>
                        <Table.Cell
                          textAlign="center"
                          display={{ base: 'none', sm: 'table-cell' }}
                        >
                          <Switch.Root
                            checked={pack.active !== false}
                            onCheckedChange={() => void toggleActive(pack)}
                            colorPalette="brand"
                          >
                            <Switch.HiddenInput />
                            <Switch.Control />
                          </Switch.Root>
                        </Table.Cell>
                        <Table.Cell>
                          <HStack gap={1} justify="flex-end">
                            <IconButton
                              aria-label={t('common.edit')}
                              title={t('common.edit')}
                              size="md"
                              variant="outline"
                              onClick={() => openEdit(pack)}
                            >
                              <Pencil size={18} />
                            </IconButton>
                            <IconButton
                              aria-label={t('common.delete')}
                              title={t('common.delete')}
                              size="md"
                              variant="ghost"
                              colorPalette="red"
                              onClick={() => void onDelete(pack)}
                            >
                              <Trash2 size={18} />
                            </IconButton>
                          </HStack>
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

      {formOpen && (
        <PackForm
          open={formOpen}
          pack={editing}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------

function PackForm({
  open,
  pack,
  onClose,
}: {
  open: boolean
  pack: Pack | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const alive = useAlive()
  const { products } = useProducts()

  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [price, setPrice] = useState('')
  const [items, setItems] = useState<PackItem[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  /** Set once the owner has been told the pack costs more than its parts. */
  const [dearOk, setDearOk] = useState(false)

  const symbol = t('money.symbol')
  const money = (m: number) => formatMoney(m, { symbol })

  useEffect(() => {
    if (!open) return
    setName(pack?.name ?? '')
    setBarcode(pack?.barcode ?? '')
    setPrice(pack ? String(fromMinor(pack.price)) : '')
    setItems(pack?.items ?? [])
    setError('')
    setDearOk(false)
    setBusy(false)
  }, [open, pack])

  const priceMinor = parseMoney(price) ?? 0

  /** What the pack would cost article by article, and what it becomes. */
  const preview = useMemo(() => {
    const draft: Pack = {
      id: pack?.id ?? 'draft',
      name,
      price: priceMinor,
      items,
      active: true,
      createdAt: 0,
      updatedAt: 0,
    }
    const info = resolvePack(draft, products)
    const lines = packToLines(draft, products)
    return { info, lines, total: linesTotal(lines) }
  }, [pack?.id, name, priceMinor, items, products])

  const dearerThanParts = priceMinor > preview.info.normalTotal && preview.info.normalTotal > 0

  const addProduct = (p: Product) => {
    setItems((current) => {
      const found = current.find((i) => i.productId === p.id)
      if (found) {
        return current.map((i) =>
          i.productId === p.id ? { ...i, qty: i.qty + 1 } : i,
        )
      }
      return [...current, { productId: p.id, name: p.name, qty: 1 }]
    })
    setError('')
  }

  const setQty = (productId: string, text: string) => {
    const qty = parseQuantity(text)
    if (qty === null) return
    setItems((current) =>
      qty <= 0
        ? current.filter((i) => i.productId !== productId)
        : current.map((i) => (i.productId === productId ? { ...i, qty } : i)),
    )
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (name.trim() === '') {
      setError(t('packs.nameRequired'))
      return
    }
    if (items.length === 0) {
      setError(t('packs.itemsRequired'))
      return
    }
    if (priceMinor <= 0) {
      setError(t('packs.priceRequired'))
      return
    }
    // A pack dearer than its parts is almost always a slip, but it is the
    // owner's call — warn once, then let it through.
    if (dearerThanParts && !dearOk) {
      setDearOk(true)
      setError('')
      return
    }

    setBusy(true)
    setError('')
    try {
      const input = {
        name: name.trim(),
        barcode: barcode.trim() || null,
        price: priceMinor,
        items,
        active: pack?.active !== false,
      }
      if (pack) await updatePack(pack.id, input)
      else createPack(input)
      if (alive.current) onClose()
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  return (
    <Dialog.Root
      lazyMount
      unmountOnExit
      scrollBehavior="inside"
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxH="92dvh" maxW="42rem">
            <Dialog.Header>
              <Dialog.Title>{pack ? t('packs.edit') : t('packs.add')}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                  <X size={18} />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body overflowY="auto">
              <form id="pack-form" onSubmit={submit}>
                <Stack gap={5}>
                  <Field.Root required>
                    <Field.Label>{t('packs.name')}</Field.Label>
                    <Input
                      size="lg"
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('packs.namePlaceholder')}
                    />
                  </Field.Root>

                  <HStack gap={4} align="flex-start">
                    <Field.Root required>
                      <Field.Label>{`${t('packs.price')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        value={price}
                        onChange={(e) => {
                          setPrice(e.target.value)
                          setDearOk(false)
                        }}
                        inputMode="decimal"
                        placeholder="0.000"
                      />
                      <Field.HelperText>{t('packs.priceHint')}</Field.HelperText>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>{t('stock.barcode')}</Field.Label>
                      <Input
                        size="lg"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        inputMode="numeric"
                      />
                      <Field.HelperText>{t('common.optional')}</Field.HelperText>
                    </Field.Root>
                  </HStack>

                  <Box>
                    <Text fontWeight="bold" mb={2}>
                      {t('packs.items')}
                    </Text>
                    <ProductSearch onPick={addProduct} placeholder={t('packs.searchProduct')} />

                    {items.length > 0 && (
                      <Stack gap={2} mt={3}>
                        {items.map((item) => {
                          const product = products.find((p) => p.id === item.productId)
                          return (
                            <Flex
                              key={item.productId}
                              align="center"
                              gap={3}
                              p={2}
                              borderWidth="1px"
                              borderColor="border"
                              borderRadius="md"
                            >
                              <Box minW={0} flex="1">
                                <Text fontWeight="semibold" lineClamp={1}>
                                  {product?.name ?? item.name}
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                  {product
                                    ? money(product.salePrice)
                                    : t('packs.brokenShort')}
                                </Text>
                              </Box>
                              <Input
                                size="md"
                                w="4.5rem"
                                textAlign="center"
                                inputMode="numeric"
                                value={String(item.qty)}
                                onChange={(e) => setQty(item.productId, e.target.value)}
                              />
                              <IconButton
                                aria-label={t('common.remove')}
                                size="md"
                                variant="ghost"
                                colorPalette="red"
                                onClick={() =>
                                  setItems((c) =>
                                    c.filter((i) => i.productId !== item.productId),
                                  )
                                }
                              >
                                <Trash2 size={18} />
                              </IconButton>
                            </Flex>
                          )
                        })}
                      </Stack>
                    )}
                  </Box>

                  {items.length > 0 && (
                    <Box borderWidth="1px" borderColor="border" borderRadius="md" p={3}>
                      <Flex justify="space-between" color="fg.muted">
                        <Text>{t('packs.normalTotal')}</Text>
                        <Text>{money(preview.info.normalTotal)}</Text>
                      </Flex>
                      <Flex justify="space-between" fontWeight="bold">
                        <Text>{t('packs.price')}</Text>
                        <Text color="brand.fg">{money(priceMinor)}</Text>
                      </Flex>
                      {preview.info.saving > 0 && (
                        <Flex justify="space-between" color="green.fg">
                          <Text>{t('packs.saving')}</Text>
                          <Text fontWeight="semibold">-{money(preview.info.saving)}</Text>
                        </Flex>
                      )}

                      {/* What the cashier will actually see, worked out now
                          rather than in front of a customer. */}
                      {preview.lines.length > 0 && (
                        <Box mt={3}>
                          <Text fontSize="sm" color="fg.subtle" mb={1}>
                            {t('packs.preview')}
                          </Text>
                          <Stack gap={0}>
                            {preview.lines.map((l, i) => (
                              <Flex
                                key={`${l.product.id}-${i}`}
                                justify="space-between"
                                fontSize="sm"
                                color="fg.muted"
                              >
                                <Text lineClamp={1}>
                                  {l.qty} × {l.product.name}
                                </Text>
                                <Text whiteSpace="nowrap" ms={3}>
                                  {money(l.qty * l.unitPrice)}
                                </Text>
                              </Flex>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Box>
                  )}

                  {dearerThanParts && (
                    <Alert.Root status="warning">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{t('packs.moreThanNormal')}</Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  {error && (
                    <Alert.Root status="error">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{error}</Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}
                </Stack>
              </form>
            </Dialog.Body>

            <Dialog.Footer>
              <Button size="lg" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                size="lg"
                type="submit"
                form="pack-form"
                colorPalette={dearOk ? 'orange' : 'brand'}
                loading={busy}
                loadingText={t('common.saving')}
              >
                {dearOk ? t('packs.saveAnyway') : t('common.save')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
