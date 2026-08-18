import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  EmptyState,
  Flex,
  HStack,
  Input,
  InputGroup,
  NativeSelect,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react'
import { BookMarked, Check, Library, Plus, Search, X } from 'lucide-react'
import { formatMoney, moneySymbolKey, parseQuantity } from '@/lib/money'
import { useCatalog } from './useCatalog'
import type { CatalogItem } from './useCatalog'
import { useProducts, createProduct } from '@/features/stock/useProducts'
import { useCategories, createCategory } from '@/features/categories/useCategories'
import { useShopSettings } from '@/features/settings/useShopSettings'
import { ProductForm } from '@/features/stock/ProductForm'
import { codeOf, loose } from '@/features/stock/barcode'
import { marginFromPrices } from '@/features/stock/pricing'

/** base1…base9 then sec1…sec4, in the order a Tunisian parent asks for them. */
const LEVELS = [
  'base1',
  'base2',
  'base3',
  'base4',
  'base5',
  'base6',
  'base7',
  'base8',
  'base9',
  'sec1',
  'sec2',
  'sec3',
  'sec4',
]

/**
 * Which of the three failure messages to show.
 *
 * Being offline is by far the most likely and is not an error at all — the shop's
 * own stock and till are unaffected, only this one screen needs the network — so
 * it gets its own sentence rather than a generic apology.
 */
const errKey = (e: string) =>
  e === 'offline' ? 'catalog.errOffline' : e === 'index' ? 'catalog.errIndex' : 'catalog.errError'

const levelLabel = (l: string) =>
  l.startsWith('base') ? `${l.slice(4)}ème année` : `${l.slice(3)}ère sec.`

/**
 * The shared catalogue, from the shop's side.
 *
 * Two jobs on one screen, because they are the same job at different speeds.
 *
 * The list at the bottom is BROWSING: what other librairies have already named,
 * searchable, one article added at a time through the ordinary product form so
 * the owner sets his own prices. Identity comes from the catalogue; the money is
 * his.
 *
 * The block at the top is the MANUELS SCOLAIRES, and it is the reason this screen
 * earns its place in the navigation. Those books are the same in every librairie
 * in the country and the state fixes what they sell for, so there is nothing for
 * the owner to decide except how many he has. He picks a level, types quantities,
 * and his shelf is in the system — a morning's typing replaced by a few minutes.
 */
