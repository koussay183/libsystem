import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  NativeSelect,
  Portal,
  Spinner,
  Stack,
  Switch,
  Table,
  Text,
} from '@chakra-ui/react'
import { Barcode, Boxes, Pencil, Plus, Trash2, X } from 'lucide-react'
import { formatMoney, fromMinor, parseMoney, moneySymbolKey } from '@/lib/money'
import { useAlive } from '@/lib/useAlive'
import { fold } from '@/lib/textIndex'
import { usePaged } from '@/lib/usePaged'
import { Pager } from '@/components/Pager'
import { SearchInput } from '@/components/SearchInput'
import { MoneyInput } from '@/components/MoneyInput'
import { ActiveFilters, NoResults } from '@/components/ActiveFilters'
import { oneOf, useSessionState } from '@/lib/useSessionState'
import { useProducts } from '@/features/stock/useProducts'
import { ProductScanField } from '@/components/ProductScanField'
import { codeOf, loose, generateInStoreCode, normalizeScannedCode } from '@/features/stock/barcode'
import { BarcodeInput } from '@/features/stock/ScanWedge'
import { readCount, countMessage } from '@/features/stock/quantity'
import {
  usePacks,
  createPack,
  updatePack,
  setPackActive,
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
/** Units of one article in a pack. A pack of a thousand is a typo or a scan. */
const MAX_PACK_QTY = 999

/** The actions column stays on screen when the table scrolls sideways. */
const STICKY_END = {
  position: 'sticky',
  insetInlineEnd: 0,
  zIndex: 1,
  bg: 'inherit',
} as const

export function PacksPage() {
  const { t } = useTranslation()
  const { packs, loading, error, fatal, fatalReason, retry } = usePacks()
  const { products, loading: productsLoading } = useProducts()
  const [editing, setEditing] = useState<Pack | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const [search, setSearch] = useState('')
  const [show, setShow] = useSessionState<'all' | 'active' | 'inactive'>(
    'packs.show',
    'all',
    oneOf(['all', 'active', 'inactive']),
  )
  const listTop = useRef<HTMLDivElement>(null)

  const symbol = t(moneySymbolKey())
  const money = (m: number) => formatMoney(m, { symbol })

  const q = fold(search)
  const visible = packs.filter(
    (p) =>
      (show === 'all' || (show === 'active') === (p.active !== false)) &&
      (q === '' || fold(p.name).includes(q) || (p.barcode ?? '').includes(search.trim())),
  )
  const paged = usePaged(visible, `${q}|${show}`, { persist: 'packs' })
  const resetFilters = () => {
    setSearch('')
    setShow('all')
  }
  const activeFilters =
    show === 'all'
      ? []
      : [
          {
            key: 'show',
            label: t(show === 'active' ? 'packs.filterActive' : 'packs.filterInactive'),
            onRemove: () => setShow('all'),
          },
        ]

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
      // Only the switch is written: see setPackActive.
      await setPackActive(pack.id, !(pack.active !== false))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  return (
    <Box>
      <Flex align="center" gap={3} mb={2} wrap="wrap">
        <Box bg="cyan.subtle" color="cyan.fg" p={2} borderRadius="lg">
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

      {/*
        THE WARNING GOES ABOVE THE LIST, NOT INSTEAD OF IT.

        This was `error ? <Alert> : <table>`, which threw away the one thing
        liveCollection goes out of its way to keep: when a listener dies it
        publishes the failure WITH the last good snapshot still in `data`,
        precisely so a screen can go on being useful. Replacing the list with a
        red box meant a dropped listener took the shop's packs off the screen
        while the app still knew every one of them — and packs are sold at the
        till, so it took away something the owner was in the middle of using.

        Stale and labelled beats absent. He can read a pack's price off a row
        that is an hour old; he can do nothing at all with an error message.
      */}
      {error && (
        <Alert.Root status={fatal && fatalReason !== 'no-shop' ? 'error' : 'warning'} mb={4}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
          {/* The listener gave up and Firestore never revives one by itself, so
              without this button the only way back is a page reload — and with
              the line down a reload can cost the shop the app. 'no-shop' is
              excluded: there is nothing to re-arm, a redirect is already on its
              way. */}
          {fatal && fatalReason !== 'no-shop' && (
            <Button size="sm" variant="outline" onClick={retry}>
              {t('common.retry')}
            </Button>
          )}
        </Alert.Root>
      )}

      {loading ? (
        <Flex justify="center" py={16}>
          <Spinner size="xl" colorPalette="brand" />
        </Flex>
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
        <>
        <Flex gap={3} mb={4} wrap="wrap" ref={listTop}>
          <Box flex="2" minW="14rem">
            <SearchInput
              shortcut
              value={search}
              onChange={setSearch}
              count={q !== '' ? visible.length : undefined}
              placeholder={t('common.search')}
            />
          </Box>
          <NativeSelect.Root size="lg" flex="1" minW="11rem">
            <NativeSelect.Field
              value={show}
              onChange={(e) => setShow(e.currentTarget.value as 'all' | 'active' | 'inactive')}
              aria-label={t('packs.active')}
            >
              <option value="all">{t('common.all')}</option>
              <option value="active">{t('packs.filterActive')}</option>
              <option value="inactive">{t('packs.filterInactive')}</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Flex>
        <ActiveFilters filters={activeFilters} onReset={resetFilters} />
        {visible.length === 0 ? (
          <NoResults search={search} filtered={show !== 'all'} onReset={resetFilters} />
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
                    <Table.ColumnHeader textAlign="end" {...STICKY_END}>
                      {t('common.actions')}
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {paged.pageItems.map((pack) => {
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
                            {pack.barcode && (
                              <Badge colorPalette="cyan" variant="subtle" size="sm">
                                <Barcode size={12} />
                                {pack.barcode}
                              </Badge>
                            )}
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
                          {/* No minus sign: a saving written "-5,600" read as a loss. */}
                          {info.saving > 0 ? money(info.saving) : '—'}
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
                            <Switch.HiddenInput aria-label={`${t('packs.active')} — ${pack.name}`} />
                            <Switch.Control />
                          </Switch.Root>
                        </Table.Cell>
                        <Table.Cell {...STICKY_END}>
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
        <Pager
          page={paged.page}
          pageCount={paged.pageCount}
          start={paged.start}
          end={paged.end}
          total={paged.total}
          onChange={paged.setPage}
          anchorRef={listTop}
        />
        </>
      )}

      {formOpen && (
        <PackForm
          open={formOpen}
          pack={editing}
          packs={packs}
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

/**
 * Quantity as free text, committed on blur or Enter.
 *
 * A quantity bound straight to the state reads as 0 the instant the field is
 * cleared to type a new number — and 0 means "take this article out of the
 * pack", so the row disappeared from under the owner's fingers halfway through
 * changing 2 into 3. An empty field now means nothing at all; the bin next to
 * it is how an article leaves.
 */
function PackQtyInput({
  value,
  onCommit,
  onInvalid,
  label,
}: {
  value: number
  onCommit: (n: number) => void
  /** Why the typed text was put back, for the form to say. */
  onInvalid: (message: string) => void
  label: string
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed === '') {
      setText(String(value))
      return
    }
    // Bounded: a barcode typed or scanned here (6 191 234 000 158 units) used
    // to freeze the tab, and a pack of a thousand of one article is a slip.
    const read = readCount(trimmed, MAX_PACK_QTY)
    if (read.problem) {
      setText(String(value))
      const [key, options] = countMessage(read.problem, MAX_PACK_QTY)
      onInvalid(t(key, options))
      return
    }
    onCommit(read.value)
  }

  return (
    <Input
      aria-label={label}
      size="md"
      w="4.5rem"
      textAlign="center"
      fontWeight="bold"
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        // Enter here means "that is the quantity", not "save the pack".
        e.preventDefault()
        e.stopPropagation()
        commit()
        e.currentTarget.blur()
      }}
    />
  )
}

function PackForm({
  open,
  pack,
  onClose,
  packs,
}: {
  open: boolean
  pack: Pack | null
  onClose: () => void
  packs: Pack[]
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
  /**
   * The pack's own code field has the focus. The article search below keeps a
   * scanner hook alive on the whole window, and it took every scan meant for
   * this field — put the field back, beeped "not found", grabbed the focus. It
   * is swapped out while this field is in use.
   */
  const [codeFocused, setCodeFocused] = useState(false)
  const codeUsed = useRef(false)

  const symbol = t(moneySymbolKey())
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

  /**
   * Scanning the same article twice means "two of them", exactly as it does at
   * the till — not a second identical row the owner then has to merge himself.
   */
  const addProduct = useCallback((p: Product) => {
    setItems((current) => {
      const found = current.find((i) => i.productId === p.id)
      if (found) {
        return current.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...current, { productId: p.id, name: p.name, qty: 1 }]
    })
    setError('')
  }, [])

  /**
   * Who else already answers to this code.
   *
   * A pack sharing a code with an article is legal — the till asks which one —
   * but the owner should know he is signing up for that question on every
   * single scan. Two packs on one code is simply a slip.
   */
  const codeClash = useMemo(() => {
    const key = loose(codeOf(barcode))
    if (key === '') return null
    if (packs.some((other) => other.id !== pack?.id && loose(codeOf(other.barcode)) === key)) {
      return 'pack' as const
    }
    if (products.some((p) => loose(codeOf(p.barcode)) === key)) return 'product' as const
    return null
  }, [barcode, packs, pack?.id, products])

  const makeCode = () => {
    setBarcode(
      generateInStoreCode([
        ...products.map((p) => p.barcode),
        ...packs.filter((other) => other.id !== pack?.id).map((other) => other.barcode),
      ]),
    )
  }

  const setQty = (productId: string, qty: number) => {
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
    // Two packs on one code is a slip the till cannot resolve for him: it
    // asks "which one?" on every scan. A code shared with an ARTICLE stays a
    // warning, as for products.
    if (codeClash === 'pack') {
      setError(t('packs.codeTakenPack'))
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
      // No `active` on an edit: it would undo an on/off switch made on the
      // other till since this form opened. New packs start on sale.
      const fields = {
        name: name.trim(),
        barcode: normalizeScannedCode(barcode).trim() || null,
        price: priceMinor,
        items,
      }
      if (pack) await updatePack(pack.id, fields)
      else createPack({ ...fields, active: true })
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
      // A stray click on the backdrop threw the whole article list away.
      closeOnInteractOutside={false}
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
              <form id="pack-form" noValidate onSubmit={submit}>
                <Stack gap={5}>
                  <Field.Root required>
                    <Field.Label>{t('packs.name')}</Field.Label>
                    <Input
                      size="lg"
                      autoFocus={!pack}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('packs.namePlaceholder')}
                    />
                  </Field.Root>

                  <HStack gap={4} align="flex-start">
                    <Field.Root required>
                      <Field.Label>{`${t('packs.price')} (${symbol})`}</Field.Label>
                      <MoneyInput
                        size="lg"
                        value={price}
                        onChange={(v) => {
                          setPrice(v)
                          setDearOk(false)
                        }}
                      />
                      <Field.HelperText>{t('packs.priceHint')}</Field.HelperText>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>{t('stock.barcode')}</Field.Label>
                      <HStack gap={2} w="full">
                        <BarcodeInput
                          size="lg"
                          flex="1"
                          minW={0}
                          value={barcode}
                          onChange={setBarcode}
                          onFocus={() => {
                            codeUsed.current = true
                            setCodeFocused(true)
                          }}
                          onBlur={() => setCodeFocused(false)}
                          onKeyDown={(e) => {
                            // Enter here is "that is the code", not "save the pack".
                            if (e.key === 'Enter') e.preventDefault()
                          }}
                        />
                        <Button
                          type="button"
                          size="lg"
                          variant="outline"
                          colorPalette="cyan"
                          flexShrink={0}
                          onClick={makeCode}
                          title={t('packs.generateBarcode')}
                        >
                          <Barcode size={20} />
                        </Button>
                      </HStack>
                      <Field.HelperText>{t('packs.barcodeHint')}</Field.HelperText>
                    </Field.Root>
                  </HStack>

                  {/* Not twice: a refused save says the same thing below. */}
                  {codeClash && error !== t('packs.codeTakenPack') && (
                    <Alert.Root status={codeClash === 'pack' ? 'error' : 'warning'}>
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>
                          {t(
                            codeClash === 'pack'
                              ? 'packs.codeTakenPack'
                              : 'packs.codeTakenProduct',
                          )}
                        </Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  <Box>
                    <Text fontWeight="bold" mb={2}>
                      {t('packs.items')}
                    </Text>
                    {codeFocused ? (
                      <Input size="xl" disabled placeholder={t('backFix.packCodeScanning')} />
                    ) : (
                      <ProductScanField
                        products={products}
                        onPick={addProduct}
                        placeholder={t('packs.searchProduct')}
                        // Editing an existing pack, the name is already there and
                        // the only reason to open the form is the article list —
                        // so that is where the cursor starts. A new pack needs a
                        // name first, and starts in the field above. Not again
                        // when it comes back after the code field: that would
                        // pull the cursor out of wherever he had just clicked.
                        autoFocus={!!pack && !codeUsed.current}
                      />
                    )}
                    <Text fontSize="sm" color="fg.muted" mt={2}>
                      {t('packs.scanToAdd')}
                    </Text>

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
                              <PackQtyInput
                                value={item.qty}
                                label={`${t('pos.qty')} — ${product?.name ?? item.name}`}
                                onCommit={(qty) => {
                                  setError('')
                                  setQty(item.productId, qty)
                                }}
                                onInvalid={setError}
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
                          <Text fontWeight="semibold">{money(preview.info.saving)}</Text>
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
