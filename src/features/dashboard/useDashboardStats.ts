/**
 * Every number the "Argent" page shows, derived in one place.
 *
 * Two different sources are used on purpose:
 *
 *  - The KPIs, the chart, the best day and the peak hour are computed from the
 *    tickets of the selected period, because they are questions about a period.
 *  - The best sellers, the dormant stock, the categories and the restock list
 *    read the running lifetime totals kept on each product document
 *    (`soldQty` / `soldRevenue` / `soldCost` / `lastSoldAt`, maintained
 *    atomically by the till). No ticket replay, so they stay instant however
 *    many tickets have been rung up — at the cost of being lifetime figures
 *    rather than period figures.
 *
 * Returns raw numbers and stable ids only: labelling is the page's job, so
 * this file needs no translation function.
 */

import { useMemo } from 'react'
import type { Customer, CreditEntry, Product, Purchase, Sale } from '@/types/models'
import { purchaseOwed, purchaseStatus } from '@/features/purchases/usePurchases'
import { groupByCustomer, lastPaymentAt, debtStartedAt } from '@/features/credit/ledger'
import { bucketKey, buildBuckets, periodRange, previousRange } from './periods'
import type { Period, Range } from './periods'
import { fromMinor } from '@/lib/money'

const DAY_MS = 24 * 60 * 60 * 1000

/** In stock but untouched for this long — money asleep on a shelf. */
export const DEAD_STOCK_DAYS = 60
/** A debt with no movement for this long needs chasing. */
export const CREDIT_RISK_DAYS = 60
/** How many rows each "à corriger" group shows once expanded. */
export const FIX_ROWS_SHOWN = 20

const TOP_N = 8

/** Whole days elapsed between two timestamps, never negative. */
function daysSince(from: number, now: number): number {
  return Math.max(0, Math.floor((now - from) / DAY_MS))
}

/**
 * Profit actually made on one ticket: the margin of every line, less the
 * whole-ticket discount (which the line prices do not know about). Return
 * lines carry a negative qty, so they subtract themselves naturally.
 */
function saleProfit(s: Sale): number {
  const lines = s.items.reduce((n, i) => n + (i.unitPrice - i.unitCost) * i.qty, 0)
  return lines - (s.discount ?? 0)
}

/** Percentage change against the previous period. Null when there is no base. */
function growth(current: number, previous: number): number | null {
  if (previous === 0) return null
  const pct = ((current - previous) / Math.abs(previous)) * 100
  return Number.isFinite(pct) ? pct : null
}

export interface PeriodTotals {
  /** Money in, millimes. Net of discounts; a refund pulls it down. */
  revenue: number
  /** Money out to suppliers, millimes. */
  spending: number
  /** Estimated profit, millimes. */
  profit: number
  /** Number of tickets. */
  tickets: number
  /** Average ticket, millimes. Zero when there were no tickets. */
  avgTicket: number
  /** Overall margin as a percentage of revenue. Null when nothing was sold. */
  margin: number | null
}

function totalsFor(sales: Sale[], purchases: Purchase[], range: Range): PeriodTotals {
  const revenue = sales.reduce((n, s) => n + s.total, 0)
  const inRange = (ts: number) => ts >= range.start && ts <= range.end
  const spending = purchases
    .filter((p) => inRange(p.date))
    .reduce((n, p) => n + p.total, 0)
  const profit = sales.reduce((n, s) => n + saleProfit(s), 0)
  const tickets = sales.length
  return {
    revenue,
    spending,
    profit,
    tickets,
    avgTicket: tickets > 0 ? Math.round(revenue / tickets) : 0,
    margin: revenue > 0 ? (profit / revenue) * 100 : null,
  }
}

/** One point on the entrées/sorties chart. Values in dinars, for the axis. */
export interface ChartPoint {
  label: string
  in: number
  out: number
}

/** A product ranked by what it actually earns. */
export interface SellerRow {
  id: string
  name: string
  soldQty: number
  revenue: number
  profit: number
  margin: number | null
}

