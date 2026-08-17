import { useCallback, useEffect, useState } from 'react'
import type { Product } from '@/types/models'
import { currentShopId } from '@/lib/tenant'

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
 * v4: THE KEY IS NOW PER SHOP, and that is a tenancy fix, not a format change.
 *
 * Up to v3 this was one machine-wide key. Isolation in this system is
 * structural — every document lives under shops/{shopId}/… and shopPath()
 * throws rather than build a path without a tenant in it — but localStorage sits
 * outside all of that, and Firestore's rules cannot reach it. So: shop A parks
 * "table 3" and "M. Belhadj" on the shop PC and signs out; logout wipes the
 * Firestore cache and resets every live collection, and this key was left
 * untouched. Shop B signs in on the same machine and finds shop A's tickets
 * waiting in its till — article names, quantities and unit prices — and
 * resuming one puts another shop's basket on its counter.
 *
 * The old key is deleted rather than adopted into whichever shop happens to sign
 * in first, which would be the very leak this is fixing. Nothing real is lost by
 * that: the SaaS build is served from a different origin than the pre-SaaS one,
 * and localStorage does not cross origins, so no shop has parked tickets under
 * the old key to begin with.
 */
const PARKED_PREFIX = 'pos.parked.v4.'
const PARKED_LEGACY_KEY = 'pos.parked.v3'

/** Nobody sells a thousand of anything on one line — past this it is a typo. */
const MAX_QTY = 999

/**
 * Where the ticket CURRENTLY on the counter is mirrored, as opposed to the
 * parked ones above.
 *
 * Keyed by shop, and the shop is read at call time rather than captured once: a
 * basket must never cross tenants, and two accounts on one machine (an owner
 * signing out, a second shop signing in) is exactly how that would happen.
 * With no shop selected there is no key and nothing is stored at all — writing
 * to a shopless key would be the localStorage twin of the root-path fallback
 * that `shopPath()` in lib/tenant.ts deliberately throws rather than make.
 */
const DRAFT_PREFIX = 'pos.draft.v1.'

/** Any other value in a stored draft is dropped, never migrated. */
const DRAFT_VERSION = 1

/**
 * How long a recovered basket is still believable: six hours, i.e. one half of
 * a trading day plus the time it takes to fetch another machine or restart this
 * one.
 *
 * Deliberately not longer. A basket from yesterday reappearing at the till is
 * worse than losing one from five minutes ago — the cashier trusts the screen,
 * and yesterday's eleven articles would be sold again as today's while the real
 * customer is standing there with three. Six hours restores the crash the shop
 * is actually recovering from (mid-morning, back on its feet by noon) and can
 * never survive a night, whatever time the shop opens.
 */
const DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000

/**
 * A counter ticket is tens of lines; back-to-school with several packs on it is
 * still under a hundred. Past this the blob is corrupt rather than a sale, and
 * restoring it would hang the till on the render instead of losing one basket.
 */
const DRAFT_MAX_LINES = 400

/**
 * WHY THE MIRROR NEEDS AN OWNER, and it is not a nicety.
 *
 * One key per shop, and two tabs are a normal configuration here — it is why
 * firebase.ts asks for persistentMultipleTabManager, and the shop PC runs the
 * till on one tab and the stock on another. Without an owner, two things went
 * wrong, in opposite directions:
 *
 *  · THE SAME BASKET ON TWO SCREENS. The cashier has eleven lines on the
 *    counter. Someone opens the till in a second tab; its first render calls
 *    loadDraft(), the draft is minutes old and passes every check, so the same
 *    eleven lines are painted there too. Both tabs can now press Encaisser, and
 *    the second one has no way of knowing the first already sold it — the
 *    customer is charged twice for one basket.
 *
 *  · THE RECOVERY SILENTLY SWITCHED OFF. That same second tab mounts with an
 *    empty basket, the mirror effect runs on mount, takes the "nothing to store"
 *    branch and REMOVES the key. The first tab's eleven lines are no longer
 *    mirrored anywhere, and the crash protection this whole mechanism exists for
 *    is gone with no sign that it went.
 *
 * A tab id plus a heartbeat separates the two cases that actually differ: a tab
 * that is alive and holding the basket (leave it alone) from a tab that died
 * holding it (adopt it — that is the crash this feature is for). The heartbeat
 * is what makes death detectable at all; a dead tab cannot announce itself.
 */
