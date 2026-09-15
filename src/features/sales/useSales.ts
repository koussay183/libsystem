import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  doc,
  getDoc,
  getDocs,
  getDocFromCache,
  getDocsFromCache,
  writeBatch,
  increment,
} from 'firebase/firestore'
import dayjs from 'dayjs'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { track } from '@/lib/syncStatus'
import { withDeadline, READ_DEADLINE_MS } from '@/lib/deadline'
import { isLiveProduct } from '@/features/stock/useProducts'
import { isLiveCustomer } from '@/features/customers/useCustomers'
import type { Sale, SaleItem, PaymentMode, CreditEntry } from '@/types/models'

const SALES = 'sales'
const PRODUCTS = 'products'
const CUSTOMERS = 'customers'
const ENTRIES = 'credit_entries'

export type SaleItemInput = SaleItem

export interface RecordSaleInput {
  items: SaleItemInput[]
  /** Sum of the lines, before the whole-ticket discount. */
  subtotal: number
  /** Whole-ticket discount in millimes (0 when there is none). */
  discount: number
  /** Net total = subtotal - discount. Negative on a pure return. */
  total: number
  /** Amount applied to this ticket now. Never more than `total`. */
  paid: number
  /** Cash the client actually handed over, when more than the total. */
  received?: number
  mode: PaymentMode
  customerId?: string | null
  customerName?: string | null
  kind?: 'ticket' | 'invoice'
}

/**
 * What the till knows about a ticket the instant it is rung up.
 *
 * There is deliberately no "has it reached the server yet" flag. At the moment
 * the ticket is handed to the customer that question has no honest answer: the
 * commit is durable on this device and queued, and whether the server has taken
 * it is something only the header sync badge can say, later. A per-ticket flag
 * could only ever be a guess, and the guess it used to make was wrong in both
 * directions — see `recordSale`.
 */
export interface RecordedSale {
  id: string
  ticketNo: string
  date: number
}

/** Midnight that opened the local day `ts` falls in, epoch-ms. */
function startOfLocalDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * The next local midnight after `ts`. Date arithmetic rather than `ts + 24h`
 * because a day is not always 86 400 000 ms: on a DST change that sum lands an
 * hour inside the wrong day, and end-of-month is only correct by luck.
 */
function nextLocalMidnight(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  return d.getTime()
}

/**
 * The start of the local day, kept honest on a till nobody ever closes.
 *
 * The shop PC keeps the same tab open for days, so any boundary read once at
 * mount silently answers a question about the day the tab was opened rather
 * than about today. "Les ventes d'aujourd'hui" was exactly that: read at 9am
 * from a tab opened the day before yesterday it was two days of takings, and
 * the owner counts his cash drawer against it.
 *
 * One timer armed for the next midnight, not an interval: a per-minute poll
 * would re-render every consumer 1440 times a day to change a value once. The
 * timer is deliberately not trusted to be punctual — a laptop suspended over
 * midnight fires it late, sometimes days late, and a background tab is
 * throttled — so the new boundary is recomputed from the clock when it fires
 * and the next one is armed from the day we actually woke up in.
 */
export function useDayStart(): number {
  const [dayStart, setDayStart] = useState(() => startOfLocalDay(Date.now()))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const arm = () => {
      const now = Date.now()
      // Never shorter than a second: were the timer ever to fire a hair early
      // (clock skew, a rounded-down delay) the next wait is short but real, so
      // this can re-arm but can never spin.
      const wait = Math.max(1000, nextLocalMidnight(now) - now)
      timer = setTimeout(() => {
        setDayStart(startOfLocalDay(Date.now()))
        arm()
      }, wait)
    }
    arm()
    return () => {
      if (timer !== null) clearTimeout(timer)
    }
  }, [])

  return dayStart
}

/** Live list of sales, newest first. Capped so the till stays fast. */
export function useSales(max = 200) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, shopPath(SALES)), orderBy('date', 'desc'), limit(max))
    return onSnapshot(
      q,
      (snap) => {
        setSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) })))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [max])

  return { sales, loading, error }
}

