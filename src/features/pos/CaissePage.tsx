import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Grid,
  Card,
  Heading,
  Text,
  Button,
  Input,
  IconButton,
  Table,
  Badge,
  Flex,
  HStack,
  Stack,
  Separator,
  Field,
  Dialog,
  Portal,
  Alert,
  EmptyState,
  SimpleGrid,
} from '@chakra-ui/react'
import {
  ScanLine,
  Plus,
  Minus,
  Trash2,
  Printer,
  PauseCircle,
  PlayCircle,
  ShoppingCart,
  X,
  Pencil,
  Undo2,
  PackagePlus,
  Percent,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Banknote,
  Coins,
  Boxes,
  MoreHorizontal,
  UserPlus,
  Wallet,
  HandCoins,
  QrCode,
} from 'lucide-react'
import { formatMoney, parseMoney, fromMinor, moneySymbolKey, moneyPlaceholder } from '@/lib/money'
import { useAlive } from '@/lib/useAlive'
import {
  beepOk,
  beepWarn,
  beepError,
  beepDone,
  soundEnabled,
  setSoundEnabled,
} from '@/lib/beep'
import { codeOf, loose, looksLikeCode } from '@/features/stock/barcode'
import { lookupCatalog, contributeToCatalog } from '@/lib/catalog'
import type { CatalogEntry } from '@/lib/catalog'
import { useProducts, createProduct } from '@/features/stock/useProducts'
import { useCustomers, createCustomer } from '@/features/customers/useCustomers'
import { useShopSettings } from '@/features/settings/useShopSettings'
import { recordSale } from '@/features/sales/useSales'
import { usePosCart } from './usePosCart'
import { useBarcodeScanner } from './useBarcodeScanner'
import { ScanSuggestions } from './ScanSuggestions'
import {
  searchChoices,
  fold,
  choiceId,
  choiceName,
  choicePrice,
  choiceCode,
} from './posSearch'
import type { ScanChoice } from './posSearch'
import { foldCode, foldedOf } from '@/lib/textIndex'
import { usePacks, resolvePack, packToLines } from '@/features/packs/usePacks'
import { parsePercent } from '@/features/stock/pricing'
import type { Pack } from '@/types/models'
import type { PosLine } from './usePosCart'
import { Ticket } from './Ticket'
import type { TicketData } from './Ticket'
import type { PaymentMode, Product, Customer, QuickService } from '@/types/models'

type PayKind = 'cash' | 'credit' | 'partial'

/**
 * codeOf, loose and looksLikeCode come from barcode.ts rather than being
 * redeclared here.
 *
 * They used to be private copies with byte-identical bodies, and that is
 * exactly how this screen and the stock page came to disagree about what a
 * code looks like: the stock page asked looksLikeCode(), while the miss tail
 * below asked /^\d+$/, so a hyphenated ISBN typed at the till became a product
 * NAMED 978-2-07-036822-8 with no barcode at all.
 */

/**
 * How long one code stays "already dealt with". A scanner's trailing Enter
 * lands a few milliseconds after the code it belongs to; without this the
 * article goes on the ticket twice, which is money.
 */
const CONSUMED_MS = 400

/** Codes held while the stock loads. Deep enough for a basket, not a shift. */
const MAX_PENDING = 20

/**
 * Quantity is edited as free text and only committed on blur/Enter — otherwise
 * clearing the field mid-typing would momentarily read as 0 and drop the line.
 */
function QtyCell({
  value,
  onCommit,
  label,
}: {
  value: number
  onCommit: (n: number) => void
  label: string
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const commit = () => {
    const n = Number.parseInt(text, 10)
    if (Number.isFinite(n)) onCommit(n)
    else setText(String(value))
  }

  return (
    <Input
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        }
      }}
      size="xl"
      w="5rem"
      textAlign="center"
      fontWeight="bold"
      fontSize="xl"
      inputMode="numeric"
    />
  )
}

/**
 * Adding a client without leaving the sale.
 *
 * A client who buys on credit for the first time turns up mid-ticket, and
 * sending the cashier off to the carnet page loses the basket. Three fields,
 * one green button, and the new client is selected on the ticket he is
 * standing in front of.
 *
 * The write is not awaited (see createCustomer): with the line down the client
 * is durable on this machine straight away, and the sale still goes through.
 */
function QuickClientForm({
  initialName,
  onCreated,
  onCancel,
  existingNames,
}: {
  initialName: string
  onCreated: (id: string) => void
  onCancel: () => void
  existingNames: string[]
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [cin, setCin] = useState('')
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // The cursor belongs in the first field: the cashier types, he does not aim.
    const id = setTimeout(() => nameRef.current?.focus(), 40)
    return () => clearTimeout(id)
  }, [])

  const trimmed = name.trim()
  const duplicate =
    trimmed !== '' &&
    existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())

  const submit = () => {
    if (trimmed === '') {
      setError(t('customer.nameRequired'))
      nameRef.current?.focus()
      return
    }
    onCreated(
      createCustomer({
        name: trimmed,
        phone: phone.trim() || undefined,
        cin: cin.trim() || undefined,
      }),
    )
  }

  // Enter finishes the client from any of the three fields.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    submit()
  }

  return (
    <Stack
      gap={3}
      borderWidth="2px"
      borderColor="green.emphasized"
      bg="green.subtle"
      borderRadius="l3"
      p={4}
    >
      <Flex align="center" gap={2} color="green.fg">
        <UserPlus size={22} />
        <Text fontSize="lg" fontWeight="bold">
          {t('customer.quickAdd')}
        </Text>
      </Flex>

      <Field.Root required invalid={!!error}>
        <Field.Label fontSize="md">{t('customer.name')}</Field.Label>
        <Input
          ref={nameRef}
          size="xl"
          bg="bg"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          onKeyDown={onKeyDown}
          placeholder={t('customer.namePlaceholder')}
        />
        <Field.ErrorText>{error}</Field.ErrorText>
      </Field.Root>

      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3}>
        <Field.Root>
          <Field.Label fontSize="md">{t('customer.phone')}</Field.Label>
          <Input
            size="xl"
            bg="bg"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label fontSize="md">{t('customer.cin')}</Field.Label>
          <Input
            size="xl"
            bg="bg"
            inputMode="numeric"
            value={cin}
            onChange={(e) => setCin(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('customer.cinPlaceholder')}
          />
        </Field.Root>
      </SimpleGrid>

      {/* Two clients of the same name is legal — two records for the SAME
          client is what wrecks a carnet. Say so, do not block. */}
      {duplicate && (
        <Alert.Root status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('customer.alreadyExists')}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      <HStack gap={2}>
        <Button size="lg" variant="outline" bg="bg" flexShrink={0} onClick={onCancel}>
          {t('customer.backToList')}
        </Button>
        <Button size="lg" colorPalette="green" flex="1" onClick={submit}>
          <UserPlus size={20} />
          {t('customer.createAndSelect')}
        </Button>
      </HStack>
    </Stack>
  )
}