/** A product sitting in stock that nobody is buying. */
export interface DeadStockRow {
  id: string
  name: string
  quantity: number
  /** quantity * costPrice, millimes — cash frozen on the shelf. */
  frozen: number
  neverSold: boolean
  /** Days since the last sale. Meaningless when `neverSold`. */
  days: number
}

/** A product worth ordering again. */
export interface RestockRow {
  id: string
  name: string
  quantity: number
  threshold: number
  soldQty: number
  /** Units sold per day since the product was created — the sale speed. */
  perDay: number
}

export interface CategoryRow {
  /** Null for products with no category set. */
  name: string | null
  revenue: number
  profit: number
  /** Share of the total revenue, 0-100. */
  share: number
}

export type FixKind =
  | 'lossMakers'
  | 'noBarcode'
  | 'noCost'
  | 'outOfStock'
  | 'lowStock'
  | 'creditRisk'
  | 'supplierDebt'

export interface FixRow {
  id: string
  name: string
  /** Money at stake on this row, millimes. Null when the row is not about money. */
  amount: number | null
  /** Units in stock, or days late for a credit. Null when not relevant. */
  count: number | null
}

export interface FixGroup {
  kind: FixKind
  rows: FixRow[]
  /** Sum of the row amounts, millimes. Zero when the group carries no money. */
  total: number
}

export interface BestMoment {
  /** Start-of-day timestamp for a day, or the hour 0-23 for an hour. */
  value: number
  /** Money taken then, millimes. */
  total: number
}

export interface DashboardStats {
  current: PeriodTotals
  previous: PeriodTotals
  /**
   * Percentage change per KPI, null when the previous period was empty.
   * The margin is deliberately absent: it is already a percentage, and the
   * percentage change of a percentage is the kind of number that misleads.
   */
  growth: {
    revenue: number | null
    spending: number | null
    profit: number | null
    avgTicket: number | null
    tickets: number | null
  }
  chart: ChartPoint[]
  bestSellers: SellerRow[]
  deadStock: DeadStockRow[]
  /** Total cash frozen across the whole dormant list, millimes. */
  cashLocked: number
  restock: RestockRow[]
  categories: CategoryRow[]
  fixGroups: FixGroup[]
  bestDay: BestMoment | null
  bestHour: BestMoment | null
  /** True when there is genuinely nothing to show yet. */
  empty: boolean
}

export interface DashboardInput {
  period: Period
  /** Frozen at the moment the period was chosen, so the memos stay stable. */
  now: number
  sales: Sale[]
  purchases: Purchase[]
  products: Product[]
  customers: Customer[]
  /** Ledger lines for every client, so debt age comes from real movements. */
  creditEntries: CreditEntry[]
}