/**
 * The tickets from a date onwards, newest first, with a hard ceiling.
 *
 * The money page used to ask for a COUNT — the newest 500, 1500, 4000 or 12000
 * tickets depending on the period on screen. Two things were wrong with that.
 * The query changes with the period, so clicking through the four of them
 * issued four separate reads of up to eighteen thousand documents between
 * them; and asking for the newest twelve thousand tickets to report on today
 * reads a year of history to add up an afternoon.
 *
 * A range on the same field it is ordered by needs no composite index, and
 * reads only the tickets the period actually covers. The ceiling stays as a
 * backstop so a shop with years of history can never issue an unbounded read.
 */
export function useSalesSince(since: number, cap: number) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(
      collection(db, shopPath(SALES)),
      where('date', '>=', since),
      orderBy('date', 'desc'),
      limit(cap),
    )
    return onSnapshot(
      q,
      (snap) => {
        setSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) })))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [since, cap])

  return { sales, loading, error }
}

/**
 * Only today's tickets. The home screen shows "sales so far today" and nothing
 * else, and downloading the last few hundred tickets to add up two numbers is
 * a lot of documents to pull over a shop connection. A range filter on the same
 * field it is ordered by needs no composite index.
 *
 * The boundary comes from `useDayStart`, so the subscription follows the actual
 * clock: at midnight it is re-armed on the new day instead of going on adding
 * up the day the tab happened to be opened. `loading` is deliberately not set
 * back to true then — the figure is already on screen and a spinner appearing
 * on its own at midnight would only look like a fault.
 */
export function useTodaySales() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const dayStart = useDayStart()

  useEffect(() => {
    const q = query(
      collection(db, shopPath(SALES)),
      where('date', '>=', dayStart),
      orderBy('date', 'desc'),
    )
    return onSnapshot(
      q,
      (snap) => {
        setSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) })))
        setLoading(false)
      },
      // The day's total is a nicety; it must never block the home screen.
      () => setLoading(false),
    )
  }, [dayStart])

  return { sales, loading }
}

/**
 * Ticket reference derived from the timestamp — no counter contention.
 * The two-character suffix keeps two tickets rung up inside the same second
 * distinguishable: this string is printed on the receipt and copied into the
 * client's carnet line, so a collision makes a debt impossible to trace back.
 */
export function makeTicketNo(ts: number): string {
  const suffix = Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, '0')
    .toUpperCase()
  return `${dayjs(ts).format('YYMMDD-HHmmss')}-${suffix}`
}

/**
 * Records a ticket in ONE atomic batch:
 *  - writes the sale
 *  - moves each product's stock (a return line has a negative qty, so the very
 *    same arithmetic puts the goods back)
 *  - moves each product's lifetime sold qty / revenue / cost, which is what
 *    makes the profitability report instant instead of replaying every ticket
 *  - for credit/partial, writes the client's debit line and bumps their balance
 *
 * Either everything lands or nothing does; there is no half-recorded sale.
 * Lines with a null productId are free "article divers" lines (a photocopy,
 * say) — they count towards the money but touch no stock.
 *
 * Nothing here waits for the server, and the function is deliberately not
 * async so that no future edit can make it: the commit is applied to this
 * device's cache before it returns, and that cache is durable and replayed in
 * order on reconnect. A cashier with a customer at the counter must never watch
 * a spinner because the ADSL is having a bad afternoon.
 */
