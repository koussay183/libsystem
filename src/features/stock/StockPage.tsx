import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Flex,
  HStack,
  SimpleGrid,
  Heading,
  Text,
  Button,
  IconButton,
  Input,
  InputGroup,
  Badge,
  Card,
  SegmentGroup,
  Table,
  Stat,
  Alert,
  EmptyState,
  Spinner,
} from '@chakra-ui/react'
import {
  Plus,
  Search,
  Package,
  Pencil,
  Trash2,
  AlertTriangle,
  Wallet,
  Layers,
  Copy,
  PackagePlus,
  ChevronDown,
  ChevronRight,
  Zap,
  X,
} from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { useAlive } from '@/lib/useAlive'
import { useProducts, removeProduct } from './useProducts'
import { groupByFamily } from './naming'
import { codeOf, loose, sharedCodes, looksLikeCode } from './barcode'
import { ProductForm } from './ProductForm'
import { VariantsDialog } from './VariantsDialog'
import { StockAdjustDialog } from './StockAdjustDialog'
import type { Product } from '@/types/models'

type StatusTone = 'success' | 'warning' | 'danger'

const TONE_PALETTE = {
  success: 'green',
  warning: 'orange',
  danger: 'red',
} as const satisfies Record<StatusTone, string>

type View = 'grouped' | 'flat'