/** Searchable client list — a plain dropdown is unusable past a few dozen. */
function ClientPicker({
  customers,
  value,
  onChange,
  searchLabel,
  symbol,
}: {
  customers: Customer[]
  value: string
  onChange: (id: string) => void
  searchLabel: string
  symbol: string
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          (c.phone ?? '').includes(needle) ||
          (c.cin ?? '').toLowerCase().includes(needle),
      )
    : customers

  if (adding) {
    return (
      <QuickClientForm
        // What he already typed looking for the client IS the client's name.
        initialName={q.trim()}
        existingNames={customers.map((c) => c.name)}
        onCancel={() => setAdding(false)}
        onCreated={(id) => {
          setAdding(false)
          setQ('')
          onChange(id)
        }}
      />
    )
  }

  return (
    <Stack gap={2}>
      <HStack gap={2}>
        <Input
          size="lg"
          flex="1"
          minW={0}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchLabel}
          autoFocus
        />
        <Button
          size="lg"
          colorPalette="green"
          flexShrink={0}
          onClick={() => setAdding(true)}
        >
          <UserPlus size={20} />
          <Text as="span" display={{ base: 'none', sm: 'inline' }}>
            {t('customer.quickAdd')}
          </Text>
        </Button>
      </HStack>

      {filtered.length === 0 ? (
        // An empty list under a search box reads as "broken". The way out of
        // it has to be the thing on screen.
        <Stack
          gap={2}
          borderWidth="1px"
          borderColor="border"
          borderRadius="md"
          p={4}
          align="center"
        >
          <Text color="fg.muted" textAlign="center">
            {t('customer.empty')}
          </Text>
          <Button size="lg" colorPalette="green" onClick={() => setAdding(true)}>
            <UserPlus size={20} />
            {t('customer.quickAdd')}
          </Button>
        </Stack>
      ) : (
        <Stack
          gap={1}
          maxH="15rem"
          overflowY="auto"
          borderWidth="1px"
          borderColor="border"
          borderRadius="md"
          p={1}
        >
          {filtered.map((c) => (
            <Button
              key={c.id}
              size="lg"
              variant={value === c.id ? 'solid' : 'ghost'}
              colorPalette="brand"
              justifyContent="space-between"
              onClick={() => onChange(c.id)}
            >
              <Text truncate>{c.name}</Text>
              {c.balance > 0 && (
                <Badge colorPalette="orange" variant="subtle">
                  {formatMoney(c.balance, { symbol })}
                </Badge>
              )}
            </Button>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

export function CaissePage() {
  const { t } = useTranslation()
  const alive = useAlive()
  const { products, loading: productsLoading } = useProducts()
  const { customers } = useCustomers()
  const { packs, loading: packsLoading } = usePacks()
  const { shop, loading: shopLoading } = useShopSettings()
  const cart = usePosCart()

  const scanRef = useRef<HTMLInputElement>(null)
  const [scan, setScan] = useState('')
  const [notice, setNotice] = useState('')
  /** Severity of `notice` — "the stock is still loading" is not a warning. */
  const [noticeStatus, setNoticeStatus] = useState<'info' | 'warning' | 'success'>('warning')

  /**
   * The code the current "not found" notice is about.
   *
   * The catalogue answers over the network, so by the time it replies the cashier
   * may have scanned something else — and overwriting a fresh notice with an
   * answer about the previous article would be worse than staying quiet. Every
   * late reply checks this before it is allowed to say anything.
   */
  const missCode = useRef('')
  /** Only an unknown code offers to create the article on the spot. */
  const [canCreate, setCanCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Ambiguous scan → let the cashier pick instead of guessing.
  const [matches, setMatches] = useState<ScanChoice[] | null>(null)
  /**
   * Why we are asking. A code carried by two different articles is a normal
   * situation in this shop — cheap imported stock repeats barcodes — and it
   * deserves a different question from "your search matched several names".
   */
  const [matchKind, setMatchKind] = useState<'code' | 'name'>('name')

  /**
   * The article that just went in. The cashier is looking at the customer and
   * at the goods, not at the screen, so the confirmation has to be big enough
   * to catch out of the corner of an eye - and undoable in one click.
   */
  const [lastAdded, setLastAdded] = useState<{
    productId: string | null
    name: string
    price: number
  } | null>(null)

  const [sound, setSound] = useState(soundEnabled)

  /** The ticket list scrolls inside its own box, so it has to follow itself. */
  const ticketScrollRef = useRef<HTMLDivElement>(null)

  /**
   * The typed-search list. `query` lags `scan` by a debounce, which is what
   * keeps a scan from ever painting a dropdown: every path that consumes a
   * scan clears the field 65ms after the burst ends, well inside the wait.
   */
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(-1)

  const [packOpen, setPackOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  /**
   * The service whose price is being asked for — a scanned photocopy or print
   * job. There is nothing to look up: the price is whatever the work came to,
   * and the only thing between the scan and the ticket is one number.
   */
  const [serviceAsk, setServiceAsk] = useState<QuickService | null>(null)
  const [servicePrice, setServicePrice] = useState('')
  const [serviceError, setServiceError] = useState('')

  /** Declared here because the scanner, created below, closes the list. */
  const closeSuggestions = useCallback(() => {
    setQuery('')
    setHighlight(-1)
  }, [])

  /**
   * Codes scanned before the stock finished loading, in the order they came,
   * replayed once it lands. A queue and not a single slot: a cashier who
   * empties a basket across the counter while the app is still waking up would
   * otherwise keep only the last article.
   */
  const pendingScans = useRef<string[]>([])

  /**
   * The code that was just dealt with, and when. Every path that can ring an
   * article up goes through here, so the scanner's trailing Enter — or a
   * re-render arriving late with stale text — cannot sell the same unit twice.
   * Keyed on the code itself, so scanning two different articles back to back
   * is never blocked.
   */
  const consumed = useRef({ term: '', at: 0 })

  // Unknown code → create the product without leaving the till.
  const [newOpen, setNewOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newError, setNewError] = useState('')
  /** The shared catalogue answered for this code. @see openNewProduct */
  const [recognised, setRecognised] = useState<CatalogEntry | null>(null)

  // Free line (photocopy, binding…)
  const [miscOpen, setMiscOpen] = useState(false)
  const [miscName, setMiscName] = useState('')
  const [miscPrice, setMiscPrice] = useState('')

  // Price renegotiated on one line
  const [priceLine, setPriceLine] = useState<PosLine | null>(null)
  const [priceText, setPriceText] = useState('')

  // Whole-ticket discount, as a percentage of it
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountText, setDiscountText] = useState('')

  /**
   * The till is taking goods BACK.
   *
   * A return used to be per line: ring the article up, then find the little
   * undo button on its row. That is fine once and wrong twenty times — the
   * cashier is holding the goods, not the mouse. As a mode, the same scan that
   * sells is the scan that takes back, and the screen turns red so that going
   * on to the next customer without leaving it is not something that can
   * happen quietly.
   */
  const [returnMode, setReturnMode] = useState(false)

  // Settlement
  const [payOpen, setPayOpen] = useState(false)
  const [payKind, setPayKind] = useState<PayKind>('cash')
  const [customerId, setCustomerId] = useState('')
  const [received, setReceived] = useState('')
  const [payError, setPayError] = useState('')

  /**
   * In-flight guard. `busy` is React state and only lands on the next render,
   * so a second Enter (or a held-down key repeating at ~30ms against a ~150ms
   * round-trip) would slip through and record the same ticket twice — double
   * stock movement and, on credit, double debt. A ref flips synchronously.
   */
  const submitting = useRef(false)

  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [lastTicket, setLastTicket] = useState<TicketData | null>(null)
  const [paper, setPaper] = useState<'thermal' | 'a4'>('thermal')

  const symbol = t(moneySymbolKey())
  const money = (m: number) => formatMoney(m, { symbol })
  const focusScan = () => scanRef.current?.focus()

  /**
   * Dialogs that own the keyboard. The receipt shown after a sale is
   * deliberately not one of them: scanning the next customer's first article
   * closes it and opens the next ticket by itself, which is one less button to
   * find between two customers.
   */
  const dialogBlocking =
    payOpen ||
    miscOpen ||
    newOpen ||
    discountOpen ||
    packOpen ||
    moreOpen ||
    !!serviceAsk ||
    !!matches ||
    !!priceLine
  const anyDialogOpen = dialogBlocking || !!ticket

  /**
   * Read from inside the scanner wedge, which is armed once and outlives the
   * render it was created in. A ref rather than the value itself, so a scan
   * never has to re-arm the listener.
   */
  const blocked = useRef(false)
  blocked.current = dialogBlocking || busy

  // The cursor belongs in the scan field at all times - coming back from any
  // dialog, the next scan must land without a click.
  useEffect(() => {
    if (!anyDialogOpen) focusScan()
  }, [anyDialogOpen])

  /**
   * A parked ticket can outlive the product it holds: if the article was
   * deleted from the stock meanwhile, the whole atomic batch would be rejected
   * and nothing would be recorded. Catch it before the cashier tries to cash in.
   */
  const staleLines = useMemo(() => {
    // Only skip the check while the list is still loading. An empty collection
    // is a real answer: every line on a resumed ticket is genuinely stale.
    if (productsLoading) return []
    // A Set, not products.some(): this runs on every Firestore snapshot, and
    // every sale triggers one, so the linear scan per line was ~36k string
    // comparisons per sale on a shop with a few thousand articles.
    const live = new Set(products.map((p) => p.id))
    return cart.lines.filter((l) => l.productId && !live.has(l.productId))
  }, [cart.lines, products, productsLoading])

  const canSettle = cart.lines.length > 0 && staleLines.length === 0 && !busy
  const isRefund = cart.total < 0

  // --- services sold by scanning a printed label -------------------------

  /**
   * Every service, switched off ones included. "This service is off" is a far
   * more useful answer to a scanned label than "unknown code", which sends the
   * owner hunting through the stock for something that was never there.
   */
  const allServices = useMemo(() => shop.services ?? [], [shop.services])
  const services = useMemo(
    () => allServices.filter((s) => s.active !== false),
    [allServices],
  )

  /** Folded on both sides, so IMPRIMER, imprimer and Imprimer are one code. */
  const byServiceCode = useMemo(() => {
    const index = new Map<string, QuickService[]>()
    for (const service of allServices) {
      const key = foldCode(service.code)
      if (key === '') continue
      const already = index.get(key)
      if (already) already.push(service)
      else index.set(key, [service])
    }
    return index
  }, [allServices])

  const findServiceByCode = useCallback(
    (term: string, physical?: string | null): QuickService[] => {
      for (const candidate of [term, physical]) {
        if (!candidate) continue
        const hit = byServiceCode.get(foldCode(candidate))
        if (hit) return hit
      }
      return []
    },
    [byServiceCode],
  )

  const askService = useCallback((service: QuickService) => {
    setNotice('')
    setCanCreate(false)
    setPackOpen(false)
    setServiceError('')
    setServicePrice(
      service.defaultPrice ? String(fromMinor(service.defaultPrice)) : '',
    )
    setServiceAsk(service)
    beepOk()
  }, [])

  const confirmService = () => {
    const service = serviceAsk
    if (!service) return
    const price = parseMoney(servicePrice)
    if (price === null || price <= 0) {
      setServiceError(t('services.priceRequired'))
      return
    }
    cart.addMisc(service.name, price, returnMode)
    setLastAdded({ productId: null, name: service.name, price })
    setServiceAsk(null)
    setServicePrice('')
    beepDone()
    focusScan()
  }

  // --- packs ------------------------------------------------------------

  const activePacks = useMemo(() => packs.filter((p) => p.active !== false), [packs])

  const openPacks = () => {
    closeSuggestions()
    setPackOpen(true)
  }

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  /**
   * Why a pack cannot be sold as it stands, or null when it can.
   *
   * A pack is a recipe over live stock, so it can rot: the owner switches it
   * off for the season, or an article in it is deleted from the stock. Neither
   * may end as a silent no-op in front of a customer.
   */
  const packProblem = useCallback(
    (pack: Pack): 'inactive' | 'broken' | null => {
      if (pack.active === false) return 'inactive'
      // Walked by hand rather than through resolvePack: this runs for every
      // pack on every Firestore snapshot, and every sale is a snapshot.
      let sellable = 0
      for (const item of pack.items) {
        if (!productById.has(item.productId)) return 'broken'
        if (item.qty > 0) sellable += 1
      }
      return sellable === 0 ? 'broken' : null
    },
    [productById],
  )

  const sellablePacks = useMemo(
    () => activePacks.filter((pack) => !packProblem(pack)),
    [activePacks, packProblem],
  )

  const addPack = useCallback(
    (pack: Pack) => {
      const problem = packProblem(pack)
      if (problem) {
        // Never fail silently: the cashier is waiting for a line to appear.
        setNoticeStatus('warning')
        setNotice(
          t(problem === 'inactive' ? 'packs.inactiveScan' : 'packs.brokenScan', {
            name: pack.name,
          }),
        )
        setCanCreate(false)
        beepError()
        setPackOpen(false)
        focusScan()
        return
      }
      const lines = packToLines(pack, products)
      cart.addPack(
        lines.map((l) => ({ product: l.product, qty: l.qty, unitPrice: l.unitPrice })),
        { packId: pack.id, packName: pack.name, packPrice: pack.price },
        returnMode,
      )
      setLastAdded({ productId: null, name: pack.name, price: pack.price })
      setCanCreate(false)

      // The pack still sells — the shelf knows better than the count — but a
      // pack that empties the stock of one of its articles is worth hearing
      // about while the customer is still at the counter.
      const short = resolvePack(pack, products).short
      if (short.length > 0) {
        setNoticeStatus('info')
        setNotice(
          t('packs.shortStock', { names: short.map((m) => m.item.name).join(', ') }),
        )
        beepWarn()
      } else {
        setNotice('')
        beepOk()
      }

      setPackOpen(false)
      focusScan()
    },
    [cart.addPack, packProblem, products, t, returnMode],
  )

  // --- scanning ---------------------------------------------------------

  /**
   * barcode -> the products carrying it. Indexed under both the code as typed
   * and its separator-free form, so a hyphenated ISBN on the shelf and the bare
   * digits the scanner reads land on the same article. Two products can share
   * one code (a data-entry slip), which is why the value is a list.
   */
  const byBarcode = useMemo(() => {
    const index = new Map<string, Product[]>()
    const put = (key: string, p: Product) => {
      if (!key) return
      const already = index.get(key)
      if (!already) index.set(key, [p])
      else if (!already.includes(p)) already.push(p)
    }
    for (const p of products) {
      const code = codeOf(p.barcode)
      if (!code) continue
      put(code, p)
      put(loose(code), p)
    }
    return index
  }, [products])

  /**
   * `physical` is the same burst read off the physical keys: on the French
   * AZERTY layout these machines run, a scanner still set to US sends the
   * digit row as &é"'(-è_çà, and this is what turns that back into digits.
   */
  const findByCode = useCallback(
    (term: string, physical?: string | null) => {
      for (const candidate of [term, loose(term), physical, physical && loose(physical)]) {
        if (!candidate) continue
        const hit = byBarcode.get(candidate)
        if (hit) return hit
      }
      return null
    },
    [byBarcode],
  )

  /**
   * The same index for packs. Switched-off and broken packs are indexed too —
   * "this pack is off" is a far more useful answer than "unknown code", and it
   * is the only way the cashier learns why the label he just scanned did
   * nothing.
   */
  const byPackBarcode = useMemo(() => {
    const index = new Map<string, Pack[]>()
    const put = (key: string, pack: Pack) => {
      if (!key) return
      const already = index.get(key)
      if (!already) index.set(key, [pack])
      else if (!already.includes(pack)) already.push(pack)
    }
    for (const pack of packs) {
      const code = codeOf(pack.barcode)
      if (!code) continue
      put(code, pack)
      put(loose(code), pack)
    }
    return index
  }, [packs])

  const findPackByCode = useCallback(
    (term: string, physical?: string | null): Pack[] => {
      for (const candidate of [term, loose(term), physical, physical && loose(physical)]) {
        if (!candidate) continue
        const hit = byPackBarcode.get(candidate)
        if (hit) return hit
      }
      return []
    },
    [byPackBarcode],
  )

  const addToCart = useCallback(
    (p: Product) => {
      cart.addProduct(p, returnMode)
      setLastAdded({ productId: p.id, name: p.name, price: p.salePrice })
      setNotice('')
      setCanCreate(false)
      setMatches(null)
      // Selling below the counted stock is allowed - the shelf knows better
      // than the count - but it says so out loud instead of silently.
      if (p.quantity <= 0) beepWarn()
      else beepOk()
      focusScan()
    },
    [cart.addProduct, returnMode],
  )

  /** Rings up whichever of the two a code resolved to. */
  const take = useCallback(
    (choice: ScanChoice) => {
      if (choice.kind === 'pack') addPack(choice.pack)
      else if (choice.kind === 'service') askService(choice.service)
      else addToCart(choice.product)
    },
    [addPack, addToCart, askService],
  )

  /**
   * The one place a code becomes a line on the ticket, whatever brought it in:
   * the scanner, the Enter key, or a barcode completed while typing.
   */
  const lookup = useCallback(
    (raw: string, physical: string | null = null) => {
      const term = codeOf(raw)
      if (!term) {
        setScan('')
        return
      }
      // A new code is a new question. Cleared here rather than in each of the ten
      // branches below, so a recognition banner can never outlive the article it
      // was about — and so a late reply about the PREVIOUS code finds missCode
      // changed and stays quiet.
      setRecognised(null)
      missCode.current = ''

      // The scanner's trailing Enter, arriving just after the code it belongs
      // to already went in.
      if (term === consumed.current.term && performance.now() - consumed.current.at < CONSUMED_MS) {
        setScan('')
        return
      }

      // A dialog owns the screen, the sale is being written, or the navigation
      // drawer is open. The scanner's Enter has already been swallowed by the
      // wedge; drop the code rather than drop an article into a basket that is
      // on its way out. Queried from the DOM so a dialog added later cannot be
      // forgotten here.
      if (
        blocked.current ||
        document.querySelector('[data-scope="drawer"][data-state="open"]')
      ) {
        // The refusing tone, not the warning one: nothing was added and the
        // cashier has to scan again once the screen is his own.
        beepError()
        // The characters have to go, and the code has to count as dealt with.
        // Left in the field they would be picked up by the auto-add effect the
        // moment the sale finished — quietly landing this customer's article on
        // the NEXT customer's ticket.
        consumed.current = { term, at: performance.now() }
        setScan('')
        setNoticeStatus('warning')
        setNotice(t('pos.scanRefused'))
        return
      }

      consumed.current = { term, at: performance.now() }
      setScan('')
      setCanCreate(false)

      // A scan is also how the cashier says "next customer, please".
      setTicket(null)
      focusScan()

      // Packs are read against live stock and services live on the settings
      // document, so ALL THREE have to be in before a code can honestly be
      // called unknown — otherwise a photocopy label scanned on a cold start
      // offers to create an article called IMPRIMER.
      if (productsLoading || packsLoading || shopLoading) {
        // Answering "unknown code" here would be a lie, and offering to create
        // the article would duplicate it. Hold it and replay it below.
        if (pendingScans.current.length < MAX_PENDING) pendingScans.current.push(term)
        setNoticeStatus('info')
        setNotice(t('pos.waitingStock'))
        return
      }

      setNotice('')

      // A code can be printed on a shelf label and on a pack label alike.
      // Sellable packs stand next to the articles as equal candidates; the
      // rest are kept aside to explain themselves if nothing else matches.
      const packHits = findPackByCode(term, physical)
      const sellableHits = packHits.filter((pack) => !packProblem(pack))
      const exact = findByCode(term, physical) ?? []
      const serviceHits = findServiceByCode(term, physical)
      const liveServices = serviceHits.filter((s) => s.active !== false)

      const exactChoices: ScanChoice[] = [
        ...liveServices.map((service): ScanChoice => ({ kind: 'service', service })),
        ...sellableHits.map((pack): ScanChoice => ({ kind: 'pack', pack })),
        ...exact.map((product): ScanChoice => ({ kind: 'product', product })),
      ]

      if (exactChoices.length === 1) {
        take(exactChoices[0])
        return
      }
      if (exactChoices.length > 1) {
        setMatches(exactChoices.slice(0, 40))
        setMatchKind('code')
        setNoticeStatus('warning')
        setNotice(t('pos.sameCode'))
        beepWarn()
        return
      }

      if (serviceHits.length > 0) {
        setNoticeStatus('warning')
        setNotice(t('services.inactiveScan', { name: serviceHits[0].name }))
        setCanCreate(false)
        beepError()
        focusScan()
        return
      }

      // The label IS known — it is just not sellable right now. Saying which
      // beats "unknown code", which would send the owner hunting in the stock.
      if (packHits.length > 0) {
        const pack = packHits[0]
        setNoticeStatus('warning')
        setNotice(
          t(packProblem(pack) === 'inactive' ? 'packs.inactiveScan' : 'packs.brokenScan', {
            name: pack.name,
          }),
        )
        setCanCreate(false)
        beepError()
        focusScan()
        return
      }

      // Folded the same way the suggestion list folds, or Enter would answer
      // "no such article" for the very row the cashier is looking at.
      const needle = fold(term)
      const found: ScanChoice[] = [
        ...services
          .filter((service) => fold(service.name).includes(needle))
          .map((service): ScanChoice => ({ kind: 'service', service })),
        ...activePacks
          .filter((pack) => fold(pack.name).includes(needle) && !packProblem(pack))
          .map((pack): ScanChoice => ({ kind: 'pack', pack })),
        ...products
          .filter(
            (p) =>
              fold(p.name).includes(needle) ||
              fold(`${p.family ?? ''} ${p.variant ?? ''}`).includes(needle),
          )
          .map((product): ScanChoice => ({ kind: 'product', product })),
      ]

      if (found.length === 1) {
        take(found[0])
        return
      }
      if (found.length > 1) {
        // Never guess: picking the first alphabetical match sells the wrong item.
        setMatches(found.slice(0, 40))
        setMatchKind('name')
        setNoticeStatus('warning')
        setNotice(t('pos.manyMatches', { term }))
        beepWarn()
        return
      }

      setNoticeStatus('warning')
      setNotice(t('pos.notFound', { term }))
      setCanCreate(true)
      beepError()
      /**
       * looksLikeCode(), the same test the stock page uses (StockPage.tsx:522).
       * /^\d+$/ was stricter in the one direction that hurts: a hyphenated ISBN,
       * or a code with a space in it, failed it — so the term went into the NAME
       * field and the barcode was left empty. The owner was then left with a
       * product called 978-2-07-036822-8 that no future scan could match, that no
       * title search could find, and that no catalogue entry could ever describe.
       *
       * loose() on the way in, so the stored code is the digits the scanner will
       * actually send next time, not the separators a catalogue happened to print.
       */
      const missed = looksLikeCode(term) ? loose(term) : ''
      setNewCode(missed)
      setNewName(looksLikeCode(term) ? '' : term)
      focusScan()

      /*
        ASK THE SHARED CATALOGUE HERE, ON THE MISS ITSELF.

        This used to happen only after the owner clicked "Créer ce produit", and
        that was the wrong moment by one step: a shop with an empty stock scans a
        BIC, reads "Aucun produit pour 3086123275133", and concludes the catalogue
        does not work. He never gets as far as the dialog where the name was
        waiting for him. The one screen where recognition is worth anything is the
        one where the article is in his hand.

        It is still not on the scan PATH — lookup() runs on keystrokes and on
        every code that matches something, and neither needs the catalogue. This
        is the miss tail: it fires once, for a code this shop does not stock,
        which is exactly and only when the question is worth asking.

        Late answers are dropped rather than applied, because by then the cashier
        may have moved on to the next article. @see missCode
      */
      missCode.current = missed
      if (missed !== '') {
        void lookupCatalog(missed).then((hit) => {
          if (!hit || !alive.current) return
          if (missCode.current !== missed) return
          setRecognised(hit)
          setNewName((current) => (current.trim() === '' ? hit.name : current))
          // Green, not orange. Nothing has gone wrong: the article is known, it
          // simply is not in this shop's stock yet, and adding it is two prices
          // and a quantity away.
          setNoticeStatus('success')
          setNotice(t('pos.recognisedScan', { name: hit.name }))
        })
      }
    },
    [
      take,
      activePacks,
      services,
      findByCode,
      findPackByCode,
      findServiceByCode,
      packProblem,
      products,
      productsLoading,
      packsLoading,
      shopLoading,
      t,
    ],
  )

  /**
   * Is any code in the shop strictly longer than this one and starting with it?
   *
   * If so the burst is not over — a pack coded 2001 must not fire while the
   * reader is still halfway through 20015. Folded on both sides so a service
   * code spelt in any case is compared the same way.
   */
  const hasLongerCode = useCallback(
    (term: string) => {
      const key = foldCode(term)
      if (key === '') return false
      for (const p of products) {
        // foldedOf, not foldCode: this runs inside the keydown handler and
        // re-folding a few thousand barcodes there is a visible hitch on the
        // one path this change exists to make faster.
        const code = foldedOf(p).code
        if (code !== '' && code !== key && code.startsWith(key)) return true
      }
      for (const pack of packs) {
        const code = foldCode(pack.barcode)
        if (code !== '' && code !== key && code.startsWith(key)) return true
      }
      for (const service of allServices) {
        const code = foldCode(service.code)
        if (code !== '' && code !== key && code.startsWith(key)) return true
      }
      return false
    },
    [products, packs, allServices],
  )

  /**
   * Told to the wedge so it can ring an article up on the last character
   * instead of waiting to hear silence. Deliberately cheap: the map lookups
   * miss for every character but the last, and only then is the O(n) "is
   * anything longer?" scan paid for once.
   */
  const isCompleteCode = useCallback(
    (code: string, physical: string | null) => {
      if (blocked.current || productsLoading || packsLoading || shopLoading) return false
      const known = (term: string) =>
        !!findByCode(term) ||
        findPackByCode(term).length > 0 ||
        findServiceByCode(term).length > 0
      for (const candidate of [code, physical]) {
        if (!candidate) continue
        if (known(candidate) && !hasLongerCode(candidate)) return true
      }
      return false
    },
    [
      findByCode,
      findPackByCode,
      findServiceByCode,
      hasLongerCode,
      productsLoading,
      packsLoading,
      shopLoading,
    ],
  )

  /**
   * The hand scanner types the code and simply stops - it sends no Enter. The
   * wedge recognises the burst by its speed and rings the article up on its
   * own, from anywhere on the page.
   */
  const scanner = useBarcodeScanner({
    targetRef: scanRef,
    onScan: lookup,
    // A machine is typing: whatever list was open is not what it is after.
    onBurstStart: closeSuggestions,
    // Known code, nothing longer starts with it: do not wait for the silence.
    isComplete: isCompleteCode,
  })

  /**
   * A complete barcode sitting in the field IS an article - no key to press.
   * Held back while a longer code starts with the same digits, so a code that
   * is the beginning of another one is never rung up early.
   */
  useEffect(() => {
    const term = codeOf(scan)
    if (term.length < 4 || productsLoading || packsLoading || shopLoading || busy || dialogBlocking)
      return
    if (term === consumed.current.term && performance.now() - consumed.current.at < CONSUMED_MS) {
      return
    }
    const hits: ScanChoice[] = [
      ...findServiceByCode(term)
        .filter((s) => s.active !== false)
        .map((service): ScanChoice => ({ kind: 'service', service })),
      ...findPackByCode(term)
        .filter((pack) => !packProblem(pack))
        .map((pack): ScanChoice => ({ kind: 'pack', pack })),
      ...(findByCode(term) ?? []).map((product): ScanChoice => ({ kind: 'product', product })),
    ]
    if (hits.length === 0) return
    // A code that is the beginning of a longer one is never rung up early.
    if (hasLongerCode(term)) return
    // The wedge is still holding the same characters; without this it would
    // fire a moment later and ring the very same unit up twice.
    scanner.reset()
    consumed.current = { term, at: performance.now() }
    setScan('')
    // Typed by hand rather than scanned, but a shared code is still a shared
    // code — ask which one instead of leaving the field sitting there.
    if (hits.length > 1) {
      setMatches(hits.slice(0, 40))
      setMatchKind('code')
      setNoticeStatus('warning')
      setNotice(t('pos.sameCode'))
      beepWarn()
      return
    }
    take(hits[0])
  }, [
    scan,
    findByCode,
    findPackByCode,
    findServiceByCode,
    hasLongerCode,
    packProblem,
    productsLoading,
    packsLoading,
    shopLoading,
    busy,
    dialogBlocking,
    take,
    scanner,
    t,
  ])

  /** The stock arrived - serve every code that was scanned while it loaded. */
  useEffect(() => {
    if (productsLoading || packsLoading || shopLoading) return
    const held = pendingScans.current
    if (held.length === 0) return
    pendingScans.current = []
    for (const code of held) {
      // Each code was stamped as dealt with when it went on hold, and the same
      // article can legitimately appear twice in the queue. Clear the stamp
      // before every replay, or the second copy is mistaken for a scanner's
      // trailing Enter and dropped.
      consumed.current = { term: '', at: 0 }
      lookup(code)
    }
  }, [productsLoading, packsLoading, shopLoading, lookup])

  /**
   * With the chooser open, 1 / 2 / 3 pick an article — a till is driven with
   * one hand. Keys arriving at machine speed are ignored: that is a scan
   * hitting the open dialog, not a choice.
   */
  const lastKeyAt = useRef(0)
  useEffect(() => {
    if (!matches) return
    const onKey = (e: KeyboardEvent) => {
      const now = performance.now()
      const gap = now - lastKeyAt.current
      lastKeyAt.current = now
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return
      if (!/^[1-9]$/.test(e.key)) return
      if (gap < 90) return
      const pick = matches[Number(e.key) - 1]
      if (!pick) return
      e.preventDefault()
      chooseMatchRef.current(pick)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [matches])

  // ---- typed search -----------------------------------------------------

  /**
   * A scan is over in a few tens of milliseconds and clears the field; a human
   * pauses. Waiting for that pause is what tells the two apart without having
   * to classify keystrokes.
   */
  const SUGGEST_DEBOUNCE_MS = 110
  useEffect(() => {
    const term = scan.trim()
    if (term === '') {
      setQuery('')
      return
    }
    const id = setTimeout(() => setQuery(term), SUGGEST_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [scan])

  useEffect(() => setHighlight(-1), [query])

  const suggestions = useMemo(
    () =>
      dialogBlocking || busy
        ? []
        // Only packs that can actually be sold: offering one whose article was
        // deleted would put a dead row under the cashier's finger.
        : searchChoices(products, sellablePacks, services, query, 8),
    [products, sellablePacks, services, query, dialogBlocking, busy],
  )
  const suggestOpen = suggestions.length > 0

  const onScanInput = (value: string) => setScan(value)

  const pickSuggestion = (choice: ScanChoice) => {
    closeSuggestions()
    consumed.current = { term: codeOf(scan), at: performance.now() }
    scanner.reset()
    setScan('')
    take(choice)
  }

  const onScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, -1))
    } else if (e.key === 'Escape') {
      // Only the list closes; a second Escape reaches the global handler that
      // sends the cursor back to the scan field.
      e.preventDefault()
      e.stopPropagation()
      closeSuggestions()
    } else if (e.key === 'Enter' && highlight >= 0) {
      // With nothing highlighted this falls through to the form submit, which
      // is the behaviour the scanner and the F-keys already depend on.
      e.preventDefault()
      const picked = suggestions[highlight]
      if (picked) pickSuggestion(picked)
    }
  }

  /**
   * The ticket, newest first.
   *
   * The cashier looks at one row: the one he just scanned. At the bottom of a
   * growing list that row is the one the box hides, so the order is turned
   * over for the screen only — the ticket that prints and the sale that is
   * recorded keep the order things were rung up in.
   *
   * A pack's own lines stay together and in their own order: they are one
   * thing the customer bought, and reading them backwards would not match the
   * price printed next to the group.
   */
  const displayLines = useMemo(() => {
    const groups: PosLine[][] = []
    for (const line of cart.lines) {
      const last = groups[groups.length - 1]
      if (line.packUid && last && last[0].packUid === line.packUid) last.push(line)
      else groups.push([line])
    }
    return groups.reverse().flat()
  }, [cart.lines])

  /**
   * What was just rung up — the whole pack, when it was a pack. Fades with the
   * confirmation above it, so the ticket does not keep a stale row lit up.
   */
  const newestKey = useMemo(() => {
    const last = cart.lines[cart.lines.length - 1]
    if (!last || !lastAdded) return null
    return last.packUid ?? last.id
  }, [cart.lines, lastAdded])

  /** Newest first means the top of the box is where the work appears. */
  useEffect(() => {
    const el = ticketScrollRef.current
    if (el) el.scrollTop = 0
  }, [cart.lines.length])

  /** The confirmation fades by itself; it must not outlive the next customer. */
  useEffect(() => {
    if (!lastAdded) return
    const id = setTimeout(() => setLastAdded(null), 6000)
    return () => clearTimeout(id)
  }, [lastAdded])

  const submitScan = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    scanner.reset()
    lookup(scan)
  }

  /**
   * Bluetooth imagers and phone-camera scanners hand the code over as a paste
   * instead of typing it, so the burst detector never sees a single keystroke.
   */
  const pasteScan = (text: string) => {
    const term = codeOf(text)
    if (term.length < 4) return false
    scanner.reset()
    lookup(term)
    return true
  }

  const chooseMatch = (choice: ScanChoice) => {
    setMatches(null)
    setScan('')
    take(choice)
  }
  // Read by the number-key shortcut above, which is bound once per dialog.
  const chooseMatchRef = useRef(chooseMatch)
  chooseMatchRef.current = chooseMatch

  /** Removes one unit of the article just added - the "oops, twice" button. */
  const undoLastAdded = () => {
    const target = lastAdded
    setLastAdded(null)
    if (!target) return
    for (let i = cart.lines.length - 1; i >= 0; i -= 1) {
      const l = cart.lines[i]
      const same = target.productId
        ? l.productId === target.productId
        : l.productId === null && l.name === target.name
      if (same && l.qty !== 0) {
        // One unit back toward zero, whichever side of it the line is on.
        // setQty removes the line when it lands on zero.
        cart.setQty(l.id, l.qty > 0 ? l.qty - 1 : l.qty + 1)
        break
      }
    }
    focusScan()
  }

  /**
   * "3 articles" tells the cashier nothing when three tickets are waiting. The
   * first article and the amount are what he actually recognises a basket by.
   */
  const parkLabel = () => {
    const first = cart.lines[0]?.name ?? ''
    return `${first} · ${cart.itemCount} ${t('pos.items')} · ${money(cart.total)}`
  }

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    setSoundEnabled(next)
    if (next) beepOk()
    focusScan()
  }

  // --- create a product from the till ------------------------------------
  const openNewProduct = () => {
    setNewPrice('')
    setNewCost('')
    setNewError('')
    setNewOpen(true)

    /*
      Ask the shared catalogue what this barcode is called — HERE, on a
      deliberate "create this product", and never on the scan path itself.

      The scan path runs on every keystroke of every code the cashier passes over
      the reader, and an article the shop already stocks needs no catalogue at
      all. This runs once, when the owner has already decided to create
      something, which is also the only moment the answer is worth anything.

      Fire-and-forget with a short deadline, and it never overwrites: if the
      lookup comes back after he has started typing, his own words win. A name
      that arrives from the network and takes the field out from under him would
      be worse than no help at all.
    */
    // Normally already answered by the miss tail above, which is where the owner
    // sees it. This is the second chance: the dialog can also be opened after a
    // NAME search, and a lookup that timed out on a slow line deserves another
    // go now that he has stopped to fill a form. Nothing is cleared first —
    // clearing would flash the banner off and on for the common case.
    if (!recognised) {
      void lookupCatalog(newCode).then((hit) => {
        if (!hit || !alive.current) return
        setNewName((current) => (current.trim() === '' ? hit.name : current))
        setRecognised(hit)
      })
    }
  }

  const saveNewProduct = async () => {
    if (newName.trim() === '') {
      setNewError(t('stock.nameRequired'))
      return
    }
    const salePrice = parseMoney(newPrice) ?? 0
    setBusy(true)
    setNewError('')
    try {
      const id = await createProduct({
        barcode: newCode.trim() || null,
        name: newName.trim(),
        costPrice: parseMoney(newCost) ?? 0,
        salePrice,
        quantity: 0,
        lowStockThreshold: 0,
      })
      // Offered to the shared catalogue, so the next shop that scans this book
      // is handed the name instead of typing it. Into this shop's own subtree,
      // queued like every other write, and silent either way — see
      // src/lib/catalog.ts. Nothing here waits on it and nothing reports it.
      contributeToCatalog(newCode, newName)
      if (!alive.current) return
      addToCart({
        id,
        barcode: newCode.trim() || null,
        name: newName.trim(),
        costPrice: parseMoney(newCost) ?? 0,
        salePrice,
        quantity: 0,
        lowStockThreshold: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      setNewOpen(false)
      setNotice('')
      setCanCreate(false)
      setNewName('')
      setNewCode('')
      focusScan()
    } catch {
      if (alive.current) setNewError(t('common.error'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  // --- free line ---------------------------------------------------------
  const addMisc = () => {
    const price = parseMoney(miscPrice)
    if (miscName.trim() === '' || price === null) return
    cart.addMisc(miscName.trim(), price, returnMode)
    setLastAdded({ productId: null, name: miscName.trim(), price })
    beepOk()
    setMiscOpen(false)
    setMiscName('')
    setMiscPrice('')
    focusScan()
  }

  // --- settlement --------------------------------------------------------
  const openPay = (kind: PayKind) => {
    if (!canSettle) return
    setPayKind(kind)
    setPayError('')
    setCustomerId('')
    setReceived('')
    setPayOpen(true)
  }

  const finish = async (
    mode: PaymentMode,
    paidNow: number,
    receivedNow: number,
    client: string | null,
  ) => {
    if (cart.lines.length === 0 || staleLines.length > 0) return
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setSaveError('')
    const snapshot = {
      lines: cart.lines,
      subtotal: cart.subtotal,
      discount: cart.discount,
      total: cart.total,
    }
    try {
      // Not a network wait: recordSale mints the ticket id locally, applies the
      // batch to this device's durable cache and hands it to track() without
      // awaiting the server (see useSales.recordSale). The ticket below is
      // therefore printable straight away, offline or not — and it must be, or
      // the cashier is left holding a customer while the ADSL thinks about it.
      const rec = recordSale({
        items: snapshot.lines.map(({ productId, name, qty, unitPrice, unitCost }) => ({
          productId,
          name,
          qty,
          unitPrice,
          unitCost,
        })),
        subtotal: snapshot.subtotal,
        discount: snapshot.discount,
        total: snapshot.total,
        paid: paidNow,
        received: receivedNow,
        mode,
        customerId: client,
        customerName: customers.find((c) => c.id === client)?.name ?? null,
      })
      if (!alive.current) return
      const data: TicketData = {
        ticketNo: rec.ticketNo,
        date: rec.date,
        lines: snapshot.lines,
        subtotal: snapshot.subtotal,
        discount: snapshot.discount,
        total: snapshot.total,
        paid: paidNow,
        received: receivedNow,
        mode,
        clientName: customers.find((c) => c.id === client)?.name,
      }
      setTicket(data)
      setLastTicket(data)
      cart.clear()
      // The next customer is a sale until the cashier says otherwise.
      setReturnMode(false)
      setLastAdded(null)
      beepDone()
      setPayOpen(false)
      setCustomerId('')
      setReceived('')
    } catch {
      // Only a refusal raised before anything was queued reaches here now — an
      // unpaid balance with no client attached, or a shop id that has gone. A
      // rejection from the SERVER cannot: it arrives long after this ticket was
      // printed, so it is track()'s `denied` flag and the header banner that
      // report it, not this line.
      //
      // The basket is deliberately left untouched: nothing was written, so the
      // cashier can simply try again instead of re-scanning the whole ticket.
      // The dialog stays open on purpose: the cashier is mid-payment and the
      // retry button has to be where he is already looking.
      if (alive.current) {
        setSaveError(t('pos.saveFailed'))
        beepError()
      }
    } finally {
      submitting.current = false
      if (alive.current) setBusy(false)
    }
  }

  const confirmPay = async () => {
    if (payKind === 'cash') {
      const given = parseMoney(received)
      // An empty field means "exact money" — one keystroke for the common case.
      const receivedNow = given ?? cart.total
      if (receivedNow < cart.total) {
        setPayError(t('pos.notEnough'))
        return
      }
      await finish('paid', cart.total, receivedNow, null)
      return
    }

    if (!customerId) {
      setPayError(t('pos.needClient'))
      return
    }
    if (payKind === 'credit') {
      await finish('credit', 0, 0, customerId)
      return
    }
    const given = Math.max(0, parseMoney(received) ?? 0)
    const paidNow = Math.min(given, cart.total)
    await finish(paidNow > 0 ? 'partial' : 'credit', paidNow, given, customerId)
  }

  /**
   * The paper format is a React state that the print stylesheet reads off the
   * DOM, so printing has to wait for the render — a timer would sometimes fire
   * first and print the previous format.
   */
  const [printRequest, setPrintRequest] = useState(0)
  const doPrint = (which: 'thermal' | 'a4') => {
    setPaper(which)
    setPrintRequest((n) => n + 1)
  }
  useEffect(() => {
    if (printRequest === 0) return
    window.print()
  }, [printRequest, paper])

  const reprintLast = () => {
    if (!lastTicket) return
    setTicket(lastTicket)
  }

  // --- keyboard shortcuts (a till is driven without a mouse) -------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anyDialogOpen) return
      if (e.key === 'F2') {
        e.preventDefault()
        openPay('cash')
      } else if (e.key === 'F3') {
        e.preventDefault()
        openPay('partial')
      } else if (e.key === 'F4') {
        e.preventDefault()
        if (cart.lines.length > 0) cart.park(parkLabel())
      } else if (e.key === 'F6') {
        e.preventDefault()
        setMiscOpen(true)
      } else if (e.key === 'F7') {
        e.preventDefault()
        openPacks()
      } else if (e.key === 'F8') {
        e.preventDefault()
        setReturnMode((on) => !on)
        focusScan()
      } else if (e.key === 'Escape') {
        focusScan()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // --- quick cash denominations -----------------------------------------
  const quickCash = useMemo(() => {
    const due = cart.total
    if (due <= 0) return []
    const steps = [1000, 5000, 10000, 20000, 50000]
    const set = new Set<number>()
    for (const s of steps) {
      const v = Math.ceil(due / s) * s
      if (v > due) set.add(v)
    }
    return [...set].sort((a, b) => a - b).slice(0, 4)
  }, [cart.total])

  const receivedMinor = parseMoney(received) ?? 0
  const changeDue = Math.max(0, receivedMinor - cart.total)
  const remainingAfter = Math.max(0, cart.total - receivedMinor)

  return (
    <Flex
      direction="column"
      flex="1"
      minH={0}
      minW={0}
      gap={{ base: 2, md: 3 }}
      // On a short screen — a 1366x768 laptop with a bookmarks bar leaves
      // ~418px for the ticket and the totals together — the total and the pay
      // button give up some height so the buttons under them stay reachable.
      css={{
        '@media (max-height: 780px)': {
          '--pos-total-size': '2.25rem',
          '--pos-pay-h': '3.5rem',
        },
      }}
    >
      {/* ------------------------------------------------------------------
          Row 1 — the scan field. Never scrolls, never moves, always first.
          The page title is gone on purpose: the shell header already says
          "Caisse", and on a 1366x768 laptop that heading was costing the
          ticket three lines.
      ------------------------------------------------------------------ */}
      <Card.Root
        flexShrink={0}
        // In return mode the card itself is red. The cashier is looking at the
        // goods and the customer, not at a small badge somewhere.
        borderWidth={returnMode ? '3px' : '1px'}
        borderColor={returnMode ? 'red.solid' : 'border'}
        bg={returnMode ? 'red.subtle' : undefined}
      >
        <Card.Body p={{ base: 3, md: 4 }}>
          {returnMode && (
            <Flex align="center" gap={3} mb={3} wrap="wrap">
              <Flex
                align="center"
                gap={2}
                bg="red.solid"
                color="red.contrast"
                px={3}
                py={1.5}
                borderRadius="full"
                flexShrink={0}
              >
                <Undo2 size={20} />
                <Text fontWeight="bold" fontSize="lg" letterSpacing="wide">
                  {t('pos.returnMode')}
                </Text>
              </Flex>
              <Text color="red.fg" fontWeight="semibold" minW={0}>
                {t('pos.returnModeHint')}
              </Text>
              <Button
                size="md"
                colorPalette="red"
                variant="solid"
                ms="auto"
                flexShrink={0}
                onClick={() => {
                  setReturnMode(false)
                  focusScan()
                }}
              >
                {t('pos.returnModeExit')}
              </Button>
            </Flex>
          )}
          <form onSubmit={submitScan}>
            <Flex gap={2} align="center">
              <Box color="fg.subtle" flexShrink={0} display={{ base: 'none', sm: 'block' }}>
                <ScanLine size={28} />
              </Box>

              {/* The suggestion list hangs off this box, so it lines up with
                  the field and not with the card. */}
              <Box position="relative" flex="1" minW={0}>
                <Input
                  ref={scanRef}
                  size="xl"
                  autoFocus
                  value={scan}
                  onChange={(e) => onScanInput(e.target.value)}
                  onKeyDown={onScanKeyDown}
                  onPaste={(e) => {
                    if (pasteScan(e.clipboardData.getData('text'))) e.preventDefault()
                  }}
                  onBlur={closeSuggestions}
                  placeholder={t('pos.scanPlaceholder')}
                  fontSize="lg"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={suggestOpen}
                  aria-controls="pos-suggestions"
                />
                <ScanSuggestions
                  open={suggestOpen}
                  items={suggestions}
                  highlight={highlight}
                  term={scan}
                  symbol={symbol}
                  onPick={pickSuggestion}
                  onHighlight={setHighlight}
                  packLabel={t('packs.badge')}
                  serviceLabel={t('services.badge')}
                  askPriceLabel={t('services.askPrice')}
                  unitsLabel={(n) => t('packs.itemsCount', { count: n })}
                />
              </Box>

              <Button
                type="button"
                size="xl"
                variant="outline"
                colorPalette="brand"
                flexShrink={0}
                onClick={openPacks}
                title={`${t('packs.title')} · F7`}
              >
                <Boxes size={20} />
                <Text as="span" display={{ base: 'none', lg: 'inline' }}>
                  {t('packs.title')}
                </Text>
              </Button>

              <Button
                type="button"
                size="xl"
                variant="outline"
                flexShrink={0}
                onClick={() => setMiscOpen(true)}
                title={`${t('pos.misc')} · F6`}
              >
                <PackagePlus size={20} />
                <Text as="span" display={{ base: 'none', lg: 'inline' }}>
                  {t('pos.misc')}
                </Text>
              </Button>

              {/* Sale or return, on the same row as the scan field, because
                  the decision is made before the article is passed over. */}
              <Button
                type="button"
                size="xl"
                flexShrink={0}
                colorPalette="red"
                variant={returnMode ? 'solid' : 'outline'}
                onClick={() => {
                  setReturnMode((on) => !on)
                  focusScan()
                }}
                title={`${t('pos.returnMode')} · F8`}
              >
                <Undo2 size={20} />
                <Text as="span" display={{ base: 'none', lg: 'inline' }}>
                  {t('pos.returnMode')}
                </Text>
              </Button>

              <IconButton
                type="button"
                aria-label={sound ? t('pos.soundOn') : t('pos.soundOff')}
                title={sound ? t('pos.soundOn') : t('pos.soundOff')}
                variant="ghost"
                size="lg"
                flexShrink={0}
                onClick={toggleSound}
              >
                {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </IconButton>

              {lastTicket && (
                <IconButton
                  type="button"
                  aria-label={t('pos.reprint')}
                  title={t('pos.reprint')}
                  variant="ghost"
                  size="lg"
                  flexShrink={0}
                  onClick={reprintLast}
                >
                  <Printer size={20} />
                </IconButton>
              )}
            </Flex>
          </form>

          {/* The loud, unmissable "it went in". Big enough to read from
              arm's length, and undoable without hunting for a small icon. */}
          {lastAdded && (
            <Flex
              mt={3}
              align="center"
              gap={3}
              p={2}
              ps={3}
              borderWidth="2px"
              borderColor={returnMode ? 'red.emphasized' : 'green.emphasized'}
              bg={returnMode ? 'red.subtle' : 'green.subtle'}
              borderRadius="lg"
            >
              <Box color={returnMode ? 'red.fg' : 'green.fg'} flexShrink={0}>
                {returnMode ? <Undo2 size={30} /> : <CheckCircle2 size={30} />}
              </Box>
              <Box minW={0} flex="1">
                <Text
                  fontSize="lg"
                  fontWeight="bold"
                  color={returnMode ? 'red.fg' : 'green.fg'}
                  truncate
                >
                  {lastAdded.name}
                </Text>
                <Text color={returnMode ? 'red.fg' : 'green.fg'}>
                  {money(lastAdded.price)} ·{' '}
                  {returnMode ? t('pos.takenBack') : t('pos.added')}
                </Text>
              </Box>
              <Button
                size="md"
                variant="outline"
                colorPalette="red"
                flexShrink={0}
                onClick={undoLastAdded}
              >
                <Undo2 size={18} />
                {t('pos.undoAdd')}
              </Button>
            </Flex>
          )}

          {notice && (
            <Alert.Root status={noticeStatus} mt={3}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title fontSize="lg">{notice}</Alert.Title>
              </Alert.Content>
              {canCreate && !matches && (
                <Button size="lg" colorPalette="brand" flexShrink={0} onClick={openNewProduct}>
                  {t('pos.createFromScan')}
                </Button>
              )}
            </Alert.Root>
          )}

          {/* The article no longer exists, so the only move is dropping the
              lines — which is the button next to the message. */}
          {staleLines.length > 0 && (
            <Alert.Root status="error" mt={3}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title fontSize="lg">{t('pos.productDeleted')}</Alert.Title>
                <Alert.Description>
                  {staleLines.map((l) => l.name).join(', ')}
                </Alert.Description>
              </Alert.Content>
              <Button
                size="lg"
                colorPalette="red"
                flexShrink={0}
                onClick={() => {
                  cart.removeLines(staleLines.map((l) => l.id))
                  focusScan()
                }}
              >
                <Trash2 size={18} />
                {t('pos.removeStale')}
              </Button>
            </Alert.Root>
          )}
        </Card.Body>
      </Card.Root>

      {/* Parked tickets as a one-line strip: they used to be a card that only
          existed on the wide layout, where they pushed the totals down. */}
      {cart.parked.length > 0 && (
        <HStack flexShrink={0} gap={2} overflowX="auto" pb={1}>
          <Box color="fg.subtle" flexShrink={0}>
            <PauseCircle size={18} />
          </Box>
          {cart.parked.map((s) => (
            <HStack
              key={s.id}
              flexShrink={0}
              gap={0}
              borderWidth="1px"
              borderColor="border"
              borderRadius="full"
              bg="bg.panel"
            >
              <Button
                size="sm"
                variant="ghost"
                borderRadius="full"
                maxW="16rem"
                onClick={() => cart.resume(s.id)}
              >
                <PlayCircle size={16} />
                <Text truncate>{s.label}</Text>
              </Button>
              <IconButton
                aria-label={t('common.delete')}
                size="sm"
                variant="ghost"
                borderRadius="full"
                onClick={() => cart.dropParked(s.id)}
              >
                <X size={14} />
              </IconButton>
            </HStack>
          ))}
        </HStack>
      )}

      {/* ------------------------------------------------------------------
          Row 2 — the only region that flexes. The ticket scrolls INSIDE its
          own box, so the total below it can never be pushed off screen.
      ------------------------------------------------------------------ */}
      <Flex flex="1" minH={0} minW={0} gap={{ base: 3, xl: 4 }}>
        <Card.Root flex="1" minW={0} minH={0} overflow="hidden" display="flex" flexDirection="column">
          {cart.lines.length === 0 ? (
            <Flex flex="1" minH={0} align="center" justify="center" p={6}>
              <EmptyState.Root size="lg">
                <EmptyState.Content>
                  <EmptyState.Indicator>
                    <ScanLine size={48} />
                  </EmptyState.Indicator>
                  <EmptyState.Title>{t('pos.emptyTicket')}</EmptyState.Title>
                  <EmptyState.Description>{t('pos.emptyTicketHint')}</EmptyState.Description>
                </EmptyState.Content>
              </EmptyState.Root>
            </Flex>
          ) : (
            <Box
              ref={ticketScrollRef}
              flex="1"
              minH={0}
              overflowY="auto"
              overflowX="auto"
              overscrollBehavior="contain"
            >
              <Table.Root size="md" stickyHeader>
                <Table.Header>
                  <Table.Row bg="bg.panel">
                    <Table.ColumnHeader>{t('pos.product')}</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="center">{t('pos.qty')}</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      {t('pos.lineTotal')}
                    </Table.ColumnHeader>
                    <Table.ColumnHeader />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {displayLines.map((l, i) => {
                    const isReturn = l.qty < 0
                    const stale = staleLines.some((s) => s.id === l.id)
                    // The first line of a pack carries the group's heading.
                    const packHead =
                      !!l.packUid && displayLines[i - 1]?.packUid !== l.packUid
                    const newest = newestKey !== null && (l.packUid ?? l.id) === newestKey
                    return (
                      <Fragment key={l.id}>
                        {packHead && (
                          <Table.Row bg="bg.subtle">
                            <Table.Cell colSpan={4} py={2}>
                              <Flex align="center" gap={2} wrap="wrap">
                                <Boxes size={16} />
                                <Text fontWeight="bold">{l.packName}</Text>
                                <Badge colorPalette="brand" variant="subtle">
                                  {money(l.packPrice ?? 0)}
                                </Badge>
                              </Flex>
                            </Table.Cell>
                          </Table.Row>
                        )}
                        <Table.Row
                          // The row just scanned is marked until the
                          // confirmation above fades. A return keeps its red:
                          // what the line IS matters more than how new it is.
                          bg={isReturn ? 'red.subtle' : newest ? 'green.subtle' : undefined}
                          borderStartWidth={newest && !isReturn ? '4px' : 0}
                          borderStartColor="green.solid"
                        >
                          <Table.Cell py={2} ps={l.packUid ? 6 : undefined}>
                            <Text fontWeight="semibold" lineClamp={1}>
                              {l.name}
                            </Text>
                            <HStack gap={2} color="fg.muted" fontSize="sm" wrap="wrap">
                              <Text as="span">{money(l.unitPrice)}</Text>
                              {isReturn && (
                                <Badge colorPalette="red" size="sm">
                                  {t('pos.returnBadge')}
                                </Badge>
                              )}
                              {l.priceEdited && (
                                <Badge colorPalette="gray" variant="subtle" size="sm">
                                  {t('pos.priceChanged')}
                                </Badge>
                              )}
                              {stale && (
                                <Badge colorPalette="red" variant="subtle" size="sm">
                                  {t('pos.deletedBadge')}
                                </Badge>
                              )}
                              {!isReturn && l.productId && l.qty > l.stock && (
                                <Badge colorPalette="orange" variant="subtle" size="sm">
                                  {l.stock <= 0
                                    ? t('pos.outOfStock')
                                    : t('pos.stockLeft', { count: l.stock })}
                                </Badge>
                              )}
                            </HStack>
                          </Table.Cell>
                          <Table.Cell py={2}>
                            <HStack justify="center" gap={1}>
                              <IconButton
                                aria-label={t('common.decrease')}
                                size="md"
                                variant="outline"
                                onClick={() => cart.setQty(l.id, l.qty - 1)}
                              >
                                <Minus size={18} />
                              </IconButton>
                              <QtyCell
                                value={l.qty}
                                label={t('pos.editQty')}
                                onCommit={(n) => cart.setQty(l.id, n)}
                              />
                              <IconButton
                                aria-label={t('common.increase')}
                                size="md"
                                variant="outline"
                                onClick={() => cart.setQty(l.id, l.qty + 1)}
                              >
                                <Plus size={18} />
                              </IconButton>
                            </HStack>
                          </Table.Cell>
                          <Table.Cell
                            py={2}
                            textAlign="end"
                            fontWeight="bold"
                            whiteSpace="nowrap"
                            color={isReturn ? 'red.fg' : undefined}
                          >
                            {money(l.qty * l.unitPrice)}
                          </Table.Cell>
                          <Table.Cell py={2}>
                            <HStack gap={0} justify="flex-end">
                              <IconButton
                                aria-label={t('pos.editPrice')}
                                title={t('pos.editPrice')}
                                size="md"
                                variant="ghost"
                                onClick={() => {
                                  setPriceLine(l)
                                  setPriceText(String(fromMinor(l.unitPrice)))
                                }}
                              >
                                <Pencil size={18} />
                              </IconButton>
                              <IconButton
                                aria-label={
                                  isReturn ? t('pos.undoReturn') : t('pos.returnLine')
                                }
                                title={isReturn ? t('pos.undoReturn') : t('pos.returnLine')}
                                size="md"
                                variant="ghost"
                                colorPalette={isReturn ? 'gray' : 'orange'}
                                onClick={() => cart.toggleReturn(l.id)}
                              >
                                <Undo2 size={18} />
                              </IconButton>
                              <IconButton
                                aria-label={t('common.remove')}
                                title={t('common.remove')}
                                size="md"
                                variant="ghost"
                                colorPalette="red"
                                onClick={() => cart.removeLine(l.id)}
                              >
                                <Trash2 size={18} />
                              </IconButton>
                            </HStack>
                          </Table.Cell>
                        </Table.Row>
                      </Fragment>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
          )}
        </Card.Root>

        {/* ---------------- Totals, wide screens ---------------- */}
        <Flex
          direction="column"
          display={{ base: 'none', xl: 'flex' }}
          w={{ xl: '21rem', '2xl': '23rem' }}
          flexShrink={0}
          minH={0}
          gap={3}
        >
          {/* Never clipped, whatever the viewport height. */}
          <Card.Root flexShrink={0}>
            <Card.Body p={4}>
              <Flex justify="space-between" color="fg.muted" fontSize="sm">
                <Text>{`${cart.itemCount} ${t('pos.items')}`}</Text>
                {cart.discount > 0 && (
                  <Text color="orange.fg">
                    -{cart.discountPercent}% · -{money(cart.discount)}
                  </Text>
                )}
              </Flex>

              <Text color="fg.muted" mt={2}>
                {isRefund ? t('pos.refundTotal') : t('pos.total')}
              </Text>
              <Heading
                fontSize="var(--pos-total-size, 3rem)"
                lineHeight="1.1"
                color={isRefund ? 'red.fg' : 'brand.fg'}
                truncate
              >
                {money(Math.abs(cart.total))}
              </Heading>

              {saveError && (
                <Alert.Root status="error" mt={3}>
                  <Alert.Indicator>
                    <AlertTriangle size={20} />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>{saveError}</Alert.Title>
                  </Alert.Content>
                </Alert.Root>
              )}

              <Stack gap={2} mt={4}>
                <Button
                  h="var(--pos-pay-h, 4.25rem)"
                  fontSize="2xl"
                  colorPalette="green"
                  disabled={!canSettle}
                  loading={busy}
                  onClick={() => openPay('cash')}
                >
                  <Banknote size={28} />
                  {isRefund ? t('pos.refundButton') : t('pos.pay')} · F2
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  colorPalette="green"
                  disabled={!canSettle || isRefund}
                  loading={busy}
                  onClick={() => finish('paid', cart.total, cart.total, null)}
                >
                  <Coins size={20} />
                  {t('pos.payExact')}
                </Button>
                {/* The two ways a ticket leaves without being fully paid.
                    Side by side, distinct colours, both reachable in one tap —
                    a client who hands over part of the money is an everyday
                    event here, not an advanced option. */}
                <HStack gap={2}>
                  <Button
                    flex="1"
                    size="lg"
                    colorPalette="orange"
                    variant="subtle"
                    disabled={!canSettle || cart.total <= 0}
                    onClick={() => openPay('partial')}
                  >
                    <Wallet size={18} />
                    {t('pos.partialShort')}
                  </Button>
                  <Button
                    flex="1"
                    size="lg"
                    colorPalette="red"
                    variant="subtle"
                    disabled={!canSettle || cart.total <= 0}
                    onClick={() => openPay('credit')}
                  >
                    <HandCoins size={18} />
                    {t('pos.credit')}
                  </Button>
                </HStack>
              </Stack>
            </Card.Body>
          </Card.Root>

          {/* Everything a cashier reaches for less often — allowed to scroll. */}
          <Box flex="1" minH={0} overflowY="auto">
            <HStack gap={2}>
              <Button
                flex="1"
                variant="outline"
                disabled={cart.lines.length === 0}
                onClick={() => {
                  setDiscountText(cart.discountPercent ? String(cart.discountPercent) : '')
                  setDiscountOpen(true)
                }}
              >
                <Percent size={18} />
                {t('pos.discount')}
              </Button>
              <Button
                flex="1"
                variant="outline"
                disabled={cart.lines.length === 0}
                onClick={() => cart.park(parkLabel())}
              >
                <PauseCircle size={18} />
                {t('pos.park')}
              </Button>
              <IconButton
                aria-label={t('pos.clear')}
                title={t('pos.clear')}
                variant="ghost"
                colorPalette="red"
                disabled={cart.lines.length === 0}
                onClick={() => {
                  if (window.confirm(t('pos.clearConfirm'))) cart.clear()
                }}
              >
                <Trash2 size={18} />
              </IconButton>
            </HStack>
          </Box>
        </Flex>
      </Flex>

      {/* ------------------------------------------------------------------
          Row 3 — the settle bar below xl. Pinned by being the last row of a
          container that is exactly viewport height, so it needs no sticky
          positioning and cannot detach or overlap.
      ------------------------------------------------------------------ */}
      <Flex
        display={{ base: 'flex', xl: 'none' }}
        flexShrink={0}
        align="center"
        gap={3}
        p={3}
        borderWidth="1px"
        borderColor="border"
        borderRadius="l3"
        bg="bg.panel"
        boxShadow="md"
      >
        <Box minW={0} flex="1">
          <Text fontSize="xs" color="fg.muted">
            {`${cart.itemCount} ${t('pos.items')}`}
          </Text>
          <Text
            fontSize="2xl"
            fontWeight="bold"
            color={isRefund ? 'red.fg' : 'brand.fg'}
            truncate
          >
            {money(Math.abs(cart.total))}
          </Text>
        </Box>
        <Button
          size="lg"
          colorPalette="orange"
          variant="subtle"
          display={{ base: 'none', lg: 'inline-flex' }}
          disabled={!canSettle || cart.total <= 0}
          onClick={() => openPay('partial')}
        >
          <Wallet size={18} />
          {t('pos.partialShort')}
        </Button>
        <Button
          size="lg"
          colorPalette="red"
          variant="subtle"
          display={{ base: 'none', md: 'inline-flex' }}
          disabled={!canSettle || cart.total <= 0}
          onClick={() => openPay('credit')}
        >
          <HandCoins size={18} />
          {t('pos.credit')}
        </Button>
        <Button
          h="3.5rem"
          fontSize="xl"
          colorPalette="green"
          flexShrink={0}
          disabled={!canSettle}
          loading={busy}
          onClick={() => openPay('cash')}
        >
          <Banknote size={24} />
          {isRefund ? t('pos.refundButton') : t('pos.pay')}
        </Button>
        <IconButton
          aria-label={t('common.actions')}
          size="lg"
          variant="outline"
          flexShrink={0}
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal size={20} />
        </IconButton>
      </Flex>

      {/* ---------------- Ambiguous scan: choose the product ---------------- */}
      <Dialog.Root lazyMount unmountOnExit scrollBehavior="inside" open={!!matches} onOpenChange={(e) => !e.open && setMatches(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxH="92dvh">
              <Dialog.Header>
                <Box minW={0}>
                  <Dialog.Title fontSize="xl">
                    {matchKind === 'code' ? t('pos.sameCode') : t('pos.chooseProduct')}
                  </Dialog.Title>
                  <Text color="fg.muted" fontSize="sm" mt={1}>
                    {t('pos.pickNumber')}
                  </Text>
                </Box>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                    <X size={18} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body overflowY="auto">
                <Stack gap={3}>
                  {matches?.map((c, i) => (
                    <Button
                      key={choiceId(c)}
                      h="auto"
                      py={3}
                      px={4}
                      variant="outline"
                      colorPalette={
                        c.kind === 'pack' ? 'cyan' : c.kind === 'service' ? 'purple' : 'brand'
                      }
                      onClick={() => chooseMatch(c)}
                    >
                      <Flex align="center" gap={3} w="full" minW={0} textAlign="start">
                        {i < 9 && (
                          <Box
                            flexShrink={0}
                            boxSize="2.25rem"
                            display="grid"
                            placeItems="center"
                            borderRadius="md"
                            bg={
                              c.kind === 'pack'
                                ? 'cyan.subtle'
                                : c.kind === 'service'
                                  ? 'purple.subtle'
                                  : 'brand.subtle'
                            }
                            color={
                              c.kind === 'pack'
                                ? 'cyan.fg'
                                : c.kind === 'service'
                                  ? 'purple.fg'
                                  : 'brand.fg'
                            }
                            fontWeight="bold"
                            fontSize="lg"
                          >
                            {i + 1}
                          </Box>
                        )}
                        <Box minW={0} flex="1">
                          {/* Wraps, deliberately. truncate here defeated the
                              whole dialog: two products sharing a code are
                              usually two variants of one title, so the words
                              that tell them apart sit at the END of the name.
                              "Sec 4 - Mathematiques T2 (sc. exp)" and
                              "Sec 4 - Mathematiques T2 (maths)" are the real
                              pair in this shop stock, identical for their
                              first 26 characters, and the ellipsis ate the
                              only part that mattered. */}
                          <Text
                            fontSize="lg"
                            fontWeight="bold"
                            whiteSpace="normal"
                            wordBreak="break-word"
                          >
                            {choiceName(c)}
                          </Text>
                          <HStack gap={2} color="fg.muted" fontSize="sm" wrap="wrap">
                            {/* A pack and an article that share a code look
                                alike at a glance — the badge is what stops the
                                wrong one being sold. */}
                            {c.kind === 'pack' && (
                              <Badge colorPalette="cyan" variant="solid" size="sm">
                                {t('packs.badge')}
                              </Badge>
                            )}
                            {c.kind === 'service' && (
                              <Badge colorPalette="purple" variant="solid" size="sm">
                                {t('services.badge')}
                              </Badge>
                            )}
                            {choiceCode(c) && <Text>{choiceCode(c)}</Text>}
                            {c.kind === 'pack' && (
                              <Text>{t('packs.itemsCount', { count: c.pack.items.length })}</Text>
                            )}
                            {c.kind === 'product' && (
                              <Text>
                                {c.product.quantity} {t('stock.units')}
                              </Text>
                            )}
                          </HStack>
                        </Box>
                        <Text
                          flexShrink={0}
                          fontSize="xl"
                          fontWeight="bold"
                          color={
                            c.kind === 'pack'
                              ? 'cyan.fg'
                              : c.kind === 'service'
                                ? 'purple.fg'
                                : 'brand.fg'
                          }
                          whiteSpace="nowrap"
                        >
                          {choicePrice(c) === null
                            ? t('services.askPrice')
                            : money(choicePrice(c) as number)}
                        </Text>
                      </Flex>
                    </Button>
                  ))}
                </Stack>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Create a product from the till ---------------- */}
      <Dialog.Root lazyMount unmountOnExit scrollBehavior="inside" open={newOpen} onOpenChange={(e) => setNewOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{t('stock.addProduct')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap={4}>
                  {/* The wow moment, at the counter: a code this shop has never
                      stocked, named by a bookshop it has never met. Prices stay
                      his — see src/lib/catalog.ts. */}
                  {recognised && (
                    <Alert.Root status="success" variant="subtle">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{t('stock.recognised')}</Alert.Title>
                        <Alert.Description>
                          {[recognised.brand, recognised.category].filter(Boolean).join(' · ') ||
                            t('stock.recognisedHint')}
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}
                  <Field.Root required invalid={!!newError}>
                    <Field.Label>{t('stock.name')}</Field.Label>
                    <Input
                      size="lg"
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t('stock.namePlaceholder')}
                    />
                    <Field.ErrorText>{newError}</Field.ErrorText>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>{t('stock.barcode')}</Field.Label>
                    <Input
                      size="lg"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      inputMode="numeric"
                    />
                    {/* A warning, never a block: two products legitimately
                        sharing one code is normal here — a publisher reuses an
                        EAN across two variants — and the till already has a
                        chooser for exactly that. What was wrong was saving a
                        second one in silence, with the information to hand. */}
                    {(() => {
                      const key = loose(codeOf(newCode))
                      if (key === '') return null
                      const twin = products.find((p) => loose(codeOf(p.barcode)) === key)
                      return twin ? (
                        <Text fontSize="sm" color="orange.fg" mt={1}>
                          {t('stock.codeTwin', { name: twin.name })}
                        </Text>
                      ) : null
                    })()}
                  </Field.Root>
                  <HStack gap={4} align="flex-start">
                    <Field.Root>
                      <Field.Label>{`${t('stock.salePrice')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        inputMode="decimal"
                        placeholder={moneyPlaceholder()}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>{`${t('stock.costPrice')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        value={newCost}
                        onChange={(e) => setNewCost(e.target.value)}
                        inputMode="decimal"
                        placeholder={moneyPlaceholder()}
                      />
                      {/* A blank cost is allowed — a queue at the counter beats
                          a correct margin — but it must not be invisible.
                          costPrice 0 makes the article pure profit for ever in
                          the rentabilite report, and nothing downstream can
                          tell "free" from "nobody typed it". */}
                      {(parseMoney(newCost) ?? 0) === 0 && (
                        <Text fontSize="sm" color="orange.fg" mt={1}>
                          {t('stock.costBlankWarn')}
                        </Text>
                      )}
                    </Field.Root>
                  </HStack>
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setNewOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  loading={busy}
                  onClick={saveNewProduct}
                >
                  {t('common.save')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Free line ---------------- */}
      <Dialog.Root lazyMount unmountOnExit scrollBehavior="inside" open={miscOpen} onOpenChange={(e) => setMiscOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{t('pos.addMisc')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap={4}>
                  <Text color="fg.muted">{t('pos.miscHint')}</Text>
                  <Field.Root required>
                    <Field.Label>{t('pos.miscName')}</Field.Label>
                    <Input
                      size="lg"
                      autoFocus
                      value={miscName}
                      onChange={(e) => setMiscName(e.target.value)}
                    />
                  </Field.Root>
                  <Field.Root required>
                    <Field.Label>{`${t('pos.miscPrice')} (${symbol})`}</Field.Label>
                    <Input
                      size="lg"
                      value={miscPrice}
                      onChange={(e) => setMiscPrice(e.target.value)}
                      inputMode="decimal"
                      placeholder={moneyPlaceholder()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addMisc()
                        }
                      }}
                    />
                  </Field.Root>
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setMiscOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button size="lg" colorPalette="brand" onClick={addMisc}>
                  {t('common.add')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Change one line's price ---------------- */}
      <Dialog.Root lazyMount unmountOnExit scrollBehavior="inside" open={!!priceLine} onOpenChange={(e) => !e.open && setPriceLine(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{t('pos.editPrice')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Field.Root>
                  <Field.Label>
                    {priceLine?.name} ({symbol})
                  </Field.Label>
                  <Input
                    size="xl"
                    autoFocus
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    inputMode="decimal"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const v = parseMoney(priceText)
                        if (priceLine && v !== null) cart.setPrice(priceLine.id, v)
                        setPriceLine(null)
                      }
                    }}
                  />
                </Field.Root>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setPriceLine(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  onClick={() => {
                    const v = parseMoney(priceText)
                    if (priceLine && v !== null) cart.setPrice(priceLine.id, v)
                    setPriceLine(null)
                  }}
                >
                  {t('common.save')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Ticket discount ---------------- */}
      <Dialog.Root lazyMount unmountOnExit scrollBehavior="inside" open={discountOpen} onOpenChange={(e) => setDiscountOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{t('pos.discountOnTotal')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Field.Root>
                  <Field.Label fontSize="lg">{`${t('pos.discount')} (%)`}</Field.Label>
                  <Input
                    size="xl"
                    autoFocus
                    value={discountText}
                    onChange={(e) => setDiscountText(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      cart.setDiscountPercent(parsePercent(discountText) ?? 0)
                      setDiscountOpen(false)
                      focusScan()
                    }}
                    inputMode="decimal"
                    placeholder="10"
                    textAlign="center"
                    fontSize="2xl"
                    fontWeight="bold"
                  />
                  <Field.HelperText>
                    {`${t('pos.subtotal')} ${money(cart.subtotal)}`}
                  </Field.HelperText>
                </Field.Root>

                {/* The rounds actually given, and what this one comes to. A
                    percentage is easy to agree on and hard to picture. */}
                <HStack gap={2} mt={3} wrap="wrap">
                  {[5, 10, 15, 20, 50].map((pct) => (
                    <Button
                      key={pct}
                      size="lg"
                      variant={Number(discountText) === pct ? 'solid' : 'outline'}
                      colorPalette="orange"
                      onClick={() => setDiscountText(String(pct))}
                    >
                      {pct}%
                    </Button>
                  ))}
                </HStack>

                <Flex justify="space-between" align="baseline" mt={4}>
                  <Text color="fg.muted">{t('pos.discount')}</Text>
                  <Text fontSize="xl" fontWeight="bold" color="orange.fg">
                    -
                    {money(
                      Math.min(
                        Math.max(
                          0,
                          Math.round(
                            (Math.max(0, cart.subtotal) *
                              Math.max(0, Math.min(100, parsePercent(discountText) ?? 0))) /
                              100,
                          ),
                        ),
                        Math.max(0, cart.subtotal),
                      ),
                    )}
                  </Text>
                </Flex>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    cart.setDiscountPercent(0)
                    setDiscountOpen(false)
                  }}
                >
                  {t('pos.noDiscount')}
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  onClick={() => {
                    cart.setDiscountPercent(parsePercent(discountText) ?? 0)
                    setDiscountOpen(false)
                  }}
                >
                  {t('common.apply')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Settlement ---------------- */}
      <Dialog.Root lazyMount unmountOnExit scrollBehavior="inside" open={payOpen} onOpenChange={(e) => setPayOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxH="92dvh">
              <Dialog.Header>
                <Dialog.Title>
                  {payKind === 'cash'
                    ? t('pos.pay')
                    : payKind === 'credit'
                      ? t('pos.credit')
                      : t('pos.partial')}
                </Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                    <X size={18} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>

              <Dialog.Body overflowY="auto">
                <Stack gap={4}>
                  <Flex justify="space-between" align="baseline">
                    <Text color="fg.muted" fontSize="lg">
                      {isRefund ? t('pos.refundTotal') : t('pos.total')}
                    </Text>
                    <Heading size="2xl" color={isRefund ? 'red.600' : 'brand.fg'}>
                      {money(Math.abs(cart.total))}
                    </Heading>
                  </Flex>

                  {payKind !== 'cash' && (
                    <Field.Root invalid={!!payError && !customerId}>
                      <Field.Label>{t('pos.client')}</Field.Label>
                      <ClientPicker
                        customers={customers}
                        value={customerId}
                        onChange={(id) => {
                          setCustomerId(id)
                          setPayError('')
                        }}
                        searchLabel={t('pos.searchClient')}
                        symbol={symbol}
                      />
                      <Field.ErrorText>{payError}</Field.ErrorText>
                    </Field.Root>
                  )}

                  {payKind !== 'credit' && !isRefund && (
                    <Field.Root>
                      <Field.Label>
                        {payKind === 'cash'
                          ? `${t('pos.amountGiven')} (${symbol})`
                          : `${t('pos.amountReceived')} (${symbol})`}
                      </Field.Label>
                      <Input
                        size="xl"
                        autoFocus={payKind === 'cash'}
                        inputMode="decimal"
                        placeholder={
                          payKind === 'cash' ? t('pos.payExact') : '0.000'
                        }
                        value={received}
                        onChange={(e) => {
                          setReceived(e.target.value)
                          setPayError('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void confirmPay()
                          }
                        }}
                      />
                      {quickCash.length > 0 && payKind === 'cash' && (
                        <HStack gap={2} mt={2} wrap="wrap">
                          <Button
                            size="lg"
                            variant="subtle"
                            onClick={() => setReceived(String(fromMinor(cart.total)))}
                          >
                            {t('pos.payExact')}
                          </Button>
                          {quickCash.map((v) => (
                            <Button
                              key={v}
                              size="lg"
                              variant="outline"
                              onClick={() => setReceived(String(fromMinor(v)))}
                            >
                              {money(v)}
                            </Button>
                          ))}
                        </HStack>
                      )}
                    </Field.Root>
                  )}

                  <Separator />

                  {payKind === 'cash' && !isRefund && (
                    <Flex justify="space-between" align="baseline">
                      <Text color="fg.muted" fontSize="lg">
                        {t('pos.change')}
                      </Text>
                      <Heading size="3xl" color="green.600">
                        {money(changeDue)}
                      </Heading>
                    </Flex>
                  )}

                  {payKind !== 'cash' && (
                    <Flex justify="space-between">
                      <Text color="fg.muted">{t('pos.remaining')}</Text>
                      <Text fontWeight="bold" fontSize="xl" color="red.600">
                        {money(payKind === 'credit' ? cart.total : remainingAfter)}
                      </Text>
                    </Flex>
                  )}

                  {saveError && (
                    <Alert.Root status="error">
                      <Alert.Indicator>
                        <AlertTriangle size={20} />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>{saveError}</Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}
                </Stack>
              </Dialog.Body>

              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setPayOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  loading={busy}
                  onClick={confirmPay}
                >
                  {t('pos.confirm')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Ticket after a sale ---------------- */}
      <Dialog.Root lazyMount unmountOnExit scrollBehavior="inside" open={!!ticket} onOpenChange={(e) => !e.open && setTicket(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {t('pos.saved')} — {ticket?.ticketNo}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {ticket && (
                  <Stack gap={2}>
                    <Flex justify="space-between">
                      <Text color="fg.muted">{t('pos.total')}</Text>
                      <Text fontWeight="bold">{money(ticket.total)}</Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text color="fg.muted">{t('pos.paidLabel')}</Text>
                      <Text>{money(ticket.paid)}</Text>
                    </Flex>
                    {ticket.received > ticket.total && (
                      <Flex justify="space-between" fontSize="xl">
                        <Text color="fg.muted">{t('pos.change')}</Text>
                        <Text fontWeight="bold" color="green.600">
                          {money(ticket.received - ticket.total)}
                        </Text>
                      </Flex>
                    )}
                    {ticket.total - ticket.paid > 0 && (
                      <Flex justify="space-between">
                        <Text color="fg.muted">{t('pos.creditLabel')}</Text>
                        <Text fontWeight="bold" color="red.600">
                          {money(ticket.total - ticket.paid)}
                        </Text>
                      </Flex>
                    )}
                  </Stack>
                )}
                {/* What this dialog claims has to be true with the line up AND
                    with it down. "Enregistré" is: the ticket is durable on this
                    machine before this dialog is painted. "Envoyé" is not
                    knowable yet, so it is not said here — the header badge is
                    the one place that tracks the trip to the server, and it
                    keeps saying "en cours d'envoi" until the queue is actually
                    empty. This replaces a conditional "saved offline" alert
                    that was decided by a 3.5 s race and told the owner a sale
                    had not been sent when it had. */}
                <Text mt={4} color="fg.subtle" fontSize="sm">
                  {t('pos.recordedHere')}
                </Text>
                <Text mt={2} color="fg.subtle" fontSize="sm">
                  {t('pos.nextCustomerHint')}
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => doPrint('thermal')}>
                  <Printer size={18} />
                  80mm
                </Button>
                <Button size="lg" variant="outline" onClick={() => doPrint('a4')}>
                  <Printer size={18} />
                  A4
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  autoFocus
                  onClick={() => {
                    setTicket(null)
                    focusScan()
                  }}
                >
                  {t('pos.newTicket')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ------------------------------------------------------------------
          A service was scanned off its printed label. There is nothing to
          look up — the only thing between the scan and the ticket is what the
          job came to, so that is the only thing on screen.
      ------------------------------------------------------------------ */}
      <Dialog.Root
        lazyMount
        unmountOnExit
        open={!!serviceAsk}
        onOpenChange={(e) => {
          if (e.open) return
          setServiceAsk(null)
          setServicePrice('')
          focusScan()
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="30rem">
              <Dialog.Header>
                <Flex align="center" gap={3} minW={0}>
                  <Box
                    flexShrink={0}
                    bg="purple.subtle"
                    color="purple.fg"
                    p={2}
                    borderRadius="lg"
                  >
                    <QrCode size={24} />
                  </Box>
                  <Box minW={0}>
                    <Dialog.Title fontSize="2xl" lineHeight="1.2">
                      {serviceAsk?.name}
                    </Dialog.Title>
                    <Text color="fg.muted" fontSize="sm">
                      {t('services.askHint')}
                    </Text>
                  </Box>
                </Flex>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                    <X size={18} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>

              <Dialog.Body>
                <Field.Root invalid={!!serviceError}>
                  <Field.Label fontSize="lg">
                    {`${t('services.priceCollected')} (${symbol})`}
                  </Field.Label>
                  <Input
                    autoFocus
                    h="4.5rem"
                    fontSize="3xl"
                    fontWeight="bold"
                    textAlign="center"
                    inputMode="decimal"
                    placeholder={moneyPlaceholder()}
                    value={servicePrice}
                    onChange={(e) => {
                      setServicePrice(e.target.value)
                      setServiceError('')
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      confirmService()
                    }}
                  />
                  <Field.ErrorText>{serviceError}</Field.ErrorText>
                </Field.Root>

                {/* The usual price for this job, one tap away. */}
                {!!serviceAsk?.defaultPrice && (
                  <Button
                    mt={3}
                    size="lg"
                    w="full"
                    variant="outline"
                    colorPalette="purple"
                    onClick={() =>
                      setServicePrice(String(fromMinor(serviceAsk.defaultPrice as number)))
                    }
                  >
                    {money(serviceAsk.defaultPrice)}
                  </Button>
                )}
              </Dialog.Body>

              <Dialog.Footer>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    setServiceAsk(null)
                    setServicePrice('')
                    focusScan()
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button size="lg" colorPalette="purple" onClick={confirmService}>
                  <Plus size={20} />
                  {t('services.addToTicket')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- Packs ---------------- */}
      <Dialog.Root
        lazyMount
        unmountOnExit
        scrollBehavior="inside"
        open={packOpen}
        onOpenChange={(e) => setPackOpen(e.open)}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxH="92dvh">
              <Dialog.Header>
                <Box minW={0}>
                  <Dialog.Title fontSize="xl">{t('packs.pick')}</Dialog.Title>
                  <Text color="fg.muted" fontSize="sm" mt={1}>
                    {t('packs.pickHint')}
                  </Text>
                </Box>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                    <X size={18} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body overflowY="auto">
                {activePacks.length === 0 ? (
                  <EmptyState.Root size="lg">
                    <EmptyState.Content>
                      <EmptyState.Indicator>
                        <Boxes size={44} />
                      </EmptyState.Indicator>
                      <EmptyState.Title>{t('packs.empty')}</EmptyState.Title>
                      <EmptyState.Description>{t('packs.emptyHint')}</EmptyState.Description>
                    </EmptyState.Content>
                  </EmptyState.Root>
                ) : (
                  <Stack gap={3}>
                    {activePacks.map((pack) => {
                      const info = resolvePack(pack, products)
                      // While the stock is still arriving every member looks
                      // missing; that is not a broken pack, it is an empty list.
                      const broken = !productsLoading && info.missing.length > 0
                      return (
                        <Button
                          key={pack.id}
                          h="auto"
                          py={3}
                          px={4}
                          variant="outline"
                          colorPalette={broken ? 'red' : 'brand'}
                          disabled={broken || productsLoading}
                          onClick={() => addPack(pack)}
                        >
                          <Flex align="center" gap={3} w="full" minW={0} textAlign="start">
                            <Box minW={0} flex="1">
                              <Text fontSize="lg" fontWeight="bold" lineClamp={1}>
                                {pack.name}
                              </Text>
                              <HStack gap={2} color="fg.muted" fontSize="sm" wrap="wrap">
                                <Text>
                                  {t('packs.itemsCount', { count: pack.items.length })}
                                </Text>
                                {pack.barcode && <Text>{pack.barcode}</Text>}
                                {broken ? (
                                  <Badge colorPalette="red" variant="subtle" size="sm">
                                    {t('packs.brokenShort')}
                                  </Badge>
                                ) : (
                                  info.saving > 0 && (
                                    <Badge colorPalette="green" variant="subtle" size="sm">
                                      -{money(info.saving)}
                                    </Badge>
                                  )
                                )}
                              </HStack>
                            </Box>
                            <Text
                              flexShrink={0}
                              fontSize="xl"
                              fontWeight="bold"
                              color="brand.fg"
                              whiteSpace="nowrap"
                            >
                              {money(pack.price)}
                            </Text>
                          </Flex>
                        </Button>
                      )
                    })}
                  </Stack>
                )}
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ---------------- The rest of the actions, on a narrow screen ---------------- */}
      <Dialog.Root
        lazyMount
        unmountOnExit
        scrollBehavior="inside"
        open={moreOpen}
        onOpenChange={(e) => setMoreOpen(e.open)}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxH="92dvh">
              <Dialog.Header>
                <Dialog.Title>{t('common.actions')}</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                    <X size={18} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap={3}>
                  <Button
                    size="xl"
                    variant="outline"
                    colorPalette="green"
                    disabled={!canSettle || isRefund}
                    onClick={() => {
                      setMoreOpen(false)
                      finish('paid', cart.total, cart.total, null)
                    }}
                  >
                    <Coins size={20} />
                    {t('pos.payExact')}
                  </Button>
                  {/* Below md the settle bar has no room for these two, so
                      this dialog is the ONLY way to reach them on a phone. */}
                  <Button
                    size="xl"
                    variant="subtle"
                    colorPalette="orange"
                    disabled={!canSettle || cart.total <= 0}
                    onClick={() => {
                      setMoreOpen(false)
                      openPay('partial')
                    }}
                  >
                    <Wallet size={20} />
                    {t('pos.partial')}
                  </Button>
                  <Button
                    size="xl"
                    variant="subtle"
                    colorPalette="red"
                    disabled={!canSettle || cart.total <= 0}
                    onClick={() => {
                      setMoreOpen(false)
                      openPay('credit')
                    }}
                  >
                    <HandCoins size={20} />
                    {t('pos.credit')}
                  </Button>
                  <Button
                    size="xl"
                    variant="outline"
                    disabled={cart.lines.length === 0}
                    onClick={() => {
                      setMoreOpen(false)
                      setDiscountText(cart.discountPercent ? String(cart.discountPercent) : '')
                      setDiscountOpen(true)
                    }}
                  >
                    <Percent size={20} />
                    {t('pos.discount')}
                  </Button>
                  <Button
                    size="xl"
                    variant="outline"
                    disabled={cart.lines.length === 0}
                    onClick={() => {
                      setMoreOpen(false)
                      cart.park(parkLabel())
                    }}
                  >
                    <PauseCircle size={20} />
                    {t('pos.park')}
                  </Button>
                  <Button
                    size="xl"
                    variant="outline"
                    colorPalette="red"
                    disabled={cart.lines.length === 0}
                    onClick={() => {
                      if (!window.confirm(t('pos.clearConfirm'))) return
                      setMoreOpen(false)
                      cart.clear()
                    }}
                  >
                    <Trash2 size={20} />
                    {t('pos.clear')}
                  </Button>
                </Stack>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Hidden on screen; revealed by the print stylesheet */}
      {ticket && <Ticket data={ticket} shop={shop} symbol={symbol} paper={paper} />}
    </Flex>
  )
}