export function recordSale(input: RecordSaleInput): RecordedSale {
  const unpaid = input.total - input.paid

  // Refusing here beats silently losing the debt: an unpaid balance with
  // nobody attached to it is money the shop can never chase.
  if (unpaid > 0 && !input.customerId) {
    throw new Error('recordSale: unpaid balance requires a customer')
  }

  const now = Date.now()
  const ticketNo = makeTicketNo(now)
  const batch = writeBatch(db)

  const saleRef = doc(collection(db, shopPath(SALES)))
  batch.set(saleRef, {
    ticketNo,
    items: input.items,
    subtotal: input.subtotal,
    discount: input.discount,
    total: input.total,
    paid: input.paid,
    received: input.received ?? input.paid,
    mode: input.mode,
    onCredit: unpaid > 0,
    customerId: input.customerId ?? null,
    customerName: input.customerName ?? null,
    kind: input.kind ?? 'ticket',
    hasReturn: input.items.some((it) => it.qty < 0),
    date: now,
    createdAt: now,
  })

  // One update per product, even if the same product appears on both a sale
  // line and a return line — Firestore rejects two writes to one document in
  // a single batch.
  const perProduct = new Map<string, { qty: number; revenue: number; cost: number }>()
  for (const it of input.items) {
    if (!it.productId) continue
    const agg = perProduct.get(it.productId) ?? { qty: 0, revenue: 0, cost: 0 }
    agg.qty += it.qty
    agg.revenue += it.qty * it.unitPrice
    agg.cost += it.qty * it.unitCost
    perProduct.set(it.productId, agg)
  }

  for (const [productId, agg] of perProduct) {
    batch.update(doc(db, shopPath(PRODUCTS), productId), {
      quantity: increment(-agg.qty),
      soldQty: increment(agg.qty),
      soldRevenue: increment(agg.revenue),
      soldCost: increment(agg.cost),
      // Only a real sale refreshes "last sold" — a return must not make a
      // dead product look like it is moving again.
      ...(agg.qty > 0 ? { lastSoldAt: now } : {}),
      updatedAt: now,
    })
  }

  if (unpaid > 0 && input.customerId) {
    batch.set(doc(collection(db, shopPath(ENTRIES))), {
      customerId: input.customerId,
      type: 'debit',
      amount: unpaid,
      label: `Ticket ${ticketNo}`,
      saleId: saleRef.id,
      ticketNo,
      date: now,
      createdAt: now,
    })
    batch.update(doc(db, shopPath(CUSTOMERS), input.customerId), {
      balance: increment(unpaid),
      updatedAt: now,
    })
  }

  // Counted while it is in flight, so the header badge — the single place in
  // this app that speaks about the server — can say whether the shop's tickets
  // have actually reached it, and so that a refusal raises `denied` and puts a
  // banner in front of the owner.
  //
  // This used to race the commit against a 3.5 s timer to decide what the
  // ticket said, and it was wrong in both directions. A slow but working line
  // lost the race, so a sale that had in fact landed printed as "not sent". And
  // a refusal arriving after the race had been decided fell into a bare
  // `catch(() => {})`: when a plan lapses during a long outage Firestore rolls
  // every queued mutation back locally, and that silence is how weeks of
  // takings could vanish with nothing on screen ever mentioning it. What the
  // race was trying to decide is not knowable at print time, so it is no longer
  // decided here at all.
  void track(batch.commit()).catch(() => {
    /* track() has already read this rejection and raised `denied` if it was
       one; the handler only keeps it off the unhandled-rejection log */
  })

  return { id: saleRef.id, ticketNo, date: now }
}

/**
 * How a ticket was settled, from the two numbers that decide it.
 *
 * One rule, used by the invoice form, the editor and the till, because three
 * copies of "remaining <= 0 is paid" is three places for the badge on the
 * sales list to disagree with the carnet.
 */
export function paymentModeOf(total: number, paid: number): PaymentMode {
  if (total - paid <= 0) return 'paid'
  return paid > 0 ? 'partial' : 'credit'
}

/* ==========================================================================
   CORRECTING A TICKET AFTER THE FACT.

   A recorded sale is not one document. recordSale() above writes four kinds in
   one batch — the ticket, the counters on every product it touched, the
   client's carnet line, the client's balance — and every screen in the app
   trusts those four to agree. So a correction is not "update the ticket": it
   is the exact inverse of what the old ticket did, plus what the new one does,
   applied to all four in ONE batch, or the profitability report and the
   carnet part company for good. removePurchase in purchases/usePurchases.ts
   learned this the hard way and is the model followed here.
   ========================================================================== */

/** The corrected ticket, as the editor hands it over. Money in millimes. */
export interface SaleEdit {
  items: SaleItem[]
  subtotal: number
  discount: number
  total: number
  paid: number
  customerId: string | null
  customerName: string | null
  date: number
}

/**
 * The carnet line for this ticket could not be confirmed, so the correction
 * was refused rather than guessed.
 *
 * Guessing has exactly one failure mode and it is the worst one: deciding
 * there is no line when there is, and writing a second — the client then owes
 * the same ticket twice, and nothing in the data says which line is the echo.
 */
export class SaleLedgerUnreadableError extends Error {
  constructor() {
    super('the carnet line for this ticket could not be read')
    this.name = 'SaleLedgerUnreadableError'
  }
}