export function StockPage() {
  const { t } = useTranslation()
  const alive = useAlive()
  const { products, loading, error } = useProducts()

  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('grouped')
  const [expanded, setExpanded] = useState<string[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [template, setTemplate] = useState<Product | null>(null)
  const [quick, setQuick] = useState(false)
  const [scanBarcode, setScanBarcode] = useState<string | undefined>(undefined)
  const [scanName, setScanName] = useState<string | undefined>(undefined)
  const [variantsOpen, setVariantsOpen] = useState(false)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const symbol = t('money.symbol')

  const q = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      q === ''
        ? products
        : products.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.barcode ?? '').toLowerCase().includes(q) ||
              (p.family ?? '').toLowerCase().includes(q) ||
              (p.category ?? '').toLowerCase().includes(q),
          ),
    [products, q],
  )

  const { families, loners } = useMemo(() => groupByFamily(filtered), [filtered])

  // Counted exactly the way the per-row badge decides, so the tile and the
  // rows it summarises can never disagree. Without the threshold check every
  // out-of-stock article with no threshold set was counted as "stock bas" too.
  const lowCount = products.filter(
    (p) => p.lowStockThreshold > 0 && p.quantity <= p.lowStockThreshold,
  ).length

  /** Codes carried by more than one article, so the pairs can be marked. */
  const shared = useMemo(() => sharedCodes(products), [products])
  const stockValue = products.reduce((sum, p) => sum + p.costPrice * p.quantity, 0)

  const status = (p: Product): { tone: StatusTone; label: string } => {
    if (p.quantity <= 0) return { tone: 'danger', label: t('stock.outOfStock') }
    if (p.lowStockThreshold > 0 && p.quantity <= p.lowStockThreshold)
      return { tone: 'warning', label: t('stock.lowStockBadge') }
    return { tone: 'success', label: t('stock.inStock') }
  }

  const toggleFamily = (family: string) =>
    setExpanded((current) =>
      current.includes(family)
        ? current.filter((f) => f !== family)
        : [...current, family],
    )

  const openForm = (options: {
    product?: Product | null
    template?: Product | null
    barcode?: string
    name?: string
    quick?: boolean
  }) => {
    setEditing(options.product ?? null)
    setTemplate(options.template ?? null)
    setScanBarcode(options.barcode)
    setScanName(options.name)
    setQuick(options.quick ?? false)
    setNotice('')
    setFormOpen(true)
  }

  const openAdd = () => openForm({})
  const openQuickAdd = () => openForm({ quick: true })
  const openEdit = (p: Product) => openForm({ product: p })
  /** The fastest way to add a sibling kind: same everything, empty barcode. */
  const openDuplicate = (p: Product) => openForm({ template: p })
  const openVariants = () => {
    setNotice('')
    setVariantsOpen(true)
  }

  const onDelete = async (p: Product) => {
    if (!window.confirm(t('stock.deleteConfirm'))) return
    setActionError('')
    try {
      await removeProduct(p.id)
    } catch (err) {
      if (alive.current) {
        setActionError(err instanceof Error ? err.message : t('common.error'))
      }
    }
  }
  // Typed structurally so it fits both a native <form> and Chakra's `Box as="form"`.
  const onSearchSubmit = (e: { preventDefault: () => void }) => e.preventDefault()

  /** One product line — used flat, and indented under its family. */
  const productRow = (p: Product, nested: boolean) => {
    const s = status(p)
    return (
      <Table.Row key={p.id}>
        <Table.Cell ps={nested ? 12 : undefined}>
          <Flex align="center" gap={2} wrap="wrap">
            <Text fontSize="lg" fontWeight={nested ? 'medium' : 'semibold'}>
              {nested ? p.variant || p.name : p.name}
            </Text>
            <Badge colorPalette={TONE_PALETTE[s.tone]} size="sm">
              {s.label}
            </Badge>
          </Flex>
        </Table.Cell>
        <Table.Cell
          fontFamily="mono"
          color="fg.muted"
          display={{ base: 'none', lg: 'table-cell' }}
        >
          <Flex align="center" gap={2} wrap="wrap">
            <Text as="span">{p.barcode}</Text>
            {p.barcode && shared.has(loose(codeOf(p.barcode))) && (
              <Badge colorPalette="purple" variant="subtle" size="sm">
                {t('stock.sharedCode')}
              </Badge>
            )}
          </Flex>
        </Table.Cell>
        <Table.Cell color="fg.muted" display={{ base: 'none', xl: 'table-cell' }}>
          {p.category}
        </Table.Cell>
        <Table.Cell textAlign="end" fontWeight="bold" color="brand.fg">
          {formatMoney(p.salePrice, { symbol })}
        </Table.Cell>
        <Table.Cell textAlign="end" whiteSpace="nowrap">
          {p.quantity} {p.unit || t('stock.units')}
        </Table.Cell>
        <Table.Cell>
          <HStack justify="flex-end" gap={1}>
            <IconButton
              aria-label={t('stock.restock')}
              title={t('stock.restock')}
              size="md"
              variant="outline"
              colorPalette="brand"
              onClick={() => setAdjusting(p)}
            >
              <PackagePlus size={18} />
            </IconButton>
            <IconButton
              aria-label={t('stock.duplicate')}
              title={t('stock.duplicate')}
              size="md"
              variant="outline"
              display={{ base: 'none', md: 'inline-flex' }}
              onClick={() => openDuplicate(p)}
            >
              <Copy size={18} />
            </IconButton>
            <IconButton
              aria-label={t('common.edit')}
              title={t('common.edit')}
              size="md"
              variant="outline"
              onClick={() => openEdit(p)}
            >
              <Pencil size={18} />
            </IconButton>
            <IconButton
              aria-label={t('common.delete')}
              title={t('common.delete')}
              size="md"
              variant="ghost"
              colorPalette="red"
              onClick={() => onDelete(p)}
            >
              <Trash2 size={18} />
            </IconButton>
          </HStack>
        </Table.Cell>
      </Table.Row>
    )
  }

  return (
    <Box>
      {/* ---------------- Header ---------------- */}
      <Flex align="center" gap={3} mb={5} wrap="wrap">
        <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
          <Package size={26} />
        </Box>
        <Heading size="2xl">{t('stock.title')}</Heading>
        <Flex gap={2} ms="auto" wrap="wrap">
          <Button size="xl" variant="outline" colorPalette="brand" onClick={openAdd}>
            <Plus size={22} />
            {t('stock.addProduct')}
          </Button>
          <Button
            size="xl"
            variant="outline"
            colorPalette="brand"
            onClick={openVariants}
          >
            <Layers size={22} />
            {t('stock.addVariants')}
          </Button>
          <Button size="xl" colorPalette="brand" onClick={openQuickAdd}>
            <Zap size={22} />
            {t('stock.quickAdd')}
          </Button>
        </Flex>
      </Flex>

      {actionError && (
        <Alert.Root status="error" mb={4}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{actionError}</Alert.Title>
          </Alert.Content>
          <IconButton
            aria-label={t('common.close')}
            variant="ghost"
            size="sm"
            onClick={() => setActionError('')}
          >
            <X size={18} />
          </IconButton>
        </Alert.Root>
      )}

      {notice && (
        <Alert.Root status="success" mb={4}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{notice}</Alert.Title>
          </Alert.Content>
          <IconButton
            aria-label={t('common.close')}
            variant="ghost"
            size="sm"
            onClick={() => setNotice('')}
          >
            <X size={18} />
          </IconButton>
        </Alert.Root>
      )}

      {/* ---------------- Summary tiles ---------------- */}
      <SimpleGrid columns={{ base: 2, sm: 3 }} gap={3} mb={5}>
        <Card.Root>
          <Card.Body>
            <Flex align="center" gap={3}>
              <Box color="fg.muted">
                <Package size={22} />
              </Box>
              <Stat.Root>
                <Stat.Label>{t('stock.productsCount')}</Stat.Label>
                <Stat.ValueText>{String(products.length)}</Stat.ValueText>
              </Stat.Root>
            </Flex>
          </Card.Body>
        </Card.Root>

        <Card.Root>
          <Card.Body>
            <Flex align="center" gap={3}>
              <Box color={lowCount > 0 ? 'orange.solid' : 'fg.muted'}>
                <AlertTriangle size={22} />
              </Box>
              <Stat.Root colorPalette={lowCount > 0 ? 'orange' : undefined}>
                <Stat.Label>{t('stock.lowStockCount')}</Stat.Label>
                <Stat.ValueText color={lowCount > 0 ? 'orange.fg' : undefined}>
                  {String(lowCount)}
                </Stat.ValueText>
              </Stat.Root>
            </Flex>
          </Card.Body>
        </Card.Root>

        <Card.Root gridColumn={{ base: 'span 2', sm: 'auto' }}>
          <Card.Body>
            <Flex align="center" gap={3}>
              <Box color="fg.muted">
                <Wallet size={22} />
              </Box>
              <Stat.Root>
                <Stat.Label>{t('stock.totalValue')}</Stat.Label>
                <Stat.ValueText>{formatMoney(stockValue, { symbol })}</Stat.ValueText>
              </Stat.Root>
            </Flex>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* ---------------- Search / scan + view toggle ---------------- */}
      <Flex gap={3} mb={4} align="center" wrap="wrap">
        <Box as="form" onSubmit={onSearchSubmit} flex="1" minW="16rem">
          <InputGroup
            startElement={
              <Box color="gray.400">
                <Search size={22} />
              </Box>
            }
          >
            <Input
              size="lg"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('stock.searchPlaceholder')}
            />
          </InputGroup>
        </Box>
        <SegmentGroup.Root
          size="lg"
          colorPalette="brand"
          value={view}
          onValueChange={(e: { value: string | null }) =>
            setView(e.value === 'flat' ? 'flat' : 'grouped')
          }
        >
          <SegmentGroup.Indicator />
          <SegmentGroup.Item value="grouped">
            <SegmentGroup.ItemText>{t('stock.grouped')}</SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
          <SegmentGroup.Item value="flat">
            <SegmentGroup.ItemText>{t('stock.flat')}</SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        </SegmentGroup.Root>
      </Flex>

      {/* ---------------- States ---------------- */}
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
      ) : products.length === 0 ? (
        <EmptyState.Root size="lg">
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Package size={48} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('stock.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('stock.emptyHint')}</EmptyState.Description>
            <Flex gap={2} mt={2} wrap="wrap" justify="center">
              <Button size="xl" colorPalette="brand" onClick={openQuickAdd}>
                <Zap size={22} />
                {t('stock.quickAdd')}
              </Button>
              <Button
                size="xl"
                variant="outline"
                colorPalette="brand"
                onClick={openVariants}
              >
                <Layers size={22} />
                {t('stock.addVariants')}
              </Button>
            </Flex>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : filtered.length === 0 ? (
        /* A scanned code pre-fills the barcode; typed words pre-fill the name.
           Putting "cahier bleu" in the barcode field poisons the till index. */
        <Alert.Root status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {looksLikeCode(search) ? t('stock.scanNotFound') : t('stock.noResults')}
            </Alert.Title>
          </Alert.Content>
          <Button
            size="lg"
            colorPalette="brand"
            flexShrink={0}
            onClick={() =>
              looksLikeCode(search)
                ? openForm({ barcode: search.trim() })
                : openForm({ name: search.trim(), quick: true })
            }
          >
            <Plus size={20} />
            {t('stock.addProduct')}
          </Button>
        </Alert.Root>
      ) : (
        <Card.Root>
          <Card.Body p={0}>
            <Box overflowX="auto">
              <Table.Root size="lg">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>{t('stock.name')}</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: 'none', lg: 'table-cell' }}>
                      {t('stock.barcode')}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: 'none', xl: 'table-cell' }}>
                      {t('stock.category')}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      {t('stock.salePrice')}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      {t('stock.quantity')}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      {t('common.actions')}
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {view === 'flat'
                    ? filtered.map((p) => productRow(p, false))
                    : [
                        ...families.map((group) => {
                          // While searching, every family is open: the match is
                          // usually a variant, and a collapsed family showed
                          // nothing but the family name — which is exactly how
                          // "I searched and my product is not there" happens.
                          const isOpen = q !== '' || expanded.includes(group.family)
                          const prices = group.items.map((p) => p.salePrice)
                          const min = Math.min(...prices)
                          const max = Math.max(...prices)
                          const categories = [
                            ...new Set(group.items.map((p) => p.category ?? '')),
                          ]
                          return (
                            <Fragment key={`family-${group.family}`}>
                              <Table.Row
                                bg="bg.subtle"
                                cursor="pointer"
                                onClick={() => toggleFamily(group.family)}
                              >
                                <Table.Cell>
                                  <Flex align="center" gap={2} wrap="wrap">
                                    <IconButton
                                      aria-label={t('stock.variants')}
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleFamily(group.family)
                                      }}
                                    >
                                      {isOpen ? (
                                        <ChevronDown size={20} />
                                      ) : (
                                        <ChevronRight size={20} />
                                      )}
                                    </IconButton>
                                    <Layers size={18} />
                                    <Text fontSize="lg" fontWeight="bold">
                                      {group.family}
                                    </Text>
                                    <Badge colorPalette="brand" size="sm">
                                      {t('stock.variantsCount', {
                                        count: group.items.length,
                                      })}
                                    </Badge>
                                  </Flex>
                                </Table.Cell>
                                <Table.Cell display={{ base: 'none', lg: 'table-cell' }} />
                                <Table.Cell
                                  color="fg.muted"
                                  display={{ base: 'none', xl: 'table-cell' }}
                                >
                                  {categories.length === 1 ? categories[0] : ''}
                                </Table.Cell>
                                <Table.Cell textAlign="end" fontWeight="bold" color="brand.fg">
                                  {min === max
                                    ? formatMoney(min, { symbol })
                                    : `${formatMoney(min, { symbol })} – ${formatMoney(max, { symbol })}`}
                                </Table.Cell>
                                <Table.Cell
                                  textAlign="end"
                                  whiteSpace="nowrap"
                                  fontWeight="bold"
                                >
                                  {group.totalQuantity} {t('stock.units')}
                                </Table.Cell>
                                <Table.Cell />
                              </Table.Row>
                              {isOpen && group.items.map((p) => productRow(p, true))}
                            </Fragment>
                          )
                        }),
                        ...loners.map((p) => productRow(p, false)),
                      ]}
                </Table.Body>
              </Table.Root>
            </Box>
          </Card.Body>
        </Card.Root>
      )}

      {formOpen && (
        <ProductForm
          open
          onClose={() => setFormOpen(false)}
          product={editing}
          template={template}
          initialBarcode={scanBarcode}
          initialName={scanName}
          quick={quick}
        />
      )}

      {variantsOpen && (
        <VariantsDialog
          open
          onClose={() => setVariantsOpen(false)}
          onSaved={(count) => setNotice(t('stock.variantsSaved', { count }))}
        />
      )}

      {adjusting && (
        <StockAdjustDialog
          open
          onClose={() => setAdjusting(null)}
          product={adjusting}
        />
      )}
    </Box>
  )
}