export function useDashboardStats({
  period,
  now,
  sales,
  purchases,
  products,
  customers,
  creditEntries,
}: DashboardInput): DashboardStats {
  // --- period figures: KPIs, chart, best moments --------------------------
  const periodPart = useMemo(() => {
    const range = periodRange(period, now)
    const prevRange = previousRange(period, now)
    const within = (r: Range, ts: number) => ts >= r.start && ts <= r.end

    const currentSales = sales.filter((s) => within(range, s.date))
    const previousSales = sales.filter((s) => within(prevRange, s.date))

    const current = totalsFor(currentSales, purchases, range)
    const previous = totalsFor(previousSales, purchases, prevRange)

    // Chart: one pass over each collection, bucketed by key.
    const buckets = buildBuckets(period, now)
    const ins = new Map<string, number>()
    const outs = new Map<string, number>()
    for (const s of currentSales) {
      const k = bucketKey(period, s.date)
      ins.set(k, (ins.get(k) ?? 0) + s.total)
    }
    for (const p of purchases) {
      if (!within(range, p.date)) continue
      const k = bucketKey(period, p.date)
      outs.set(k, (outs.get(k) ?? 0) + p.total)
    }
    const chart: ChartPoint[] = buckets.map((b) => ({
      label: b.label,
      in: fromMinor(ins.get(b.key) ?? 0),
      out: fromMinor(outs.get(b.key) ?? 0),
    }))

    // Best day / peak hour, straight off the tickets of the period.
    const byDay = new Map<number, number>()
    const byHour = new Map<number, number>()
    for (const s of currentSales) {
      const d = new Date(s.date)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      byDay.set(dayStart, (byDay.get(dayStart) ?? 0) + s.total)
      byHour.set(d.getHours(), (byHour.get(d.getHours()) ?? 0) + s.total)
    }
    const best = (m: Map<number, number>): BestMoment | null => {
      let top: BestMoment | null = null
      for (const [value, total] of m) {
        if (!top || total > top.total) top = { value, total }
      }
      return top && top.total > 0 ? top : null
    }

    return {
      current,
      previous,
      growth: {
        revenue: growth(current.revenue, previous.revenue),
        spending: growth(current.spending, previous.spending),
        profit: growth(current.profit, previous.profit),
        avgTicket: growth(current.avgTicket, previous.avgTicket),
        tickets: growth(current.tickets, previous.tickets),
      },
      chart,
      bestDay: best(byDay),
      bestHour: best(byHour),
    }
  }, [period, now, sales, purchases])

  // --- lifetime product figures: winners, dormant stock, categories -------
  const productPart = useMemo(() => {
    const bestSellers: SellerRow[] = products
      .map((p) => {
        const revenue = p.soldRevenue ?? 0
        const profit = revenue - (p.soldCost ?? 0)
        return {
          id: p.id,
          name: p.name,
          soldQty: p.soldQty ?? 0,
          revenue,
          profit,
          margin: revenue > 0 ? (profit / revenue) * 100 : null,
        }
      })
      .filter((r) => r.soldQty > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, TOP_N)

    // Dormant: goods on the shelf that are not moving. A product bought but
    // never sold is the worst case, so it is flagged separately.
    const deadRows: DeadStockRow[] = products
      .filter((p) => p.quantity > 0)
      .map((p) => {
        const soldQty = p.soldQty ?? 0
        const neverSold = soldQty <= 0 || !p.lastSoldAt
        const days = p.lastSoldAt ? daysSince(p.lastSoldAt, now) : 0
        return {
          id: p.id,
          name: p.name,
          quantity: p.quantity,
          frozen: p.quantity * p.costPrice,
          neverSold,
          days,
        }
      })
      .filter((r) => r.neverSold || r.days >= DEAD_STOCK_DAYS)
      .sort((a, b) => b.frozen - a.frozen)

    const cashLocked = deadRows.reduce((n, r) => n + r.frozen, 0)

    // Restock: it sells, and the shelf is now at or under the alert threshold.
    const restock: RestockRow[] = products
      .filter((p) => (p.soldQty ?? 0) > 0 && p.quantity <= Math.max(p.lowStockThreshold, 0))
      .map((p) => {
        const soldQty = p.soldQty ?? 0
        const age = Math.max(1, daysSince(p.createdAt, now))
        return {
          id: p.id,
          name: p.name,
          quantity: p.quantity,
          threshold: p.lowStockThreshold,
          soldQty,
          perDay: soldQty / age,
        }
      })
      .sort((a, b) => b.perDay - a.perDay)
      .slice(0, TOP_N)

    // Categories, by lifetime revenue.
    const byCategory = new Map<string | null, { revenue: number; profit: number }>()
    for (const p of products) {
      const revenue = p.soldRevenue ?? 0
      if (revenue <= 0) continue
      const key = p.category?.trim() ? p.category.trim() : null
      const agg = byCategory.get(key) ?? { revenue: 0, profit: 0 }
      agg.revenue += revenue
      agg.profit += revenue - (p.soldCost ?? 0)
      byCategory.set(key, agg)
    }
    const categoryRevenue = [...byCategory.values()].reduce((n, c) => n + c.revenue, 0)
    const categories: CategoryRow[] = [...byCategory.entries()]
      .map(([name, agg]) => ({
        name,
        revenue: agg.revenue,
        profit: agg.profit,
        share: categoryRevenue > 0 ? (agg.revenue / categoryRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)

    return { bestSellers, deadStock: deadRows, cashLocked, restock, categories }
  }, [products, now])

  // --- the actionable list ------------------------------------------------
  const fixPart = useMemo(() => {
    const byAmount = (a: FixRow, b: FixRow) =>
      Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0)
    const byCount = (a: FixRow, b: FixRow) => (b.count ?? 0) - (a.count ?? 0)

    // Sold at or below what it cost: every unit on the shelf is a planned loss.
    const lossMakers: FixRow[] = products
      .filter((p) => p.costPrice > 0 && p.salePrice <= p.costPrice)
      .map((p) => ({
        id: p.id,
        name: p.name,
        amount: (p.salePrice - p.costPrice) * Math.max(p.quantity, 0),
        count: p.quantity,
      }))
      .sort(byAmount)

    const noBarcode: FixRow[] = products
      .filter((p) => !p.barcode)
      .map((p) => ({ id: p.id, name: p.name, amount: null, count: p.quantity }))
      .sort(byCount)

    const noCost: FixRow[] = products
      .filter((p) => p.costPrice <= 0)
      .map((p) => ({ id: p.id, name: p.name, amount: null, count: p.quantity }))
      .sort(byCount)

    const outOfStock: FixRow[] = products
      .filter((p) => p.quantity <= 0)
      .map((p) => ({ id: p.id, name: p.name, amount: null, count: p.quantity }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const lowStock: FixRow[] = products
      .filter((p) => p.quantity > 0 && p.quantity <= p.lowStockThreshold)
      .map((p) => ({ id: p.id, name: p.name, amount: null, count: p.quantity }))
      .sort((a, b) => (a.count ?? 0) - (b.count ?? 0))

    // The clock runs from the client's last actual payment (or, if he has never
    // paid, from the day the debt started). `updatedAt` would have been wrong:
    // merely correcting a phone number bumps it and would clear the alert.
    const byClient = groupByCustomer(creditEntries)
    const creditRisk: FixRow[] = customers
      .filter((c) => c.balance > 0)
      .map((c) => {
        const entries = byClient.get(c.id) ?? []
        const since = lastPaymentAt(entries) ?? debtStartedAt(entries)
        return {
          id: c.id,
          name: c.name,
          amount: c.balance,
          count: since === null ? null : daysSince(since, now),
        }
      })
      .filter((r) => r.count !== null && r.count >= CREDIT_RISK_DAYS)
      .sort(byAmount)

    const supplierDebt: FixRow[] = purchases
      .filter((p) => purchaseStatus(p) !== 'paid')
      .map((p) => ({
        id: p.id,
        name: p.supplier ?? p.reference ?? '',
        amount: purchaseOwed(p),
        count: null,
      }))
      .sort(byAmount)

    const groups: FixGroup[] = (
      [
        ['lossMakers', lossMakers],
        ['supplierDebt', supplierDebt],
        ['creditRisk', creditRisk],
        ['outOfStock', outOfStock],
        ['lowStock', lowStock],
        ['noCost', noCost],
        ['noBarcode', noBarcode],
      ] as const
    )
      .map(([kind, rows]) => ({
        kind,
        rows,
        total: rows.reduce((n, r) => n + (r.amount ?? 0), 0),
      }))
      .filter((g) => g.rows.length > 0)

    return { fixGroups: groups }
  }, [products, customers, purchases, creditEntries, now])

  return useMemo(
    () => ({
      ...periodPart,
      ...productPart,
      ...fixPart,
      empty: sales.length === 0 && purchases.length === 0 && products.length === 0,
    }),
    [periodPart, productPart, fixPart, sales.length, purchases.length, products.length],
  )
}