/** The ticket leaves money unpaid and the chosen client no longer exists. */
export class CustomerMissingError extends Error {
  constructor() {
    super('unpaid balance names a customer that no longer exists')
    this.name = 'CustomerMissingError'
  }
}

/**
 * The carnet line a ticket wrote, if any — and whether that answer can be
 * trusted.
 *
 * SERVER FIRST, UNDER A DEADLINE, AND THE CACHE ONLY AS A FALLBACK. This is the
 * opposite order from useSale() below, on purpose. A cached DOCUMENT read that
 * misses throws, so it is easy to tell "not cached" from "does not exist". A
 * cached QUERY that misses returns an EMPTY RESULT — indistinguishable from
 * "this ticket has no carnet line". For a ticket rung up on the other machine
 * that this one has never loaded, reading the cache first would answer "no
 * line", and updateSale would then create one: the same debt, twice.
 *
 * So the server is asked while there is a line, and `confirmed` says whether
 * the answer came from it. An unconfirmed empty answer on a ticket that was on
 * credit is refused upstream, not acted on.
 *
 * Returns null when nothing could be read at all.
 */
export async function findSaleEntry(
  saleId: string,
): Promise<{ entry: CreditEntry | null; confirmed: boolean } | null> {
  const q = query(collection(db, shopPath(ENTRIES)), where('saleId', '==', saleId))
  const fromServer = await withDeadline(getDocs(q), READ_DEADLINE_MS).catch(() => null)
  const snap = fromServer ?? (await getDocsFromCache(q).catch(() => null))
  if (!snap) return null
  const first = snap.docs[0]
  const entry = first ? ({ id: first.id, ...(first.data() as Omit<CreditEntry, 'id'>) } as CreditEntry) : null
  return { entry, confirmed: !snap.metadata.fromCache }
}

/** Per-product totals of a set of lines, the way recordSale aggregates them. */
function aggregateLines(items: SaleItem[]) {
  const per = new Map<string, { qty: number; revenue: number; cost: number }>()
  for (const it of items) {
    if (!it.productId) continue
    const agg = per.get(it.productId) ?? { qty: 0, revenue: 0, cost: 0 }
    agg.qty += it.qty
    agg.revenue += it.qty * it.unitPrice
    agg.cost += it.qty * it.unitCost
    per.set(it.productId, agg)
  }
  return per
}

/** One batch may hold this many writes. Same ceiling as the purchases. */
const BATCH_LIMIT = 400

/**
 * Applies a correction to a recorded ticket, everywhere the ticket reached.
 *
 * The three refusals at the top are thrown BEFORE a single write is enqueued,
 * so a refused correction leaves nothing half-done — the same discipline as
 * removeCustomer. Everything after them is one batch:
 *
 *   1. Every product on the old ticket or the new one gets increment(new − old)
 *      on its counters. Not "undo then redo" as two writes: Firestore refuses
 *      two writes to one document in a batch, and the difference is one write.
 *      lastSoldAt is left alone — a correction is not a sale, and the previous
 *      value is not knowable.
 *   2. The ticket is updated IN PLACE. ticketNo and createdAt survive: the
 *      number is printed on the client's copy and copied into his carnet line,
 *      and a corrected ticket that changed its number would be untraceable.
 *   3. The carnet is reconciled against the line as it IS — `old.amount`, what
 *      the client's page shows — never against `before.total − before.paid`,
 *      which is what it should have been. If somebody hand-settled the line in
 *      between, the balance still moves by exactly the difference the client
 *      sees.
 *
 * `knownEntry` lets the client's page, which already holds the live line, skip
 * the read. `undefined` means "not known, go and look"; `null` means "known to
 * be absent".
 */