const TAB_ID = `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

/**
 * How long another tab's mirror is presumed live. Comfortably more than
 * DRAFT_BEAT_MS, so an ordinary pause — a throttled background tab, a busy main
 * thread mid-scan — is never mistaken for a crash.
 */
const LIVE_TAB_MS = 20_000

/** How often the tab holding a basket re-stamps its claim on it. */
const DRAFT_BEAT_MS = 5_000

interface StoredDraft {
  v: number
  /** When the cashier last touched this ticket, for the staleness check. */
  at: number
  /** Which tab is holding it. @see TAB_ID */
  owner: string
  lines: PosLine[]
  discountPercent: number
}

/** The part of a draft that is handed back to the hook's state. */
interface DraftState {
  lines: PosLine[]
  discountPercent: number
}

function noDraft(): DraftState {
  return { lines: [], discountPercent: 0 }
}

function draftKey(): string | null {
  const shop = currentShopId()
  return shop === '' ? null : `${DRAFT_PREFIX}${shop}`
}

const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Whether one stored row is still a line this till can price.
 *
 * Strict on purpose. The blob can come from an older build, from a half-written
 * `setItem`, or from a hand-edited localStorage, and every field below is read
 * by arithmetic (`qty * unitPrice`) or by a reducer that matches on it. A NaN
 * price would put NaN on the ticket total; a missing id would make `removeLine`
 * unable to remove the row the cashier is clicking.
 */
function isStoredLine(v: unknown): v is PosLine {
  if (typeof v !== 'object' || v === null) return false
  const l = v as Record<string, unknown>
  return (
    typeof l.id === 'string' &&
    l.id !== '' &&
    (l.productId === null || typeof l.productId === 'string') &&
    (l.barcode === null || typeof l.barcode === 'string') &&
    typeof l.name === 'string' &&
    typeof l.qty === 'number' &&
    Number.isInteger(l.qty) &&
    l.qty !== 0 &&
    Math.abs(l.qty) <= MAX_QTY &&
    isAmount(l.unitPrice) &&
    isAmount(l.unitCost) &&
    isAmount(l.stock) &&
    (l.priceEdited === undefined || typeof l.priceEdited === 'boolean') &&
    (l.packUid === undefined || typeof l.packUid === 'string') &&
    (l.packId === undefined || typeof l.packId === 'string') &&
    (l.packName === undefined || typeof l.packName === 'string') &&
    (l.packPrice === undefined || isAmount(l.packPrice))
  )
}

/**
 * The basket that was open when the app went away, or an empty one.
 *
 * Never throws: this runs during the first render of the till, which is the
 * screen the error boundary exists to protect — throwing here would cause the
 * very blank page the whole persistence effort is about.
 *
 * ALL OR NOTHING. One bad row drops the entire draft instead of being filtered
 * out, because a basket silently missing an article is worse than no basket:
 * the cashier reads the total off the screen and undercharges, and nothing on
 * screen says a line went missing. Losing the basket is visible; losing one
 * line of it is not.
 *
 * Nothing here checks the lines against the live products, and it must not: this
 * runs before the first snapshot has arrived, so "the product is missing" and
 * "the stock has not loaded yet" are the same thing here. A repriced article
 * deliberately keeps the price it was rung up at — that is what the customer was
 * quoted — and a deleted one is already handled downstream by `staleLines` in
 * CaissePage, which blocks settling a ticket that names a product the stock no
 * longer has.
 */
function loadDraft(): DraftState {
  const key = draftKey()
  if (!key) return noDraft()
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return noDraft()
    const d = JSON.parse(raw) as Partial<StoredDraft> | null
    if (!d || d.v !== DRAFT_VERSION) return noDraft()
    if (!isAmount(d.at)) return noDraft()
    const age = Date.now() - d.at
    // A negative age means the clock moved: a machine whose date was wrong and
    // has since been corrected would otherwise carry an immortal draft.
    if (age < 0 || age > DRAFT_MAX_AGE_MS) return noDraft()
    // Another tab is alive and holding this basket — see TAB_ID. Adopting it
    // here is what let one ticket be settled twice, so this tab starts empty
    // instead. It is not lost: the tab that owns it still has it on screen.
    if (typeof d.owner === 'string' && d.owner !== TAB_ID && age < LIVE_TAB_MS) return noDraft()
    const lines = d.lines
    if (!Array.isArray(lines)) return noDraft()
    if (lines.length === 0 || lines.length > DRAFT_MAX_LINES) return noDraft()
    if (!lines.every(isStoredLine)) return noDraft()
    // Duplicate ids would make setQty and removeLine act on two rows at once.
    if (new Set(lines.map((l) => l.id)).size !== lines.length) return noDraft()
    const pct = d.discountPercent
    return {
      lines,
      discountPercent: isAmount(pct) ? Math.max(0, Math.min(100, pct)) : 0,
    }
  } catch {
    return noDraft()
  }
}

/**
 * Drops the mirrored basket, but only if this tab is the one holding it.
 * Synchronous, which is the whole point — see clear().
 *
 * The ownership test is what stops one tab erasing another tab's live basket.
 * An abandoned claim is still removable: if the holder's heartbeat has gone
 * quiet for longer than LIVE_TAB_MS the tab is gone, and leaving its draft
 * behind would only mean the next tab adopts a basket nobody is standing at.
 */
function forgetDraft(): void {
  const key = draftKey()
  if (!key) return
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const d = JSON.parse(raw) as Partial<StoredDraft> | null
      const held =
        d && typeof d.owner === 'string' && d.owner !== TAB_ID && isAmount(d.at)
          ? Date.now() - d.at < LIVE_TAB_MS
          : false
      if (held) return
    }
    localStorage.removeItem(key)
  } catch {
    /* storage unavailable — there was nothing durable to drop anyway */
  }
}

let seq = 0
const nextId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`