export function CatalogPage() {
  const { t } = useTranslation()
  const symbol = t(moneySymbolKey())
  const money = (m: number) => formatMoney(m, { symbol })
  const { products } = useProducts()
  const { categories } = useCategories()
  const { shop } = useShopSettings()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [officialOnly, setOfficialOnly] = useState(false)

  const filter = useMemo(
    () => ({ search, category, level, officialOnly }),
    [search, category, level, officialOnly],
  )
  const { items, loading, error, done, more, retry } = useCatalog(filter)

  /**
   * Every barcode this shop already stocks, compared the way the rest of the app
   * compares codes.
   *
   * Rebuilt from the resident products snapshot rather than queried, so it is
   * free and correct offline — and it is what stops the screen offering to add an
   * article the shop already has, which would create a second document with the
   * same code and put a chooser dialog on every scan of it afterwards.
   */
  const mine = useMemo(() => {
    const s = new Set<string>()
    for (const p of products) {
      const k = loose(codeOf(p.barcode))
      if (k !== '') s.add(k)
    }
    return s
  }, [products])

  const has = (item: CatalogItem) => mine.has(loose(codeOf(item.code)))

  /** The article being added through the full product form. */
  const [adding, setAdding] = useState<CatalogItem | null>(null)

  // --- the school books -----------------------------------------------------

  const [bookLevel, setBookLevel] = useState('')
  const [qty, setQty] = useState<Record<string, string>>({})
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkDone, setBulkDone] = useState(0)

  const officialFilter = useMemo(
    () => ({ search: '', category: '', level: bookLevel, officialOnly: bookLevel === '' }),
    [bookLevel],
  )
  const books = useCatalog(officialFilter)

  const pending = books.items.filter((b) => !has(b) && (parseQuantity(qty[b.id] ?? '') ?? 0) > 0)

  /**
   * Adds every school book that has a quantity against it.
   *
   * The prices are not asked for and must not be: the state sets what a manuel
   * scolaire sells for, and the CNP sells it to the bookseller at 75 % of that.
   * Both numbers travel with the catalogue entry, so the margin is already right
   * and the only thing this shop knows that the catalogue does not is how many it
   * has on the shelf.
   *
   * Nothing is awaited: createProduct mints its id locally and queues the write,
   * so a hundred books land in the local cache at once and replay in order. That
   * is also what makes this work on a shop line that is down — which is exactly
   * when somebody is sitting in the back room stocking up.
   */
  const addBooks = () => {
    setBulkBusy(true)
    let n = 0
    try {
      // The category has to exist locally for the margin rules and the filters to
      // find these books later; ensure it once rather than per book.
      const cat = pending[0]?.category ?? 'Manuels scolaires'
      if (cat !== '' && !categories.some((c) => c.name === cat)) {
        try {
          createCategory(cat)
        } catch {
          /* the pick list is a convenience; a book with no category still sells */
        }
      }
      for (const b of pending) {
        const quantity = parseQuantity(qty[b.id] ?? '') ?? 0
        if (quantity <= 0) continue
        const sale = b.officialPrice ?? 0
        const cost = b.officialCost ?? 0
        createProduct({
          barcode: b.code,
          name: b.name,
          category: cat || undefined,
          unit: b.unit,
          costPrice: cost,
          salePrice: sale,
          // Stored so the product form shows the same figure it would compute,
          // rather than falling back to the shop's default margin and implying
          // this price is negotiable. It is not: it is the regulated one.
          margin: cost > 0 && sale > 0 ? (marginFromPrices(cost, sale) ?? undefined) : undefined,
          quantity,
          lowStockThreshold: 0,
        })
        n += 1
      }
      setQty({})
      setBulkDone(n)
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <Box>
      <Flex align="center" gap={3} mb={1}>
        <Library size={26} />
        <Text fontSize="2xl" fontWeight="bold">
          {t('catalog.title')}
        </Text>
      </Flex>
      <Text color="fg.muted" mb={5}>
        {t('catalog.subtitle')}
      </Text>

      {/* ---------------- the state-priced school books ---------------- */}
      <Card.Root mb={8} borderColor="brand.emphasized" borderWidth="1px">
        <Card.Body>
          <Flex align="center" gap={3} mb={1}>
            <BookMarked size={22} />
            <Text fontSize="lg" fontWeight="bold">
              {t('catalog.schoolTitle')}
            </Text>
          </Flex>
          <Text color="fg.muted" fontSize="sm" mb={4}>
            {t('catalog.schoolHint')}
          </Text>

          <HStack gap={3} mb={4} wrap="wrap">
            <NativeSelect.Root size="lg" maxW="16rem">
              <NativeSelect.Field
                value={bookLevel}
                onChange={(e) => {
                  setBookLevel(e.currentTarget.value)
                  setBulkDone(0)
                }}
              >
                <option value="">{t('catalog.allLevels')}</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {levelLabel(l)}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            {pending.length > 0 && (
              <Button
                size="lg"
                colorPalette="brand"
                loading={bulkBusy}
                disabled={bulkBusy}
                onClick={addBooks}
              >
                <Plus size={18} />
                {t('catalog.addBooks', { count: pending.length })}
              </Button>
            )}
          </HStack>

          {bulkDone > 0 && (
            <Alert.Root status="success" mb={4}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('catalog.booksAdded', { count: bulkDone })}</Alert.Title>
              </Alert.Content>
            </Alert.Root>
          )}

          {books.loading && books.items.length === 0 ? (
            <Flex justify="center" py={8}>
              <Spinner size="lg" colorPalette="brand" />
            </Flex>
          ) : books.error ? (
            <Alert.Root status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t(errKey(books.error))}</Alert.Title>
              </Alert.Content>
              <Button size="sm" variant="outline" onClick={books.retry}>
                {t('common.retry')}
              </Button>
            </Alert.Root>
          ) : books.items.length === 0 ? (
            <Text color="fg.muted">{t('catalog.noBooks')}</Text>
          ) : (
            <Stack gap={2}>
              {books.items.map((b) => {
                const owned = has(b)
                return (
                  <Flex
                    key={b.id}
                    align="center"
                    gap={3}
                    wrap="wrap"
                    px={3}
                    py={2}
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="md"
                    bg={owned ? 'bg.muted' : undefined}
                  >
                    <Box minW="14rem" flex="1">
                      <Text fontWeight="semibold">{b.name}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {b.code}
                        {b.level ? ` · ${levelLabel(b.level)}` : ''}
                      </Text>
                    </Box>
                    <Box textAlign="end" minW="7rem">
                      <Text fontWeight="bold">{money(b.officialPrice ?? 0)}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('catalog.officialPrice')}
                      </Text>
                    </Box>
                    {owned ? (
                      <Badge colorPalette="green" size="lg">
                        <Check size={14} />
                        {t('catalog.inStock')}
                      </Badge>
                    ) : (
                      <Input
                        size="lg"
                        w="7rem"
                        inputMode="numeric"
                        placeholder={t('catalog.qty')}
                        value={qty[b.id] ?? ''}
                        onChange={(e) => setQty((q) => ({ ...q, [b.id]: e.target.value }))}
                      />
                    )}
                  </Flex>
                )
              })}
              {!books.done && (
                <Button variant="outline" onClick={books.more} loading={books.loading}>
                  {t('catalog.more')}
                </Button>
              )}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>

      {/* ---------------- browsing everything else ---------------- */}
      <Text fontSize="lg" fontWeight="bold" mb={3}>
        {t('catalog.browseTitle')}
      </Text>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap={3} mb={4}>
        <InputGroup startElement={<Search size={18} />} endElement={
          search !== '' ? (
            <Box as="button" onClick={() => setSearch('')} aria-label={t('common.reset')}>
              <X size={16} />
            </Box>
          ) : undefined
        }>
          <Input
            size="lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('catalog.searchPlaceholder')}
          />
        </InputGroup>
        <NativeSelect.Root size="lg" disabled={search !== ''}>
          <NativeSelect.Field
            value={category}
            onChange={(e) => setCategory(e.currentTarget.value)}
          >
            <option value="">{t('catalog.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Button
          size="lg"
          variant={officialOnly ? 'solid' : 'outline'}
          colorPalette="brand"
          disabled={search !== ''}
          onClick={() => setOfficialOnly((v) => !v)}
        >
          <BookMarked size={18} />
          {t('catalog.officialOnly')}
        </Button>
      </SimpleGrid>

      {/* A name search cannot be combined with a filter: each pairing would need
          its own composite index, and a missing index fails the query outright
          rather than degrading. @see useCatalog */}
      {search !== '' && (
        <Text fontSize="sm" color="fg.muted" mb={3}>
          {t('catalog.searchAlone')}
        </Text>
      )}

      {error ? (
        <Alert.Root status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t(errKey(error))}</Alert.Title>
          </Alert.Content>
          <Button size="sm" variant="outline" onClick={retry}>
            {t('common.retry')}
          </Button>
        </Alert.Root>
      ) : loading && items.length === 0 ? (
        <Flex justify="center" py={16}>
          <Spinner size="xl" colorPalette="brand" />
        </Flex>
      ) : items.length === 0 ? (
        <EmptyState.Root size="lg">
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Library />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('catalog.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('catalog.emptyHint')}</EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <Stack gap={3}>
          <Table.ScrollArea>
            <Table.Root size="md" stickyHeader>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>{t('common.name')}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t('stock.barcode')}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t('stock.category')}</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">{t('common.actions')}</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.map((item) => {
                  const owned = has(item)
                  return (
                    <Table.Row key={item.id}>
                      <Table.Cell>
                        <Text fontWeight="semibold">{item.name}</Text>
                        {item.brand && (
                          <Text fontSize="xs" color="fg.muted">
                            {item.brand}
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell fontFamily="mono" fontSize="sm">
                        {item.code}
                      </Table.Cell>
                      <Table.Cell>
                        {item.category && (
                          <Badge colorPalette="gray" size="sm">
                            {item.category}
                          </Badge>
                        )}
                        {item.official && (
                          <Badge colorPalette="brand" size="sm" ms={1}>
                            {money(item.officialPrice ?? 0)}
                          </Badge>
                        )}
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        {owned ? (
                          <Badge colorPalette="green" size="lg">
                            <Check size={14} />
                            {t('catalog.inStock')}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            colorPalette="brand"
                            variant="outline"
                            onClick={() => setAdding(item)}
                          >
                            <Plus size={16} />
                            {t('catalog.add')}
                          </Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
          {!done && (
            <Button variant="outline" size="lg" onClick={more} loading={loading}>
              {t('catalog.more')}
            </Button>
          )}
        </Stack>
      )}

      {/*
        Adding goes through the ordinary product form, deliberately.

        It is the one place that already knows this shop's VAT, its category
        margins, the HT/TTC chain and the duplicate-code warning — and it is where
        the owner expects to be asked for a price. A second, simpler "quick add"
        here would be a second set of pricing rules to keep in step with the first.
        The catalogue's contribution is that the name, unit and category arrive
        already filled in.
      */}
      <ProductForm
        open={adding !== null}
        onClose={() => setAdding(null)}
        initialBarcode={adding?.code}
        initialName={adding?.name}
      />
    </Box>
  )
}
