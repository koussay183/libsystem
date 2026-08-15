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

  /**
   * Set on every line that came from one insertion of a pack. The lines are
   * real article lines — they move stock and carry revenue like any other —
   * and this only ties them together so the ticket can show them as a group
   * and remove them as a group.
   */
  packUid?: string
  packId?: string
  packName?: string
  /** What the pack was sold for, so the group can show it without re-deriving. */
  packPrice?: number
}

export interface ParkedSession {
  id: string
  label: string
  at: number
  lines: PosLine[]
  /** Percent off the ticket, 0-100. */
  discountPercent: number
}

/**
 * v2: lines gained an `id`, misc lines and returns.
 * v3: the discount became a percentage. The key HAS to move with it — a v2
 *     ticket parked with `discount: 5000` (five dinars) read as a percentage
 *     would be a 5000% discount.
 */
const PARKED_KEY = 'pos.parked.v3'

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
  /** Percent off the whole ticket, 0-100. */
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
   * Scanning the same product again bumps the existing line, and MOVES IT TO
   * THE END — the ticket is shown newest first, and a line that grew without
   * moving would leave the cashier watching the wrong row.
   *
   * A line whose price was renegotiated is left alone: merging into it would
   * silently apply that change to the newly scanned unit. A sale and a return
   * of the same article never merge into each other either — they are opposite
   * facts about the same ticket.
   */
  const addProduct = useCallback((p: Product, asReturn = false) => {
    const step = asReturn ? -1 : 1
    setLines((prev) => {
      // A pack line is deliberately excluded: it carries a prorated price, and
      // merging a loose unit into it would quietly change what the pack costs
      // with nothing on screen to explain the new total.
      const found = prev.find(
        (l) =>
          l.productId === p.id &&
          (asReturn ? l.qty < 0 : l.qty > 0) &&
          !l.priceEdited &&
          !l.packUid,
      )
      if (found) {
        const bumped = { ...found, qty: found.qty + step }
        return [...prev.filter((l) => l.id !== found.id), bumped]
      }
      return [
        ...prev,
        {
          id: nextId(),
          productId: p.id,
          barcode: p.barcode,
          name: p.name,
          qty: step,
          unitPrice: p.salePrice,
          unitCost: p.costPrice,
          stock: p.quantity,
        },
      ]
    })
  }, [])

  /**
   * Puts a pack on the ticket as one line per article, already priced so the
   * group adds up to the pack price. Each insertion gets its own id, so adding
   * the same pack twice gives two groups the cashier can remove separately.
   */
  const addPack = useCallback(
    (
      members: { product: Product; qty: number; unitPrice: number }[],
      meta: { packId: string; packName: string; packPrice: number },
      asReturn = false,
    ) => {
      if (members.length === 0) return
      const packUid = nextId()
      setLines((prev) => [
        ...prev,
        ...members.map((m) => ({
          id: nextId(),
          productId: m.product.id,
          barcode: m.product.barcode,
          name: m.product.name,
          qty: asReturn ? -m.qty : m.qty,
          unitPrice: m.unitPrice,
          unitCost: m.product.costPrice,
          stock: m.product.quantity,
          packUid,
          packId: meta.packId,
          packName: meta.packName,
          packPrice: meta.packPrice,
        })),
      ])
    },
    [],
  )

  /** A photocopy, a repair, anything with no barcode and no stock to move. */
  const addMisc = useCallback((name: string, unitPrice: number, asReturn = false) => {
    setLines((prev) => [
      ...prev,
      {
        id: nextId(),
        productId: null,
        barcode: null,
        name,
        qty: asReturn ? -1 : 1,
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

  /**
   * Flips a line between "sold" and "brought back", keeping the quantity. A
   * pack comes back as a whole: returning three of its six articles would leave
   * a group that no longer adds up to any price the shop ever charged.
   */
  const toggleReturn = useCallback((id: string) => {
    setLines((prev) => {
      const target = prev.find((l) => l.id === id)
      if (!target) return prev
      const group = target.packUid
      return prev.map((l) =>
        (group ? l.packUid === group : l.id === id) ? { ...l, qty: -l.qty } : l,
      )
    })
  }, [])

  /** Removes the line — or the whole pack it belongs to. */
  const removeLine = useCallback((id: string) => {
    setLines((prev) => {
      const target = prev.find((l) => l.id === id)
      if (!target) return prev
      const group = target.packUid
      return prev.filter((l) => (group ? l.packUid !== group : l.id !== id))
    })
  }, [])

  /** Drops several lines at once, expanding any pack they belong to. */
  const removeLines = useCallback((ids: string[]) => {
    setLines((prev) => {
      const dropIds = new Set(ids)
      const dropPacks = new Set(
        prev.filter((l) => dropIds.has(l.id) && l.packUid).map((l) => l.packUid),
      )
      return prev.filter(
        (l) => !dropIds.has(l.id) && !(l.packUid && dropPacks.has(l.packUid)),
      )
    })
  }, [])

  const clear = useCallback(() => {
    setLines([])
    setDiscountState(0)
  }, [])

  const park = useCallback((label: string) => {
    setLines((current) => {
      if (current.length === 0) return current
      setDiscountState((currentPercent) => {
        setParked((prev) => [
          ...prev,
          {
            id: `${Date.now()}`,
            label,
            at: Date.now(),
            lines: current,
            discountPercent: currentPercent,
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
        setDiscountState(session.discountPercent ?? 0)
      }
      return prev.filter((s) => s.id !== id)
    })
  }, [])

  const dropParked = useCallback((id: string) => {
    setParked((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)

  /**
   * The discount is a PERCENTAGE, which is how it is actually given: "je te
   * fais dix pour cent". Held as the percentage rather than as the dinars it
   * came to, so that scanning one more article re-figures it instead of
   * leaving yesterday's amount sitting on a bigger ticket.
   */
  const setDiscountPercent = useCallback((percent: number) => {
    if (!Number.isFinite(percent)) return
    setDiscountState(Math.max(0, Math.min(100, percent)))
  }, [])

  // Rounded to the millime, then clamped: a discount can never exceed what is
  // owed, and makes no sense on a ticket that is a net refund.
  const effectiveDiscount = Math.min(
    Math.max(0, Math.round((Math.max(0, subtotal) * discount) / 100)),
    Math.max(0, subtotal),
  )

  const total = subtotal - effectiveDiscount
  const itemCount = lines.reduce((n, l) => n + Math.abs(l.qty), 0)
  const hasReturn = lines.some((l) => l.qty < 0)

  return {
    lines,
    parked,
    discount: effectiveDiscount,
    discountPercent: discount,
    setDiscountPercent,
    addProduct,
    addPack,
    addMisc,
    setQty,
    setPrice,
    toggleReturn,
    removeLine,
    removeLines,
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