function parkedKey(): string | null {
  const shop = currentShopId()
  return shop === '' ? null : `${PARKED_PREFIX}${shop}`
}

function loadParked(): ParkedSession[] {
  try {
    // Deleted on the way past, wherever this runs from. @see PARKED_PREFIX
    localStorage.removeItem(PARKED_LEGACY_KEY)
  } catch {
    /* storage unavailable: there is nothing to leak either */
  }
  const key = parkedKey()
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    /*
      Every line of every parked ticket goes through the same validator as the
      draft, where the check used to be `Array.isArray(s.lines)` alone. These
      rows are read by arithmetic the moment one is resumed — qty * unitPrice
      lands on the total the cashier reads out loud — so a NaN price or a missing
      id from an older build or a half-written setItem is a wrong charge, not a
      cosmetic fault.

      A session that fails is dropped whole, for the reason loadDraft() gives:
      a basket quietly missing one article is worse than a basket that is gone,
      because only one of the two is visible.
    */
    return parsed.filter((s): s is ParkedSession => {
      if (typeof s !== 'object' || s === null) return false
      const p = s as Record<string, unknown>
      return (
        typeof p.id === 'string' &&
        p.id !== '' &&
        typeof p.label === 'string' &&
        isAmount(p.at) &&
        Array.isArray(p.lines) &&
        p.lines.length > 0 &&
        p.lines.length <= DRAFT_MAX_LINES &&
        p.lines.every(isStoredLine) &&
        new Set((p.lines as PosLine[]).map((l) => l.id)).size === p.lines.length &&
        isAmount(p.discountPercent)
      )
    })
  } catch {
    return []
  }
}

/**
 * The till's current ticket plus any parked tickets. Both live in localStorage
 * so serving another client, a refresh, a crash or a browser killed by Windows
 * never loses a basket.
 */
