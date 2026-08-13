import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Keyboard,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Banknote,
  Coins,
} from 'lucide-react'
import { formatMoney, parseMoney, fromMinor } from '@/lib/money'
import { useAlive } from '@/lib/useAlive'
import {
  beepOk,
  beepWarn,
  beepError,
  beepDone,
  soundEnabled,
  setSoundEnabled,
} from '@/lib/beep'
import { useProducts, createProduct } from '@/features/stock/useProducts'
import { useCustomers } from '@/features/customers/useCustomers'
import { useShopSettings } from '@/features/settings/useShopSettings'
import { recordSale } from '@/features/sales/useSales'
import { usePosCart } from './usePosCart'
import { useBarcodeScanner } from './useBarcodeScanner'
import type { PosLine } from './usePosCart'
import { Ticket } from './Ticket'
import type { TicketData } from './Ticket'
import type { PaymentMode, Product, Customer } from '@/types/models'

type PayKind = 'cash' | 'credit' | 'partial'

/**
 * A barcode as the till compares it. Coerced through String() because a code
 * restored from a JSON backup can come back as a number, and a number never
 * matches the scanned text.
 */
const codeOf = (v: unknown) => String(v ?? '').trim()

/**
 * The same code without the separators catalogues like to print inside ISBNs.
 * A shelf label reading 978-2-07-036822-8 has to match the 9782070368228 the
 * scanner reads off the very same book.
 */
const loose = (code: string) => code.replace(/[\s-]/g, '')

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
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) || (c.phone ?? '').includes(needle),
      )
    : customers

  return (
    <Stack gap={2}>
      <Input
        size="lg"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={searchLabel}
        autoFocus
      />
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
    </Stack>
  )
}

