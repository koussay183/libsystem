import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
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
  SimpleGrid,
  Stack,
  SegmentGroup,
  Tabs,
  Text,
  Alert,
  Spinner,
} from '@chakra-ui/react'
import {
  Settings as SettingsIcon,
  Store,
  Tags,
  Plus,
  Pencil,
  Trash2,
  X,
  QrCode,
  DatabaseBackup,
} from 'lucide-react'
import { BackupPanel } from '@/features/backup/BackupPanel'
import { ServicesTab } from './ServicesTab'
import {
  VAT_RATES,
  FALLBACK_MARGIN,
  defaultVatFor,
  parsePercent,
} from '@/features/stock/pricing'
import { setMoneyMode } from '@/lib/money'
import { useAlive } from '@/lib/useAlive'
import {
  useCategories,
  createCategory,
  renameCategory,
  removeCategory,
  countProductsInCategory,
} from '@/features/categories/useCategories'
import { useProducts } from '@/features/stock/useProducts'
import { useShopSettings, saveShopSettings } from './useShopSettings'
import type { Category, ShopSettings } from '@/types/models'

function ShopTab() {
  const { t } = useTranslation()
  const alive = useAlive()
  const { shop, loading } = useShopSettings()
  const { categories } = useCategories()

  const [form, setForm] = useState<ShopSettings>(shop)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  /**
   * True from the first keystroke until the next successful save.
   *
   * A ref rather than state: nothing renders differently because of it, and it
   * has to be readable by the effect below in the same commit as the keystroke
   * that set it — a state update would arrive a render too late, which is
   * exactly the race this exists to close.
   */
  const dirty = useRef(false)

  /**
   * The live document is the source of truth UNTIL THE OWNER STARTS EDITING —
   * which is what this comment already claimed and nothing enforced.
   *
   * It ran on every settings snapshot, and a snapshot arrives whenever anything
   * writes to the document: another device, another tab, or this very app doing
   * something unrelated. Renaming a category now carries its margin across
   * (useShopSettings.carryCategoryMargin), so a rename performed while the
   * Boutique tab was half filled in wiped the half — shop name, address, phone,
   * the ticket footer — with no warning and nothing to undo it.
   */
  useEffect(() => {
    if (!loading && !dirty.current) setForm(shop)
  }, [loading, shop])

  const set = (k: keyof ShopSettings) => (e: { target: { value: string } }) => {
    dirty.current = true
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setDone(false)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await saveShopSettings({ ...form, name: form.name.trim() || 'Librairie' })
      // Saved, so the document is authoritative again and a later snapshot may
      // overwrite the form. Cleared before the alive check on purpose: the write
      // happened whether or not this component is still mounted to hear about it.
      dirty.current = false
      if (alive.current) setDone(true)
    } catch {
      if (alive.current) setError(t('common.error'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  if (loading) {
    return (
      <Flex justify="center" py={12}>
        <Spinner size="xl" colorPalette="brand" />
      </Flex>
    )
  }

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6} alignItems="start">
      <Card.Root>
        <Card.Body>
          <form onSubmit={submit}>
            <Stack gap={4}>
              <Field.Root required>
                <Field.Label>{t('settings.shopName')}</Field.Label>
                <Input size="lg" value={form.name} onChange={set('name')} />
                <Field.HelperText>{t('settings.shopNameHint')}</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>{t('settings.address')}</Field.Label>
                <Input size="lg" value={form.address ?? ''} onChange={set('address')} />
              </Field.Root>

              <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                <Field.Root>
                  <Field.Label>{t('settings.phone')}</Field.Label>
                  <Input size="lg" value={form.phone ?? ''} onChange={set('phone')} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>{t('settings.taxId')}</Field.Label>
                  <Input size="lg" value={form.taxId ?? ''} onChange={set('taxId')} />
                </Field.Root>
              </SimpleGrid>

              {/* ------------------------------------------------------------
                  Prices. The owner types a purchase price and the shelf price
                  works itself out; these are the numbers that make it do so.
              ------------------------------------------------------------ */}
              <Box borderTopWidth="1px" borderColor="border" pt={4}>
                <Text fontWeight="bold" mb={1}>
                  {t('settings.pricing')}
                </Text>
                <Text color="fg.muted" fontSize="sm" mb={3}>
                  {t('settings.pricingHint')}
                </Text>

                {/* ----------------------------------------------------------
                    Dinars or millimes. Applied the moment it is touched and
                    saved on the spot: it changes what every price field in
                    the app means, so leaving it pending behind a Save button
                    is how an amount gets typed in the wrong unit.
                ---------------------------------------------------------- */}
                <Field.Root mb={4}>
                  <Field.Label>{t('money.format')}</Field.Label>
                  <SegmentGroup.Root
                    size="lg"
                    colorPalette="brand"
                    value={form.moneyMode === 'millime' ? 'millime' : 'dinar'}
                    onValueChange={(e: { value: string | null }) => {
                      const next = e.value === 'millime' ? 'millime' : 'dinar'
                      setMoneyMode(next)
                      // Saved from `form`, not from `shop`: writing the live
                      // document back would echo through the snapshot effect
                      // above and throw away whatever else the owner had
                      // typed and not yet saved.
                      const merged: ShopSettings = {
                        ...form,
                        moneyMode: next,
                        name: form.name.trim() || 'Librairie',
                      }
                      setForm(merged)
                      saveShopSettings(merged)
                      setDone(true)
                    }}
                  >
                    <SegmentGroup.Indicator />
                    <SegmentGroup.Item value="dinar">
                      <SegmentGroup.ItemText>
                        {`${t('money.dinarMode')} · 10,500 ${t('money.symbol')}`}
                      </SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                    <SegmentGroup.Item value="millime">
                      <SegmentGroup.ItemText>
                        {`${t('money.millimeMode')} · 10 500`}
                      </SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                  </SegmentGroup.Root>
                  <Field.HelperText>{t('money.formatHint')}</Field.HelperText>
                </Field.Root>

                <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                  <Field.Root>
                    <Field.Label>{t('settings.defaultMargin')}</Field.Label>
                    <Input
                      size="lg"
                      inputMode="decimal"
                      placeholder={String(FALLBACK_MARGIN)}
                      value={form.defaultMargin === undefined ? '' : String(form.defaultMargin)}
                      onChange={(e) => {
                        setDone(false)
                        setForm((f) => ({
                          ...f,
                          defaultMargin: parsePercent(e.target.value) ?? undefined,
                        }))
                      }}
                    />
                    <Field.HelperText>{t('settings.defaultMarginHint')}</Field.HelperText>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>{t('settings.defaultVat')}</Field.Label>
                    <SegmentGroup.Root
                      size="lg"
                      colorPalette="brand"
                      value={String(defaultVatFor(form))}
                      onValueChange={(e: { value: string | null }) => {
                        setDone(false)
                        setForm((f) => ({ ...f, defaultVat: Number(e.value ?? 0) }))
                      }}
                    >
                      <SegmentGroup.Indicator />
                      {VAT_RATES.map((rate) => (
                        <SegmentGroup.Item key={rate} value={String(rate)}>
                          <SegmentGroup.ItemText>{`${rate} %`}</SegmentGroup.ItemText>
                          <SegmentGroup.ItemHiddenInput />
                        </SegmentGroup.Item>
                      ))}
                    </SegmentGroup.Root>
                  </Field.Root>
                </SimpleGrid>

                {/* Paper goods carry a thinner margin than the rest, and the
                    owner should never have to remember which is which. */}
                {categories.length > 0 && (
                  <Box mt={4}>
                    <Text fontWeight="semibold" mb={2}>
                      {t('settings.categoryMargins')}
                    </Text>
                    <Stack gap={2}>
                      {categories.map((c) => (
                        <Flex key={c.id} align="center" gap={3}>
                          <Text minW={0} flex="1" truncate>
                            {c.name}
                          </Text>
                          <Input
                            size="md"
                            w="7rem"
                            textAlign="center"
                            inputMode="decimal"
                            placeholder={String(form.defaultMargin ?? FALLBACK_MARGIN)}
                            value={
                              form.categoryMargins?.[c.name] === undefined
                                ? ''
                                : String(form.categoryMargins[c.name])
                            }
                            onChange={(e) => {
                              setDone(false)
                              const pct = parsePercent(e.target.value)
                              setForm((f) => {
                                const next = { ...(f.categoryMargins ?? {}) }
                                if (pct === null) delete next[c.name]
                                else next[c.name] = pct
                                return { ...f, categoryMargins: next }
                              })
                            }}
                          />
                          <Text color="fg.muted">%</Text>
                        </Flex>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>

              <Field.Root>
                <Field.Label>{t('settings.footer')}</Field.Label>
                <Input
                  size="lg"
                  value={form.footer ?? ''}
                  onChange={set('footer')}
                  placeholder={t('settings.footerPlaceholder')}
                />
              </Field.Root>

              {error && (
                <Alert.Root status="error">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{error}</Alert.Title>
                  </Alert.Content>
                </Alert.Root>
              )}
              {done && (
                <Alert.Root status="success">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{t('settings.saved')}</Alert.Title>
                  </Alert.Content>
                </Alert.Root>
              )}

              <Button
                type="submit"
                size="xl"
                colorPalette="brand"
                loading={busy}
                loadingText={t('common.saving')}
              >
                {t('common.save')}
              </Button>
            </Stack>
          </form>
        </Card.Body>
      </Card.Root>

      {/* What the printed ticket header will look like */}
      <Card.Root>
        <Card.Body>
          <Text fontWeight="bold" mb={3}>
            {t('settings.preview')}
          </Text>
          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="md"
            bg="white"
            color="black"
            p={4}
            fontFamily="mono"
            fontSize="sm"
            textAlign="center"
          >
            <Text fontSize="lg" fontWeight="bold">
              {form.name || 'Librairie'}
            </Text>
            {form.address && <Text>{form.address}</Text>}
            {form.phone && <Text>Tél : {form.phone}</Text>}
            {form.taxId && <Text>MF : {form.taxId}</Text>}
            <Text mt={2}>Ticket 260721-143512</Text>
            <Box borderTopWidth="1px" borderBottomWidth="1px" borderColor="gray.400" my={2} py={2}>
              <Flex justify="space-between">
                <Text>Cahier 96 pages</Text>
                <Text>2,500</Text>
              </Flex>
            </Box>
            <Flex justify="space-between" fontWeight="bold">
              <Text>TOTAL</Text>
              <Text>2,500</Text>
            </Flex>
            <Text mt={3}>{form.footer || t('settings.footerPlaceholder')}</Text>
          </Box>
        </Card.Body>
      </Card.Root>
    </SimpleGrid>
  )
}

function CategoriesTab() {
  const { t } = useTranslation()
  const alive = useAlive()
  const { categories, loading } = useCategories()
  // Renaming a category re-tags every product carrying the old name, and it
  // reads them from this snapshot rather than asking the server: offline a
  // `where('category','==',…)` query never answers. Subscribing here is what
  // makes that reliable — the shared products listener is warm for as long as
  // this tab is on screen, so the rename does not run against an empty list.
  const { products, loading: productsLoading } = useProducts()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [listError, setListError] = useState('')

  const openAdd = () => {
    setEditing(null)
    setName('')
    setError('')
    setOpen(true)
  }

  const openEdit = (c: Category) => {
    setEditing(c)
    setName(c.name)
    setError('')
    setOpen(true)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next = name.trim()
    if (next === '') {
      setError(t('settings.nameRequired'))
      return
    }
    const clash = categories.some(
      (c) => c.id !== editing?.id && c.name.toLowerCase() === next.toLowerCase(),
    )
    if (clash) {
      setError(t('settings.duplicate'))
      return
    }
    // A rename re-tags the products it can see, so renaming before the stock
    // snapshot has arrived would rename the category and leave every article
    // behind under a label nothing answers to. Waiting a moment is recoverable;
    // that is not.
    if (editing && productsLoading) {
      setError(t('settings.categoryProductsWait'))
      return
    }
    setBusy(true)
    setError('')
    try {
      if (editing) await renameCategory(editing.id, editing.name, next, products)
      else await createCategory(next)
      if (alive.current) setOpen(false)
    } catch {
      if (alive.current) setError(t('common.error'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const confirmDelete = async (c: Category) => {
    setListError('')
    // The count comes from the resident snapshot; before it arrives it would
    // read zero and the confirmation would claim the category is unused.
    if (productsLoading) {
      setListError(t('settings.categoryProductsWait'))
      return
    }
    try {
      const used = await countProductsInCategory(c.name, products)
      const message =
        used > 0
          ? `${t('settings.categoryInUse', { count: used })}\n${t('settings.categoryDeleteConfirm')}`
          : t('settings.categoryDeleteConfirm')
      if (!window.confirm(message)) return
      await removeCategory(c.id)
    } catch {
      if (alive.current) setListError(t('common.error'))
    }
  }

  return (
    <Stack gap={4}>
      <Flex justify="space-between" align="center" gap={3} wrap="wrap">
        <Text color="fg.muted">{t('settings.categoryRenameHint')}</Text>
        <Button size="lg" colorPalette="brand" onClick={openAdd}>
          <Plus size={20} />
          {t('settings.addCategory')}
        </Button>
      </Flex>

      {listError && (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{listError}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {loading ? (
        <Flex justify="center" py={12}>
          <Spinner size="xl" colorPalette="brand" />
        </Flex>
      ) : categories.length === 0 ? (
        <EmptyState.Root size="lg" py={10}>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Tags size={48} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('settings.categoryEmpty')}</EmptyState.Title>
            <EmptyState.Description>
              {t('settings.categoryEmptyHint')}
            </EmptyState.Description>
            <Button size="xl" colorPalette="brand" mt={2} onClick={openAdd}>
              <Plus size={20} />
              {t('settings.addCategory')}
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={3}>
          {categories.map((c) => (
            <Card.Root key={c.id}>
              <Card.Body>
                <Flex align="center" gap={2}>
                  <Text flex="1" minW={0} fontWeight="semibold" truncate>
                    {c.name}
                  </Text>
                  <IconButton
                    aria-label={t('common.edit')}
                    variant="ghost"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil size={18} />
                  </IconButton>
                  <IconButton
                    aria-label={t('common.delete')}
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => confirmDelete(c)}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </Flex>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>
      )}

      <Dialog.Root scrollBehavior="inside" open={open} onOpenChange={(e) => setOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {editing ? t('settings.editCategory') : t('settings.addCategory')}
                </Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                    <X size={18} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                <form id="category-form" onSubmit={submit}>
                  <Field.Root required invalid={!!error}>
                    <Field.Label>{t('settings.categoryName')}</Field.Label>
                    <Input
                      size="lg"
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <Field.ErrorText>{error}</Field.ErrorText>
                    {editing && (
                      <Field.HelperText>
                        {t('settings.categoryRenameHint')}
                      </Field.HelperText>
                    )}
                  </Field.Root>
                </form>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="lg"
                  type="submit"
                  form="category-form"
                  colorPalette="brand"
                  loading={busy}
                  loadingText={t('common.saving')}
                >
                  {t('common.save')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <Box>
      <Flex align="center" gap={3} mb={2}>
        <Box bg="gray.subtle" color="gray.fg" p={2} borderRadius="lg">
          <SettingsIcon size={26} />
        </Box>
        <Heading size="2xl">{t('settings.title')}</Heading>
      </Flex>
      <Text color="fg.muted" mb={6}>
        {t('settings.subtitle')}
      </Text>

      <Tabs.Root defaultValue="shop" size="lg">
        <Tabs.List mb={5}>
          <Tabs.Trigger value="shop">
            <HStack gap={2}>
              <Store size={18} />
              {t('settings.shopTab')}
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger value="categories">
            <HStack gap={2}>
              <Tags size={18} />
              {t('settings.categoriesTab')}
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger value="services">
            <QrCode size={18} />
            {t('services.title')}
          </Tabs.Trigger>
          <Tabs.Trigger value="backup">
            <HStack gap={2}>
              <DatabaseBackup size={18} />
              {t('settings.backupTab')}
            </HStack>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="shop">
          <ShopTab />
        </Tabs.Content>
        <Tabs.Content value="categories">
          <CategoriesTab />
        </Tabs.Content>
        <Tabs.Content value="services">
          <ServicesTab />
        </Tabs.Content>
        <Tabs.Content value="backup">
          <BackupPanel />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}