export async function updateSale(
  before: Sale,
  edit: SaleEdit,
  opts: { knownEntry?: CreditEntry | null } = {},
): Promise<void> {
  const unpaid = edit.total - edit.paid
  if (edit.items.length === 0) {
    throw new Error('updateSale: a ticket keeps at least one line; void it instead')
  }
  if (unpaid > 0 && !edit.customerId) {
    throw new Error('updateSale: unpaid balance requires a customer')
  }
  if (unpaid > 0 && edit.customerId && isLiveCustomer(edit.customerId) === false) {
    throw new CustomerMissingError()
  }

  const found =
    opts.knownEntry !== undefined
      ? { entry: opts.knownEntry, confirmed: true }
      : await findSaleEntry(before.id)
  if (found === null) throw new SaleLedgerUnreadableError()
  // A line SHOULD exist and the only answer is an unconfirmed "none": refuse.
  // See findSaleEntry for why acting on it would double the debt.
  if (found.entry === null && !found.confirmed && before.onCredit) {
    throw new SaleLedgerUnreadableError()
  }
  const old = found.entry

  const oldAgg = aggregateLines(before.items)
  const newAgg = aggregateLines(edit.items)
  const productIds = new Set([...oldAgg.keys(), ...newAgg.keys()])
  if (productIds.size + 6 > BATCH_LIMIT) {
    throw new Error('updateSale: too many products for one batch')
  }

  const now = Date.now()
  const batch = writeBatch(db)

  for (const productId of productIds) {
    const o = oldAgg.get(productId) ?? { qty: 0, revenue: 0, cost: 0 }
    const n = newAgg.get(productId) ?? { qty: 0, revenue: 0, cost: 0 }
    const dq = n.qty - o.qty
    const dRev = n.revenue - o.revenue
    const dCost = n.cost - o.cost
    if (dq === 0 && dRev === 0 && dCost === 0) continue
    // A product deleted since the ticket cannot take an update (the whole batch
    // would be refused). The ticket is corrected without it.
    if (isLiveProduct(productId) === false) continue
    batch.update(doc(db, shopPath(PRODUCTS), productId), {
      quantity: increment(-dq),
      soldQty: increment(dq),
      soldRevenue: increment(dRev),
      soldCost: increment(dCost),
      updatedAt: now,
    })
  }

  batch.update(doc(db, shopPath(SALES), before.id), {
    items: edit.items,
    subtotal: edit.subtotal,
    discount: edit.discount,
    total: edit.total,
    paid: edit.paid,
    // `received` is the cash handed over, which only the till knows. Kept when
    // the paid figure did not move; otherwise the new paid figure is the best
    // available truth.
    received: edit.paid === before.paid ? (before.received ?? before.paid) : edit.paid,
    mode: paymentModeOf(edit.total, edit.paid),
    onCredit: unpaid > 0,
    customerId: edit.customerId,
    customerName: edit.customerName,
    hasReturn: edit.items.some((it) => it.qty < 0),
    date: edit.date,
    updatedAt: now,
  })

  const customerRef = (id: string) => doc(db, shopPath(CUSTOMERS), id)
  const bump = (id: string, delta: number) => {
    if (delta === 0 || isLiveCustomer(id) === false) return
    batch.update(customerRef(id), { balance: increment(delta), updatedAt: now })
  }

  if (old && unpaid > 0 && edit.customerId) {
    const entryRef = doc(db, shopPath(ENTRIES), old.id)
    if (old.customerId === edit.customerId) {
      batch.update(entryRef, { amount: unpaid, date: edit.date, updatedAt: now })
      bump(edit.customerId, unpaid - old.amount)
    } else {
      // The line moves to the other client; its id stays, so anything holding
      // it (the expanded row on the carnet) keeps working.
      batch.update(entryRef, {
        customerId: edit.customerId,
        amount: unpaid,
        date: edit.date,
        updatedAt: now,
      })
      bump(old.customerId, -old.amount)
      bump(edit.customerId, unpaid)
    }
  } else if (old && unpaid <= 0) {
    batch.delete(doc(db, shopPath(ENTRIES), old.id))
    bump(old.customerId, -old.amount)
  } else if (!old && unpaid > 0 && edit.customerId) {
    batch.set(doc(collection(db, shopPath(ENTRIES))), {
      customerId: edit.customerId,
      type: 'debit',
      amount: unpaid,
      label: `Ticket ${before.ticketNo}`,
      saleId: before.id,
      ticketNo: before.ticketNo,
      date: edit.date,
      createdAt: now,
    })
    bump(edit.customerId, unpaid)
  }

  void track(batch.commit()).catch(() => {
    /* replayed by the SDK, in order; a refusal surfaces through the sync badge */
  })
}