export function usePosCart() {
  /**
   * Read once, during the first render, so the restored ticket is on screen
   * before the cashier can touch anything — an effect would paint an empty till
   * first, and an empty till is what the cashier reacts to.
   */
  const [restored] = useState(loadDraft)
  const [lines, setLines] = useState<PosLine[]>(restored.lines)
  /** Percent off the whole ticket, 0-100. */
  const [discount, setDiscountState] = useState(restored.discountPercent)
  const [parked, setParked] = useState<ParkedSession[]>(loadParked)

  useEffect(() => {
    const key = parkedKey()
    // No shop selected means no key, and writing to a shopless one would be the
    // localStorage twin of the root-path fallback shopPath() refuses to make.
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify(parked))
    } catch {
      /* storage full or unavailable — parking is best-effort */
    }
  }, [parked])

  /**
   * Mirror the open ticket after every change to it, so the copy on disk is
   * never more than one scan behind what the customer can see.
   *
   * `at` is re-stamped on every change on purpose: what has to be fresh is the
   * last time the cashier touched this ticket, not the moment it was opened. A
   * basket being worked on for two hours is live, not stale. Restoring one also
   * re-stamps it, since this effect runs on mount — which is deliberate: a
   * restored basket is on screen in front of the cashier, so the case
   * DRAFT_MAX_AGE_MS actually guards against (a ticket nobody has looked at
   * since a previous session) still cannot come back.
   *
   * An empty basket removes the key rather than storing `[]`, which keeps
   * "there is nothing to restore" and "there is nothing stored" the same state
   * and means park() and resume() need no persistence code of their own. This
   * effect is declared AFTER the parked one on purpose: they flush in that order
   * in the same commit, so a parked ticket is already on disk by the time the
   * draft that was holding it is dropped.
   */
  useEffect(() => {
    const key = draftKey()
    if (!key) return
    try {
      if (lines.length === 0) {
        // ONLY OUR OWN. This branch runs on mount too, so a second tab opening
        // on an empty till used to delete the basket the first tab was actively
        // holding — switching off the crash recovery for the one ticket that
        // needed it, silently. forgetDraft() applies the same rule.
        forgetDraft()
        return
      }
      const draft: StoredDraft = {
        v: DRAFT_VERSION,
        at: Date.now(),
        // Writing our id claims the basket. A tab with lines on screen is the
        // one actively being used, so it is right that it takes the mirror over
        // from an older claim — what must not happen is a tab with NOTHING on
        // screen taking it over, and that is the branch above.
        owner: TAB_ID,
        lines,
        discountPercent: discount,
      }
      localStorage.setItem(key, JSON.stringify(draft))
    } catch {
      /* storage full or unavailable — the mirror is best-effort */
    }
  }, [lines, discount])

  /**
   * Keep the claim warm while a basket is on the counter.
   *
   * Without this, a cashier who scans eleven articles and then spends four
   * minutes finding a bag would let his own draft go stale, and a second tab
   * opened at that moment would adopt the live basket — the double-sell this is
   * all here to prevent. Nothing is written when the till is empty: an empty
   * till holds no claim and has nothing to defend.
   */
  useEffect(() => {
    if (lines.length === 0) return
    const beat = () => {
      const key = draftKey()
      if (!key) return
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return
        const d = JSON.parse(raw) as Partial<StoredDraft> | null
        // Somebody else has taken it over. Do not stamp our id back onto their
        // basket: that would leave two tabs each believing they hold it.
        if (!d || d.owner !== TAB_ID) return
        localStorage.setItem(key, JSON.stringify({ ...d, at: Date.now() }))
      } catch {
        /* best-effort, exactly like the mirror above */
      }
    }
    const timer = setInterval(beat, DRAFT_BEAT_MS)
    return () => clearInterval(timer)
  }, [lines.length])

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
    /**
     * The stored copy goes FIRST, and synchronously.
     *
     * clear() is what runs the instant a sale is recorded: CaissePage's finish()
     * calls it as soon as recordSale returns, and recordSale has by then already
     * committed its batch to the local cache, which is durable and replayed on
     * reconnect — so the sale exists whether or not the server has heard about
     * it yet. Waiting for an acknowledgement here would be waiting for a promise
     * that never settles with the line down. The effect above would also clear the
     * mirror, but only after React commits: a crash, a killed browser or a power
     * cut in that window would leave a ticket the shop has already printed and
     * taken money for sitting on disk, and the next start would put it back on
     * the counter for the cashier to sell a second time. Double-selling is far
     * worse than the lost basket this persistence exists to prevent, so the
     * removal does not wait for a render.
     *
     * The manual "vider le ticket" button reaches the same instant through the
     * same call, which is also correct: a basket the cashier deliberately
     * emptied must not come back either.
     */
    forgetDraft()
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
