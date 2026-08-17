import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  doc,
  writeBatch,
  increment,
} from 'firebase/firestore'
import dayjs from 'dayjs'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { track } from '@/lib/syncStatus'
import type { Sale, SaleItem, PaymentMode } from '@/types/models'

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
