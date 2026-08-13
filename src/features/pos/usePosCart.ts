import { useCallback, useEffect, useState } from 'react'
import type { Product } from '@/types/models'

export interface PosLine {
  /** Stable line key. Two lines can hold the same product (a sale + a return). */
  id: string
  /** null for a free "article divers" line that is not in the stock. */
  productId: string | null
  barcode: string | null
  name: string
  /** Negative on a return line — every downstream sum then reverses by itself. */
  qty: number
  unitPrice: number // millimes
  unitCost: number // millimes (snapshot for profit)
  /** Stock on hand when the line was added; only used for the warning badge. */
  stock: number
  /** True once the cashier typed a different price, so the UI can show it. */
  priceEdited?: boolean
}

export interface ParkedSession {
  id: string
  label: string
  at: number
  lines: PosLine[]
  discount: number
}

// v2: lines gained an `id`, misc lines and returns. v1 baskets cannot be read.
const PARKED_KEY = 'pos.parked.v2'

/** Nobody sells a thousand of anything on one line — past this it is a typo. */
const MAX_QTY = 999

let seq = 0
const nextId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`

function loadParked(): ParkedSession[] {
  try {
    const raw = localStorage.getItem(PARKED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ParkedSession[]
    // A corrupted or half-written entry must not take the till down.
    return Array.isArray(parsed) ? parsed.filter((s) => Array.isArray(s?.lines)) : []
  } catch {
    return []
  }
}

/**
 * The till's current ticket plus any parked tickets. Parked tickets live in
 * localStorage so serving another client (or a refresh) never loses a basket.
 */
export function usePosCart() {
  const [lines, setLines] = useState<PosLine[]>([])
  const [discount, setDiscountState] = useState(0)
  const [parked, setParked] = useState<ParkedSession[]>(loadParked)

  useEffect(() => {
    try {
      localStorage.setItem(PARKED_KEY, JSON.stringify(parked))
    } catch {
      /* storage full or unavailable — parking is best-effort */
    }
  }, [parked])

  /**
   * Scanning the same product again bumps the existing line. A return line or
   * a line whose price was renegotiated is left alone: merging into it would
   * silently apply that change to the newly scanned unit.
   */
  const addProduct = useCallback((p: Product) => {
    setLines((prev) => {
      const found = prev.find(
        (l) => l.productId === p.id && l.qty > 0 && !l.priceEdited,
      )
      if (found)
        return prev.map((l) => (l.id === found.id ? { ...l, qty: l.qty + 1 } : l))
      return [
        ...prev,
        {
          id: nextId(),
          productId: p.id,
          barcode: p.barcode,
          name: p.name,
          qty: 1,
          unitPrice: p.salePrice,
          unitCost: p.costPrice,
          stock: p.quantity,
        },
      ]
    })
  }, [])

  /** A photocopy, a repair, anything with no barcode and no stock to move. */
  const addMisc = useCallback((name: string, unitPrice: number) => {
    setLines((prev) => [
      ...prev,
      {
        id: nextId(),
        productId: null,
        barcode: null,
        name,
        qty: 1,
        unitPrice,
        unitCost: 0,
        stock: 0,
      },
    ])
  }, [])

  /** qty 0 drops the line; negative means the client is bringing goods back. */
  const setQty = useCallback((id: string, qty: number) => {
    // A barcode scanned into a selected quantity cell would otherwise turn the
    // line into billions of units, and the total with it.
    const n = Number.isFinite(qty)
      ? Math.max(-MAX_QTY, Math.min(MAX_QTY, Math.trunc(qty)))
      : 0
    setLines((prev) =>
      n === 0
        ? prev.filter((l) => l.id !== id)
        : prev.map((l) => (l.id === id ? { ...l, qty: n } : l)),
    )
  }, [])

  const setPrice = useCallback((id: string, unitPrice: number) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, unitPrice, priceEdited: true } : l)),
    )
  }, [])

  /** Flips a line between "sold" and "brought back", keeping the quantity. */
  const toggleReturn = useCallback((id: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, qty: -l.qty } : l)))
  }, [])

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const clear = useCallback(() => {
    setLines([])
    setDiscountState(0)
  }, [])

  const park = useCallback((label: string) => {
    setLines((current) => {
      if (current.length === 0) return current
      setDiscountState((currentDiscount) => {
        setParked((prev) => [
          ...prev,
          {
            id: `${Date.now()}`,
            label,
            at: Date.now(),
            lines: current,
            discount: currentDiscount,
          },
        ])
        return 0
      })
      return []
    })
  }, [])

  const resume = useCallback((id: string) => {
    setParked((prev) => {
      const session = prev.find((s) => s.id === id)
      if (session) {
        setLines(session.lines)
        setDiscountState(session.discount ?? 0)
      }
      return prev.filter((s) => s.id !== id)
    })
  }, [])

  const dropParked = useCallback((id: string) => {
    setParked((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)

  // A discount can never exceed what is owed, and makes no sense on a ticket
  // that is a net refund — clamping here keeps every downstream total honest.
  const setDiscount = useCallback((minor: number) => {
    setDiscountState(Math.max(0, minor))
  }, [])
  const effectiveDiscount = Math.min(Math.max(0, discount), Math.max(0, subtotal))

  const total = subtotal - effectiveDiscount
  const itemCount = lines.reduce((n, l) => n + Math.abs(l.qty), 0)
  const hasReturn = lines.some((l) => l.qty < 0)

  return {
    lines,
    parked,
    discount: effectiveDiscount,
    rawDiscount: discount,
    setDiscount,
    addProduct,
    addMisc,
    setQty,
    setPrice,
    toggleReturn,
    removeLine,
    clear,
    park,
    resume,
    dropParked,
    subtotal,
    total,
    itemCount,
    hasReturn,
  }
}
