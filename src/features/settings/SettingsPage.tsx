import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import {
  Box,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Flex,
  Heading,
  IconButton,
  Input,
  Portal,
  SimpleGrid,
  Stack,
  SegmentGroup,
  Switch,
  Text,
  Alert,
  Spinner,
} from '@chakra-ui/react'
import {
  Settings as SettingsIcon,
  Store,
  Coins,
  PanelLeft,
  Tags,
  Plus,
  Pencil,
  Trash2,
  X,
  QrCode,
  DatabaseBackup,
  Lock,
  RotateCcw,
  Check,
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
import { ROUTE_PALETTE } from '@/lib/navColors'
import {
  NAV_FOOTER,
  NAV_GROUPS,
  LOCKED_NAV,
  isNavVisible,
  sanitiseHiddenNav,
  visibleNavFooter,
  visibleNavGroups,
} from '@/lib/navItems'
import type { NavItemDef } from '@/lib/navItems'
import {
  useCategories,
  createCategory,
  renameCategory,
  removeCategory,
  countProductsInCategory,
} from '@/features/categories/useCategories'
import { useProducts } from '@/features/stock/useProducts'
import { useShopSettings, saveShopSettings, patchShopSettings } from './useShopSettings'
import type { Category, ShopSettings } from '@/types/models'

/* ==========================================================================
   THE SHOP DOCUMENT, EDITED FROM SEVERAL SCREENS AT ONCE.

   The old page put the whole shop document behind one Tabs.Content and one
   Save button at the bottom of a form long enough to scroll off. Splitting it
   into short sections only helps if they still share one draft and one Save —
   otherwise walking from Boutique to Prix would quietly drop what was typed.

   So the draft lives here, above the sections, and the save bar at the foot of
   the page belongs to whichever section is open.
   ========================================================================== */

function useShopForm() {
  const { t } = useTranslation()
  const alive = useAlive()
  const { shop, loading } = useShopSettings()

  const [form, setForm] = useState<ShopSettings>(shop)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  /**
   * True from the first keystroke until the next successful save.
   *
   * A ref rather than state because the effect below has to read it in the same
   * commit as the keystroke that set it — a state update would arrive a render
   * too late, which is exactly the race this exists to close. `dirtyNow` is the
   * same fact in a form the save bar can render from; the two are always set
   * together.
   */
  const dirty = useRef(false)
  const [dirtyNow, setDirtyNow] = useState(false)

  /**
   * The live document is the source of truth UNTIL THE OWNER STARTS EDITING.
   *
   * A snapshot arrives whenever anything writes to the document: another
   * device, another tab, or this very app doing something unrelated. Renaming a
   * category carries its margin across (useShopSettings.carryCategoryMargin),
   * so a rename performed while the Boutique section was half filled in wiped
   * the half — shop name, address, phone, ticket footer — with no warning and
   * nothing to undo it.
   */
  useEffect(() => {
    if (!loading && !dirty.current) setForm(shop)
  }, [loading, shop])

  /** An edit that waits for the Save button. */
  const edit = (patch: Partial<ShopSettings>) => {
    dirty.current = true
    setDirtyNow(true)
    setDone(false)
    setForm((f) => ({ ...f, ...patch }))
  }

  const field = (k: keyof ShopSettings) => (e: { target: { value: string } }) =>
    edit({ [k]: e.target.value } as Partial<ShopSettings>)

  /**
   * A setting that takes effect the instant it is touched, and is written on
   * the spot — the money mode and the sidebar switches.
   *
   * Both change what is on screen immediately: the whole app reprices, the
   * sidebar redraws. Leaving them pending behind a Save button would leave the
   * screen and the setting disagreeing, which for the money mode is how an
   * amount gets typed in the wrong unit.
   *
   * Written through `patchShopSettings`, which touches ONLY these keys. The
   * previous version wrote the entire form, so flipping the money switch pushed
   * a half-typed address to the server and on to the other machine. It also
   * deliberately leaves `dirty` alone: this change is already saved, so if
   * nothing else is pending the page stays free to follow the live document.
   */
  const applyNow = (patch: Partial<ShopSettings>) => {
    setForm((f) => ({ ...f, ...patch }))
    patchShopSettings(patch)
    setDone(true)
  }

  const revert = () => {
    dirty.current = false
    setDirtyNow(false)
    setDone(false)
    setError('')
    setForm(shop)
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await saveShopSettings({ ...form, name: form.name.trim() || 'Librairie' })
      // Saved, so the document is authoritative again and a later snapshot may
      // overwrite the form. Cleared before the alive check on purpose: the write
      // happened whether or not this component is still mounted to hear about it.
      dirty.current = false
      if (alive.current) {
        setDirtyNow(false)
        setDone(true)
      }
    } catch {
      if (alive.current) setError(t('common.error'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  // The success line is an acknowledgement, not a state — it should not sit
  // there until the next edit claiming a save that happened a quarter of an
  // hour ago.
  useEffect(() => {
    if (!done) return
    const id = window.setTimeout(() => setDone(false), 3000)
    return () => window.clearTimeout(id)
  }, [done])

  return { form, loading, busy, done, error, dirty: dirtyNow, edit, field, applyNow, revert, save }
}

type ShopForm = ReturnType<typeof useShopForm>

/* ==========================================================================
   Section 1 — Boutique: who the shop is, and what the ticket says.
   ========================================================================== */

function IdentitySection({ f }: { f: ShopForm }) {
  const { t } = useTranslation()
  const { form } = f

  return (
    <SimpleGrid columns={{ base: 1, xl: 2 }} gap={4} alignItems="start">
      <Card.Root>
        <Card.Body>
          <Stack gap={4}>
            <Field.Root required>
              <Field.Label>{t('settings.shopName')}</Field.Label>
              <Input size="lg" value={form.name} onChange={f.field('name')} />
              <Field.HelperText>{t('settings.shopNameHint')}</Field.HelperText>
            </Field.Root>

            <Field.Root>
              <Field.Label>{t('settings.address')}</Field.Label>
              <Input size="lg" value={form.address ?? ''} onChange={f.field('address')} />
            </Field.Root>

            <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
              <Field.Root>
                <Field.Label>{t('settings.phone')}</Field.Label>
                <Input size="lg" value={form.phone ?? ''} onChange={f.field('phone')} />
              </Field.Root>
              <Field.Root>
                <Field.Label>{t('settings.taxId')}</Field.Label>
                <Input size="lg" value={form.taxId ?? ''} onChange={f.field('taxId')} />
              </Field.Root>
            </SimpleGrid>

            <Field.Root>
              <Field.Label>{t('settings.footer')}</Field.Label>
              <Input
                size="lg"
                value={form.footer ?? ''}
                onChange={f.field('footer')}
                placeholder={t('settings.footerPlaceholder')}
              />
            </Field.Root>
          </Stack>
        </Card.Body>
      </Card.Root>

      <TicketPreview form={form} />
    </SimpleGrid>
  )
}

/** What the printed ticket header will look like, redrawn on every keystroke. */
function TicketPreview({ form }: { form: ShopSettings }) {
  const { t } = useTranslation()
  return (
    <Card.Root position={{ xl: 'sticky' }} top={{ xl: '6rem' }}>
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
  )
}

/* ==========================================================================
   Section 2 — Prix : the owner types a purchase price and the shelf price
   works itself out; these are the numbers that make it do so.
   ========================================================================== */

function PricingSection({ f }: { f: ShopForm }) {
  const { t } = useTranslation()
  const { categories } = useCategories()
  const { form } = f

  return (
    <Stack gap={4}>
      <Card.Root>
        <Card.Body>
          <Field.Root>
            <Field.Label fontSize="md" fontWeight="bold">
              {t('money.format')}
            </Field.Label>
            <SegmentGroup.Root
              size="lg"
              colorPalette="brand"
              value={form.moneyMode === 'millime' ? 'millime' : 'dinar'}
              onValueChange={(e: { value: string | null }) => {
                const next = e.value === 'millime' ? 'millime' : 'dinar'
                setMoneyMode(next)
                f.applyNow({ moneyMode: next })
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
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Body>
          <Text fontWeight="bold" mb={1}>
            {t('settings.pricing')}
          </Text>
          <Text color="fg.muted" fontSize="sm" mb={4}>
            {t('settings.pricingHint')}
          </Text>

          <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
            <Field.Root>
              <Field.Label>{t('settings.defaultMargin')}</Field.Label>
              <Input
                size="lg"
                inputMode="decimal"
                placeholder={String(FALLBACK_MARGIN)}
                value={form.defaultMargin === undefined ? '' : String(form.defaultMargin)}
                onChange={(e) =>
                  f.edit({ defaultMargin: parsePercent(e.target.value) ?? undefined })
                }
              />
              <Field.HelperText>{t('settings.defaultMarginHint')}</Field.HelperText>
            </Field.Root>

            <Field.Root>
              <Field.Label>{t('settings.defaultVat')}</Field.Label>
              <SegmentGroup.Root
                size="lg"
                colorPalette="brand"
                value={String(defaultVatFor(form))}
                onValueChange={(e: { value: string | null }) =>
                  f.edit({ defaultVat: Number(e.value ?? 0) })
                }
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
        </Card.Body>
      </Card.Root>

      {/* Paper goods carry a thinner margin than the rest, and the owner should
          never have to remember which is which. */}
      {categories.length > 0 && (
        <Card.Root>
          <Card.Body>
            <Text fontWeight="bold" mb={1}>
              {t('settings.categoryMargins')}
            </Text>
            <Text color="fg.muted" fontSize="sm" mb={4}>
              {t('settings.categoryMarginsHint')}
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
                      const pct = parsePercent(e.target.value)
                      const next = { ...(form.categoryMargins ?? {}) }
                      if (pct === null) delete next[c.name]
                      else next[c.name] = pct
                      f.edit({ categoryMargins: next })
                    }}
                  />
                  <Text color="fg.muted">%</Text>
                </Flex>
              ))}
            </Stack>
          </Card.Body>
        </Card.Root>
      )}
    </Stack>
  )
}

/* ==========================================================================
   Section 3 — Menu : what the sidebar shows.

   A shop that never lends on credit and never prints a QR service still had to
   walk past both of them a hundred times a day. Switching a module off takes
   it out of the menu and nothing else: the data stays, the screen stays
   reachable, and the switch turns it straight back on.
   ========================================================================== */

/**
 * One switchable module.
 *
 * Top-level rather than nested inside MenuSection: a component declared in a
 * render body is a brand-new type on every render, so React would tear every
 * row down and rebuild it each time one switch moved — and a switch that
 * remounts mid-flick jumps to its new position instead of sliding to it.
 */
function MenuRow({
  item,
  hidden,
  onToggle,
}: {
  item: NavItemDef
  hidden: readonly string[]
  onToggle: (to: string, visible: boolean) => void
}) {
  const { t } = useTranslation()
  const locked = LOCKED_NAV.has(item.to)
  const visible = isNavVisible(hidden, item.to)
  const Icon = item.icon
  /*
    THE WHOLE ROW IS THE SWITCH — Switch.Root already renders a <label>, so
    wrapping it in one of our own would be a label inside a label: invalid,
    and in practice a click on the knob that toggles twice and lands back
    where it started. Building the row out of the switch's own parts gives the
    big touch target for free and keeps one control per row.
  */
  return (
    <Switch.Root
      size="lg"
      colorPalette="brand"
      checked={visible}
      disabled={locked}
      onCheckedChange={(e: { checked: boolean }) => onToggle(item.to, e.checked)}
      display="flex"
      alignItems="center"
      w="full"
      gap={3}
      px={3}
      py={2}
      borderRadius="l3"
      cursor={locked ? 'default' : 'pointer'}
      transition="opacity 0.12s, background-color 0.12s"
      opacity={visible ? 1 : 0.6}
      _hover={locked ? undefined : { bg: 'bg.muted' }}
    >
      <Switch.HiddenInput />
      <Box
        flexShrink={0}
        boxSize="2.5rem"
        display="grid"
        placeItems="center"
        borderRadius="lg"
        colorPalette={ROUTE_PALETTE[item.to] ?? 'brand'}
        bg={visible ? 'colorPalette.solid' : 'bg.muted'}
        color={visible ? 'colorPalette.contrast' : 'fg.subtle'}
      >
        <Icon size={20} />
      </Box>
      {/* Spans, not the usual Text/HStack: this all sits inside a <label>,
          whose content model is phrasing content — a <p> or a <div> in here
          is invalid markup and the browser is free to reparent it out of the
          label, taking the click target with it. */}
      <Switch.Label flex="1" minW={0} display="block" fontWeight="semibold">
        <Text as="span" display="block" truncate>
          {t(item.labelKey)}
        </Text>
        {locked && (
          <Text
            as="span"
            display="flex"
            alignItems="center"
            gap={1}
            color="fg.subtle"
            fontSize="xs"
            fontWeight="normal"
          >
            <Lock size={12} />
            <Text as="span" truncate>
              {t('settings.menuLocked')}
            </Text>
          </Text>
        )}
      </Switch.Label>
      <Switch.Control flexShrink={0} />
    </Switch.Root>
  )
}

function MenuSection({ f }: { f: ShopForm }) {
  const { t } = useTranslation()
  const hidden = sanitiseHiddenNav(f.form.hiddenNav)
  const hiddenCount = hidden.length

  const setHidden = (next: string[]) => f.applyNow({ hiddenNav: sanitiseHiddenNav(next) })

  const toggle = (to: string, visible: boolean) =>
    setHidden(visible ? hidden.filter((h) => h !== to) : [...hidden, to])

  return (
    <SimpleGrid columns={{ base: 1, xl: 2 }} gap={4} alignItems="start">
      <Stack gap={4}>
        <Card.Root bg="brand.subtle" borderColor="brand.emphasized" borderWidth="1px">
          <Card.Body>
            <Flex align="start" gap={3}>
              <Box color="brand.fg" flexShrink={0} mt={1}>
                <PanelLeft size={22} />
              </Box>
              <Box minW={0} flex="1">
                <Text fontWeight="bold" color="brand.fg">
                  {t('settings.menuTitle')}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {t('settings.menuHint')}
                </Text>
              </Box>
            </Flex>
            <Flex align="center" gap={3} mt={3} wrap="wrap">
              <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
                {hiddenCount === 0
                  ? t('settings.menuAllShown')
                  : t('settings.menuHiddenCount', { count: hiddenCount })}
              </Text>
              {hiddenCount > 0 && (
                <Button size="sm" variant="outline" ms="auto" onClick={() => setHidden([])}>
                  <RotateCcw size={16} />
                  {t('settings.menuShowAll')}
                </Button>
              )}
            </Flex>
          </Card.Body>
        </Card.Root>

        {[...NAV_GROUPS, { labelKey: 'settings.menuBottom', items: NAV_FOOTER }].map((g) => (
          <Card.Root key={g.labelKey}>
            <Card.Body>
              <Text
                fontSize="xs"
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="wider"
                color="fg.subtle"
                mb={2}
                px={3}
              >
                {t(g.labelKey)}
              </Text>
              <Stack gap={1}>
                {g.items.map((item) => (
                  <MenuRow key={item.to} item={item} hidden={hidden} onToggle={toggle} />
                ))}
              </Stack>
            </Card.Body>
          </Card.Root>
        ))}
      </Stack>

      {/*
        The sidebar as it will look. Redundant on a wide screen, where the real
        one is two centimetres to the left and already redrawn — but this screen
        is also opened on a phone, where the menu lives behind a drawer and the
        owner would otherwise be flicking switches with nothing to look at.
      */}
      <Card.Root position={{ xl: 'sticky' }} top={{ xl: '6rem' }}>
        <Card.Body>
          <Text fontWeight="bold" mb={3}>
            {t('settings.menuPreview')}
          </Text>
          <Box borderWidth="1px" borderColor="border" borderRadius="l3" bg="bg" p={2}>
            <Stack gap={3}>
              {visibleNavGroups(hidden).map((g) => (
                <Stack key={g.labelKey} gap={1}>
                  <Text
                    fontSize="2xs"
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    color="fg.subtle"
                    px={2}
                  >
                    {t(g.labelKey)}
                  </Text>
                  {g.items.map((i) => (
                    <PreviewRow key={i.to} item={i} />
                  ))}
                </Stack>
              ))}
              <Stack gap={1} borderTopWidth="1px" borderColor="border" pt={2}>
                {visibleNavFooter(hidden).map((i) => (
                  <PreviewRow key={i.to} item={i} />
                ))}
              </Stack>
            </Stack>
          </Box>
        </Card.Body>
      </Card.Root>
    </SimpleGrid>
  )
}

/** One row of the miniature sidebar, styled like the real thing at 70 %. */
function PreviewRow({ item }: { item: NavItemDef }) {
  const { t } = useTranslation()
  const Icon = item.icon
  return (
    <Flex
      align="center"
      gap={2}
      px={2}
      py={1.5}
      borderRadius="lg"
      colorPalette={ROUTE_PALETTE[item.to] ?? 'brand'}
      bg="colorPalette.subtle"
      color="colorPalette.fg"
    >
      <Box
        flexShrink={0}
        boxSize="1.75rem"
        display="grid"
        placeItems="center"
        borderRadius="md"
        bg="colorPalette.solid"
        color="colorPalette.contrast"
      >
        <Icon size={15} />
      </Box>
      <Text fontSize="sm" fontWeight="bold" truncate>
        {t(item.labelKey)}
      </Text>
    </Flex>
  )
}

/* ==========================================================================
   Section 4 — Catégories.
   ========================================================================== */

function CategoriesSection() {
  const { t } = useTranslation()
  const alive = useAlive()
  const { categories, loading } = useCategories()
  // Renaming a category re-tags every product carrying the old name, and it
  // reads them from this snapshot rather than asking the server: offline a
  // `where('category','==',…)` query never answers. Subscribing here is what
  // makes that reliable — the shared products listener is warm for as long as
  // this section is on screen, so the rename does not run against an empty list.
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

/* ==========================================================================
   The page: a list of short sections instead of one long form.
   ========================================================================== */

interface SectionDef {
  id: string
  icon: LucideIcon
  palette: string
  titleKey: string
  hintKey: string
  /**
   * Sections that read the shop document, and so must wait for it.
   *
   * The other three — catégories, services, sauvegarde — hold their own data
   * and used to render the instant the tab was clicked. Making them wait on a
   * settings snapshot they never look at would be a spinner for nothing.
   */
  needsShop?: boolean
}

const SECTIONS: SectionDef[] = [
  {
    id: 'shop',
    icon: Store,
    palette: 'brand',
    titleKey: 'settings.shopTab',
    hintKey: 'settings.shopTabHint',
    needsShop: true,
  },
  {
    id: 'pricing',
    icon: Coins,
    palette: 'green',
    titleKey: 'settings.pricingTab',
    hintKey: 'settings.pricingTabHint',
    needsShop: true,
  },
  {
    id: 'menu',
    icon: PanelLeft,
    palette: 'blue',
    titleKey: 'settings.menuTab',
    hintKey: 'settings.menuTabHint',
    needsShop: true,
  },
  {
    id: 'categories',
    icon: Tags,
    palette: 'purple',
    titleKey: 'settings.categoriesTab',
    hintKey: 'settings.categoriesTabHint',
  },
  {
    id: 'services',
    icon: QrCode,
    palette: 'cyan',
    titleKey: 'services.title',
    hintKey: 'settings.servicesTabHint',
  },
  {
    id: 'backup',
    icon: DatabaseBackup,
    palette: 'red',
    titleKey: 'settings.backupTab',
    hintKey: 'settings.backupTabHint',
  },
]

export function SettingsPage() {
  const { t } = useTranslation()
  const f = useShopForm()
  const [section, setSection] = useState('shop')

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]

  /*
    Walking away from a section with a half-typed address must not throw it
    away — the draft lives above the sections for exactly that reason — but the
    owner has to be TOLD, or he walks off believing he saved. The save bar
    follows him: it belongs to the page, not to the section.
  */
  const showBar = f.dirty || f.busy

  const body: ReactNode = f.loading && current.needsShop ? (
    <Flex justify="center" py={12}>
      <Spinner size="xl" colorPalette="brand" />
    </Flex>
  ) : section === 'shop' ? (
    <IdentitySection f={f} />
  ) : section === 'pricing' ? (
    <PricingSection f={f} />
  ) : section === 'menu' ? (
    <MenuSection f={f} />
  ) : section === 'categories' ? (
    <CategoriesSection />
  ) : section === 'services' ? (
    <ServicesTab />
  ) : (
    <BackupPanel />
  )

  return (
    <Box>
      <Flex align="center" gap={3} mb={2}>
        <Box bg="gray.subtle" color="gray.fg" p={2} borderRadius="lg">
          <SettingsIcon size={26} />
        </Box>
        <Heading size="2xl">{t('settings.title')}</Heading>
      </Flex>
      <Text color="fg.muted" mb={5}>
        {t('settings.subtitle')}
      </Text>

      <Flex direction={{ base: 'column', lg: 'row' }} gap={{ base: 4, lg: 6 }} align="start">
        {/*
          A rail on a wide screen, a scrolling row of chips on a phone. One set
          of markup with responsive props rather than two — the old Tabs.List
          overflowed the moment a fifth tab was added, and a second copy of the
          nav is a second place to forget a section.
        */}
        <Flex
          as="nav"
          direction={{ base: 'row', lg: 'column' }}
          gap={2}
          flexShrink={0}
          w={{ base: 'full', lg: '17.5rem' }}
          overflowX={{ base: 'auto', lg: 'visible' }}
          pb={{ base: 1, lg: 0 }}
          position={{ lg: 'sticky' }}
          top={{ lg: '6rem' }}
          css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
        >
          {SECTIONS.map((s) => {
            const active = s.id === current.id
            const Icon = s.icon
            return (
              <Button
                key={s.id}
                onClick={() => setSection(s.id)}
                variant="plain"
                colorPalette={s.palette}
                h="auto"
                minH="3.75rem"
                w={{ base: 'auto', lg: 'full' }}
                flexShrink={0}
                justifyContent="flex-start"
                textAlign="start"
                gap={3}
                px={3}
                py={2}
                borderRadius="l3"
                bg={active ? 'colorPalette.solid' : 'colorPalette.subtle'}
                color={active ? 'colorPalette.contrast' : 'colorPalette.fg'}
                boxShadow={active ? 'md' : undefined}
                transition="background-color 0.12s, transform 0.12s"
                _hover={active ? undefined : { bg: 'colorPalette.muted' }}
                _active={{ transform: 'scale(0.985)' }}
                aria-current={active ? 'page' : undefined}
              >
                <Box
                  flexShrink={0}
                  boxSize="2.5rem"
                  display="grid"
                  placeItems="center"
                  borderRadius="lg"
                  bg={active ? 'whiteAlpha.300' : 'colorPalette.solid'}
                  color="colorPalette.contrast"
                >
                  <Icon size={22} />
                </Box>
                <Box minW={0}>
                  <Text fontSize="md" fontWeight="bold" truncate>
                    {t(s.titleKey)}
                  </Text>
                  {/* The hint is what makes the rail readable at a glance, but
                      it does not fit on a chip — dropped below lg. */}
                  <Text
                    display={{ base: 'none', lg: 'block' }}
                    fontSize="xs"
                    fontWeight="normal"
                    opacity={0.85}
                    truncate
                  >
                    {t(s.hintKey)}
                  </Text>
                </Box>
              </Button>
            )
          })}
        </Flex>

        <Box flex="1" minW={0} w="full">
          {body}

          {f.error && (
            <Alert.Root status="error" mt={4}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{f.error}</Alert.Title>
              </Alert.Content>
            </Alert.Root>
          )}

          {/*
            THE SAVE BUTTON THAT CANNOT BE SCROLLED PAST.

            It used to sit at the foot of a form two screens tall, so on a
            laptop the owner typed an address, saw nothing that looked like a
            next step, and walked away. This appears only when there is
            something to save, sticks to the bottom edge of the window, and says
            what it is waiting for.
          */}
          {showBar && (
            <Box position="sticky" bottom={0} zIndex={10} mt={4} pb={2}>
              <Card.Root
                borderColor="brand.emphasized"
                borderWidth="1px"
                bg="bg"
                boxShadow="lg"
              >
                <Card.Body py={3}>
                  <Flex align="center" gap={3} wrap="wrap">
                    <Text fontWeight="semibold" minW={0} flex="1">
                      {t('settings.unsaved')}
                    </Text>
                    <Button size="lg" variant="outline" onClick={f.revert} disabled={f.busy}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      size="lg"
                      colorPalette="brand"
                      loading={f.busy}
                      loadingText={t('common.saving')}
                      onClick={() => void f.save()}
                    >
                      {t('common.save')}
                    </Button>
                  </Flex>
                </Card.Body>
              </Card.Root>
            </Box>
          )}

          {/* `done` is only ever set by a save on this page; the sections that
              keep their own data report their own. */}
          {f.done && !showBar && (
            <Alert.Root status="success" mt={4}>
              <Alert.Indicator>
                <Check size={18} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{t('settings.saved')}</Alert.Title>
              </Alert.Content>
            </Alert.Root>
          )}
        </Box>
      </Flex>
    </Box>
  )
}