/**
 * Removes a ticket and puts back everything it moved.
 *
 * The exact inverse of recordSale, in one batch, with the ticket's own delete
 * LAST — the same ordering removeCustomer uses, so a replay that is refused
 * fails before the visible row has gone. A hard delete rather than a flag,
 * because six screens replay the sales collection to draw the day's figures
 * and a flag would be six places to forget to filter it out.
 *
 * The confirmation is the caller's: window.confirm belongs on the screen that
 * knows what to say, not in the store.
 */
export async function voidSale(
  sale: Sale,
  opts: { knownEntry?: CreditEntry | null } = {},
): Promise<void> {
  const found =
    opts.knownEntry !== undefined
      ? { entry: opts.knownEntry, confirmed: true }
      : await findSaleEntry(sale.id)
  if (found === null) throw new SaleLedgerUnreadableError()
  if (found.entry === null && !found.confirmed && sale.onCredit) {
    throw new SaleLedgerUnreadableError()
  }
  const old = found.entry

  const agg = aggregateLines(sale.items)
  if (agg.size + 4 > BATCH_LIMIT) throw new Error('voidSale: too many products for one batch')

  const now = Date.now()
  const batch = writeBatch(db)
  for (const [productId, a] of agg) {
    if (isLiveProduct(productId) === false) continue
    batch.update(doc(db, shopPath(PRODUCTS), productId), {
      quantity: increment(a.qty),
      soldQty: increment(-a.qty),
      soldRevenue: increment(-a.revenue),
      soldCost: increment(-a.cost),
      updatedAt: now,
    })
  }
  if (old) {
    batch.delete(doc(db, shopPath(ENTRIES), old.id))
    if (isLiveCustomer(old.customerId) !== false) {
      batch.update(doc(db, shopPath(CUSTOMERS), old.customerId), {
        balance: increment(-old.amount),
        updatedAt: now,
      })
    }
  }
  batch.delete(doc(db, shopPath(SALES), sale.id))

  void track(batch.commit()).catch(() => {
    /* replayed by the SDK, in order; a refusal surfaces through the sync badge */
  })
}

/**
 * ONE sale, fetched on demand — what a line in the carnet was actually FOR.
 *
 * The carnet used to say "Ticket 260721-143512" and stop there. That is a
 * reference, not an answer: a client standing at the counter asking what he
 * owes 17,500 DT for cannot be shown a number and a serial. The sale is
 * already stored with every line on it, so the answer exists — nothing was
 * reading it.
 *
 * getDoc, NOT a subscription. A carnet is read one line at a time, on a screen
 * that is open for a minute; a listener per line would keep a stream open per
 * row for a document that never changes after it is written.
 *
 * `{ source: cache }` FIRST, and this is the part that matters in this shop.
 * The line is down for hours at a time and a server read simply hangs — but
 * every sale this till rang up is already in IndexedDB, so the cache answers
 * instantly and offline. The server is asked only when the cache has never
 * seen it (a ticket rung up on the other machine), and then under a deadline
 * so a dead uplink cannot leave a spinner on screen.
 */
export function useSale(
  saleId: string | null | undefined,
  /**
   * Bump it to read again. A getDoc is one-shot, so after this screen itself
   * corrects the ticket the detail would go on showing the old lines — the
   * cache answers the re-read instantly with what was just written.
   */
  refreshKey = 0,
) {
  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(false)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!saleId) {
      setSale(null)
      setMissing(false)
      return
    }
    let alive = true
    setLoading(true)
    setMissing(false)
    setSale(null)

    const ref = doc(db, shopPath(SALES), saleId)
    const read = async () => {
      try {
        let snap = await getDocFromCache(ref).catch(() => null)
        if (!snap?.exists()) {
          snap = (await withDeadline(getDoc(ref), SALE_READ_MS)) ?? null
        }
        if (!alive) return
        if (snap?.exists()) setSale({ id: snap.id, ...(snap.data() as Omit<Sale, 'id'>) })
        else setMissing(true)
      } catch {
        // Offline and never cached, refused, or simply gone. All the same
        // answer to the screen: we cannot show the detail, say so quietly.
        if (alive) setMissing(true)
      } finally {
        if (alive) setLoading(false)
      }
    }
    void read()
    return () => {
      alive = false
    }
  }, [saleId, refreshKey])

  return { sale, loading, missing }
}

/** Short: the cache has already answered by now, or there is no line. */
const SALE_READ_MS = 4000