export function CaissePage() {
  const { t } = useTranslation()
  const alive = useAlive()
  const { products, loading: productsLoading } = useProducts()
  const { customers } = useCustomers()
  const { shop } = useShopSettings()
  const cart = usePosCart()

  const scanRef = useRef<HTMLInputElement>(null)
  const [scan, setScan] = useState('')
  const [notice, setNotice] = useState('')
  /** Severity of `notice` — "the stock is still loading" is not a warning. */
  const [noticeStatus, setNoticeStatus] = useState<'info' | 'warning'>('warning')
  /** Only an unknown code offers to create the article on the spot. */
  const [canCreate, setCanCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Ambiguous scan → let the cashier pick instead of guessing.
  const [matches, setMatches] = useState<Product[] | null>(null)

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

  // Free line (photocopy, binding…)
  const [miscOpen, setMiscOpen] = useState(false)
  const [miscName, setMiscName] = useState('')
  const [miscPrice, setMiscPrice] = useState('')

  // Price renegotiated on one line
  const [priceLine, setPriceLine] = useState<PosLine | null>(null)
  const [priceText, setPriceText] = useState('')

  // Whole-ticket discount
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountText, setDiscountText] = useState('')

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

  const symbol = t('money.symbol')
  const money = (m: number) => formatMoney(m, { symbol })
  const focusScan = () => scanRef.current?.focus()

  /**
   * Dialogs that own the keyboard. The receipt shown after a sale is
   * deliberately not one of them: scanning the next customer's first article
   * closes it and opens the next ticket by itself, which is one less button to
   * find between two customers.
   */
  const dialogBlocking =
    payOpen || miscOpen || newOpen || discountOpen || !!matches || !!priceLine
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
    return cart.lines.filter(
      (l) => l.productId && !products.some((p) => p.id === l.productId),
    )
  }, [cart.lines, products, productsLoading])

  const canSettle = cart.lines.length > 0 && staleLines.length === 0 && !busy
  const isRefund = cart.total < 0

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

  const addToCart = useCallback(
    (p: Product) => {
      cart.addProduct(p)
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
    [cart.addProduct],
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

      if (productsLoading) {
        // Answering "unknown code" here would be a lie, and offering to create
        // the article would duplicate it. Hold it and replay it below.
        if (pendingScans.current.length < MAX_PENDING) pendingScans.current.push(term)
        setNoticeStatus('info')
        setNotice(t('pos.waitingStock'))
        return
      }

      setNotice('')

      const exact = findByCode(term, physical)
      if (exact && exact.length === 1) {
        addToCart(exact[0])
        return
      }

      const needle = term.toLowerCase()
      const found =
        exact && exact.length > 1
          ? exact
          : products.filter(
              (p) =>
                p.name.toLowerCase().includes(needle) ||
                (p.family ?? '').toLowerCase().includes(needle),
            )

      if (found.length === 1) {
        addToCart(found[0])
        return
      }
      if (found.length > 1) {
        // Never guess: picking the first alphabetical match sells the wrong item.
        setMatches(found.slice(0, 40))
        setNoticeStatus('warning')
        setNotice(t('pos.manyMatches', { term }))
        beepWarn()
        return
      }

      setNoticeStatus('warning')
      setNotice(t('pos.notFound', { term }))
      setCanCreate(true)
      beepError()
      setNewCode(/^\d+$/.test(term) ? term : '')
      setNewName(/^\d+$/.test(term) ? '' : term)
      focusScan()
    },
    [addToCart, findByCode, products, productsLoading, t],
  )

  /**
   * The hand scanner types the code and simply stops - it sends no Enter. The
   * wedge recognises the burst by its speed and rings the article up on its
   * own, from anywhere on the page.
   */
  const scanner = useBarcodeScanner({ targetRef: scanRef, onScan: lookup })

  /**
   * A complete barcode sitting in the field IS an article - no key to press.
   * Held back while a longer code starts with the same digits, so a code that
   * is the beginning of another one is never rung up early.
   */
  useEffect(() => {
    const term = codeOf(scan)
    if (term.length < 4 || productsLoading || busy || dialogBlocking) return
    if (term === consumed.current.term && performance.now() - consumed.current.at < CONSUMED_MS) {
      return
    }
    const hit = findByCode(term)
    if (!hit || hit.length !== 1) return
    for (const p of products) {
      const code = codeOf(p.barcode)
      if (code && code !== term && code.startsWith(term)) return
    }
    // The wedge is still holding the same characters; without this it would
    // fire a moment later and ring the very same unit up twice.
    scanner.reset()
    consumed.current = { term, at: performance.now() }
    setScan('')
    addToCart(hit[0])
  }, [scan, findByCode, products, productsLoading, busy, dialogBlocking, addToCart, scanner])

  /** The stock arrived - serve every code that was scanned while it loaded. */
  useEffect(() => {
    if (productsLoading) return
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
  }, [productsLoading, lookup])

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

  const chooseMatch = (p: Product) => {
    setMatches(null)
    setScan('')
    addToCart(p)
  }

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
      if (same && l.qty > 0) {
        cart.setQty(l.id, l.qty - 1)
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
    cart.addMisc(miscName.trim(), price)
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
      const rec = await recordSale({
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
        pending: rec.pending,
      }
      setTicket(data)
      setLastTicket(data)
      cart.clear()
      setLastAdded(null)
      beepDone()
      setPayOpen(false)
      setCustomerId('')
      setReceived('')
    } catch {
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
      } else if (e.key === 'F4') {
        e.preventDefault()
        if (cart.lines.length > 0) cart.park(parkLabel())
      } else if (e.key === 'F6') {
        e.preventDefault()
        setMiscOpen(true)
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
    <Box>
      <Flex align="center" gap={3} mb={5} wrap="wrap">
        <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
          <ShoppingCart size={26} />
        </Box>
        <Heading size="2xl">{t('pos.title')}</Heading>
        <Box flex="1" />
        {/* The beep is the confirmation the cashier actually notices, so it
            has to be switchable from the till itself, not buried in settings. */}
        <IconButton
          aria-label={sound ? t('pos.soundOn') : t('pos.soundOff')}
          title={sound ? t('pos.soundOn') : t('pos.soundOff')}
          variant="outline"
          size="lg"
          onClick={toggleSound}
        >
          {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </IconButton>
        {lastTicket && (
          <Button variant="outline" size="lg" onClick={reprintLast}>
            <Printer size={18} />
            {t('pos.reprint')}
          </Button>
        )}
      </Flex>

      <Grid templateColumns={{ base: '1fr', xl: '1fr 24rem' }} gap={5} alignItems="start">
        {/* ---------------- Left: scan + ticket lines ---------------- */}
        <Stack gap={4} minW={0}>
          <Card.Root>
            <Card.Body>
              <form onSubmit={submitScan}>
                <Flex gap={3} align="center">
                  <Box color="fg.subtle" flexShrink={0}>
                    <ScanLine size={28} />
                  </Box>
                  <Input
                    ref={scanRef}
                    size="xl"
                    autoFocus
                    value={scan}
                    onChange={(e) => setScan(e.target.value)}
                    onPaste={(e) => {
                      if (pasteScan(e.clipboardData.getData('text'))) e.preventDefault()
                    }}
                    placeholder={t('pos.scanPlaceholder')}
                    fontSize="lg"
                  />
                  <Button
                    type="button"
                    size="xl"
                    variant="outline"
                    flexShrink={0}
                    onClick={() => setMiscOpen(true)}
                  >
                    <PackagePlus size={20} />
                    <Text as="span" display={{ base: 'none', md: 'inline' }}>
                      {t('pos.misc')}
                    </Text>
                  </Button>
                </Flex>
              </form>

              <Text mt={2} color="fg.subtle" fontSize="sm">
                {t('pos.scanHint')}
              </Text>

              {/* The loud, unmissable "it went in". Big enough to read from
                  arm's length, and undoable without hunting for a small icon. */}
              {lastAdded && (
                <Flex
                  mt={3}
                  align="center"
                  gap={3}
                  p={3}
                  borderWidth="2px"
                  borderColor="green.400"
                  bg="green.50"
                  borderRadius="lg"
                >
                  <Box color="green.600" flexShrink={0}>
                    <CheckCircle2 size={34} />
                  </Box>
                  <Box minW={0} flex="1">
                    <Text fontSize="xl" fontWeight="bold" color="green.900" truncate>
                      {lastAdded.name}
                    </Text>
                    <Text fontSize="lg" color="green.700">
                      {money(lastAdded.price)} · {t('pos.added')}
                    </Text>
                  </Box>
                  <Button
                    size="lg"
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
                <Alert.Root status={noticeStatus} mt={3} size="lg">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title fontSize="lg">{notice}</Alert.Title>
                  </Alert.Content>
                  {canCreate && !matches && (
                    <Button size="lg" colorPalette="brand" onClick={openNewProduct}>
                      {t('pos.createFromScan')}
                    </Button>
                  )}
                </Alert.Root>
              )}

              {/* Until now this alert blocked the sale with no way out of it:
                  the article no longer exists, so the only move is dropping the
                  lines — which is now the button next to the message. */}
              {staleLines.length > 0 && (
                <Alert.Root status="error" mt={3} size="lg">
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
                      for (const l of staleLines) cart.removeLine(l.id)
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

          <Card.Root>
            <Card.Body p={0}>
              {cart.lines.length === 0 ? (
                <EmptyState.Root size="lg" py={12}>
                  <EmptyState.Content>
                    <EmptyState.Indicator>
                      <ScanLine size={48} />
                    </EmptyState.Indicator>
                    <EmptyState.Title>{t('pos.emptyTicket')}</EmptyState.Title>
                    <EmptyState.Description>
                      {t('pos.emptyTicketHint')}
                    </EmptyState.Description>
                  </EmptyState.Content>
                </EmptyState.Root>
              ) : (
                <Box overflowX="auto">
                  <Table.Root size="lg">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>{t('pos.product')}</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">
                          {t('pos.unitPrice')}
                        </Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="center">
                          {t('pos.qty')}
                        </Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">
                          {t('pos.lineTotal')}
                        </Table.ColumnHeader>
                        <Table.ColumnHeader />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {cart.lines.map((l) => {
                        const isReturn = l.qty < 0
                        const stale = staleLines.some((s) => s.id === l.id)
                        return (
                          <Table.Row key={l.id} bg={isReturn ? 'red.50' : undefined}>
                            <Table.Cell>
                              <Text fontWeight="semibold">{l.name}</Text>
                              <HStack gap={2} mt={1} wrap="wrap">
                                {isReturn && (
                                  <Badge colorPalette="red">{t('pos.returnBadge')}</Badge>
                                )}
                                {l.priceEdited && (
                                  <Badge colorPalette="purple" variant="subtle">
                                    {t('pos.priceChanged')}
                                  </Badge>
                                )}
                                {stale && (
                                  <Badge colorPalette="red" variant="subtle">
                                    {t('pos.deletedBadge')}
                                  </Badge>
                                )}
                                {!isReturn && l.productId && l.qty > l.stock && (
                                  <Badge colorPalette="orange" variant="subtle">
                                    {l.stock <= 0
                                      ? t('pos.outOfStock')
                                      : t('pos.stockLeft', { count: l.stock })}
                                  </Badge>
                                )}
                              </HStack>
                            </Table.Cell>
                            <Table.Cell textAlign="end" whiteSpace="nowrap">
                              {money(l.unitPrice)}
                            </Table.Cell>
                            <Table.Cell>
                              <HStack justify="center" gap={1}>
                                <IconButton
                                  aria-label={t('common.decrease')}
                                  size="lg"
                                  variant="outline"
                                  onClick={() => cart.setQty(l.id, l.qty - 1)}
                                >
                                  <Minus size={20} />
                                </IconButton>
                                <QtyCell
                                  value={l.qty}
                                  label={t('pos.editQty')}
                                  onCommit={(n) => cart.setQty(l.id, n)}
                                />
                                <IconButton
                                  aria-label={t('common.increase')}
                                  size="lg"
                                  variant="outline"
                                  onClick={() => cart.setQty(l.id, l.qty + 1)}
                                >
                                  <Plus size={20} />
                                </IconButton>
                              </HStack>
                            </Table.Cell>
                            <Table.Cell
                              textAlign="end"
                              fontWeight="bold"
                              whiteSpace="nowrap"
                              color={isReturn ? 'red.600' : undefined}
                            >
                              {money(l.qty * l.unitPrice)}
                            </Table.Cell>
                            <Table.Cell>
                              <HStack gap={1} justify="flex-end">
                                <IconButton
                                  aria-label={t('pos.editPrice')}
                                  title={t('pos.editPrice')}
                                  size="lg"
                                  variant="ghost"
                                  onClick={() => {
                                    setPriceLine(l)
                                    setPriceText(String(fromMinor(l.unitPrice)))
                                  }}
                                >
                                  <Pencil size={20} />
                                </IconButton>
                                <IconButton
                                  aria-label={
                                    isReturn ? t('pos.undoReturn') : t('pos.returnLine')
                                  }
                                  title={isReturn ? t('pos.undoReturn') : t('pos.returnLine')}
                                  size="lg"
                                  variant="ghost"
                                  colorPalette={isReturn ? 'gray' : 'orange'}
                                  onClick={() => cart.toggleReturn(l.id)}
                                >
                                  <Undo2 size={20} />
                                </IconButton>
                                <IconButton
                                  aria-label={t('common.remove')}
                                  title={t('common.remove')}
                                  size="lg"
                                  variant="ghost"
                                  colorPalette="red"
                                  onClick={() => cart.removeLine(l.id)}
                                >
                                  <Trash2 size={20} />
                                </IconButton>
                              </HStack>
                            </Table.Cell>
                          </Table.Row>
                        )
                      })}
                    </Table.Body>
                  </Table.Root>
                </Box>
              )}
            </Card.Body>
          </Card.Root>

          <HStack gap={2} color="fg.subtle" fontSize="sm" wrap="wrap">
            <Keyboard size={16} />
            <Text>{t('pos.shortcutPay')}</Text>
            <Text>·</Text>
            <Text>{t('pos.shortcutPark')}</Text>
            <Text>·</Text>
            <Text>{t('pos.shortcutMisc')}</Text>
            <Text>·</Text>
            <Text>{t('pos.shortcutSearch')}</Text>
          </HStack>
        </Stack>

        {/* ---------------- Right: totals + actions ---------------- */}
        <Stack gap={4} position={{ xl: 'sticky' }} top={4} minW={0}>
          <Card.Root>
            <Card.Body>
              <Flex justify="space-between" color="fg.muted">
                <Text>{cart.itemCount}</Text>
                <Text>{t('pos.items')}</Text>
              </Flex>

              {cart.discount > 0 && (
                <>
                  <Separator my={3} />
                  <Flex justify="space-between">
                    <Text color="fg.muted">{t('pos.subtotal')}</Text>
                    <Text>{money(cart.subtotal)}</Text>
                  </Flex>
                  <Flex justify="space-between" color="orange.600">
                    <Text>{t('pos.discount')}</Text>
                    <Text fontWeight="semibold">-{money(cart.discount)}</Text>
                  </Flex>
                </>
              )}

              <Separator my={3} />
              <Text color="fg.muted">{isRefund ? t('pos.refundTotal') : t('pos.total')}</Text>
              <Heading size="4xl" color={isRefund ? 'red.600' : 'brand.fg'} truncate>
                {money(Math.abs(cart.total))}
              </Heading>

              {saveError && (
                <Alert.Root status="error" mt={4}>
                  <Alert.Indicator>
                    <AlertTriangle size={20} />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>{saveError}</Alert.Title>
                  </Alert.Content>
                </Alert.Root>
              )}

              <Stack gap={3} mt={5}>
                {/* Two ways to finish, both big enough to hit without aiming:
                    the customer hands over a round note (change to work out),
                    or he hands over the exact amount and it is done in one tap. */}
                <Button
                  h="4.5rem"
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
                  h="3.75rem"
                  fontSize="xl"
                  variant="outline"
                  colorPalette="green"
                  disabled={!canSettle || isRefund}
                  loading={busy}
                  onClick={() => finish('paid', cart.total, cart.total, null)}
                >
                  <Coins size={24} />
                  {t('pos.payExact')} · {money(cart.total)}
                </Button>
                <HStack gap={2}>
                  <Button
                    flex="1"
                    size="lg"
                    colorPalette="orange"
                    variant="subtle"
                    disabled={!canSettle || cart.total <= 0}
                    onClick={() => openPay('partial')}
                  >
                    {t('pos.partial')}
                  </Button>
                  <Button
                    flex="1"
                    size="lg"
                    colorPalette="red"
                    variant="subtle"
                    disabled={!canSettle || cart.total <= 0}
                    onClick={() => openPay('credit')}
                  >
                    {t('pos.credit')}
                  </Button>
                </HStack>
              </Stack>

              <HStack mt={4} gap={2}>
                <Button
                  flex="1"
                  variant="outline"
                  disabled={cart.lines.length === 0}
                  onClick={() => {
                    setDiscountText(cart.discount ? String(fromMinor(cart.discount)) : '')
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
            </Card.Body>
          </Card.Root>

          {cart.parked.length > 0 && (
            <Card.Root>
              <Card.Body>
                <Text fontWeight="bold" mb={2}>
                  {t('pos.parked')}
                </Text>
                <Stack gap={2}>
                  {cart.parked.map((s) => (
                    <Flex key={s.id} align="center" gap={2}>
                      <Button
                        flex="1"
                        minW={0}
                        size="lg"
                        variant="outline"
                        justifyContent="flex-start"
                        onClick={() => cart.resume(s.id)}
                      >
                        <PlayCircle size={18} />
                        <Text truncate>{s.label}</Text>
                      </Button>
                      <IconButton
                        aria-label={t('common.delete')}
                        variant="ghost"
                        colorPalette="red"
                        onClick={() => cart.dropParked(s.id)}
                      >
                        <X size={16} />
                      </IconButton>
                    </Flex>
                  ))}
                </Stack>
              </Card.Body>
            </Card.Root>
          )}
        </Stack>
      </Grid>

      {/* ---------------- Ambiguous scan: choose the product ---------------- */}
      <Dialog.Root lazyMount unmountOnExit scrollBehavior="inside" open={!!matches} onOpenChange={(e) => !e.open && setMatches(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxH="92dvh">
              <Dialog.Header>
                <Dialog.Title>{t('pos.chooseProduct')}</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                    <X size={18} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body overflowY="auto">
                <Stack gap={2}>
                  {matches?.map((p) => (
                    <Button
                      key={p.id}
                      size="xl"
                      variant="outline"
                      justifyContent="space-between"
                      onClick={() => chooseMatch(p)}
                    >
                      <Text truncate>{p.name}</Text>
                      <HStack gap={3} flexShrink={0}>
                        <Text color="fg.muted" fontSize="sm">
                          {p.quantity} {t('stock.units')}
                        </Text>
                        <Text fontWeight="bold">{money(p.salePrice)}</Text>
                      </HStack>
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
                  </Field.Root>
                  <HStack gap={4} align="flex-start">
                    <Field.Root>
                      <Field.Label>{`${t('stock.salePrice')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        inputMode="decimal"
                        placeholder="0.000"
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>{`${t('stock.costPrice')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        value={newCost}
                        onChange={(e) => setNewCost(e.target.value)}
                        inputMode="decimal"
                        placeholder="0.000"
                      />
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
                      placeholder="0.000"
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
                  <Field.Label>{`${t('pos.discount')} (${symbol})`}</Field.Label>
                  <Input
                    size="xl"
                    autoFocus
                    value={discountText}
                    onChange={(e) => setDiscountText(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.000"
                  />
                  <Field.HelperText>{money(cart.subtotal)}</Field.HelperText>
                </Field.Root>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    cart.setDiscount(0)
                    setDiscountOpen(false)
                  }}
                >
                  {t('pos.noDiscount')}
                </Button>
                <Button
                  size="lg"
                  colorPalette="brand"
                  onClick={() => {
                    cart.setDiscount(parseMoney(discountText) ?? 0)
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
                    {ticket.pending && (
                      <Alert.Root status="info" mt={2}>
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Title>{t('pos.savedOffline')}</Alert.Title>
                        </Alert.Content>
                      </Alert.Root>
                    )}
                  </Stack>
                )}
                <Text mt={4} color="fg.subtle" fontSize="sm">
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

      {/* Hidden on screen; revealed by the print stylesheet */}
      {ticket && <Ticket data={ticket} shop={shop} symbol={symbol} paper={paper} />}
    </Box>
  )
}
