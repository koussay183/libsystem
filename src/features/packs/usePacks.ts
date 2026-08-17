import { useSyncExternalStore } from 'react'
import {
  collection,
  query,
  orderBy,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { createLiveCollection } from '@/lib/liveCollection'
import type { LiveFatalReason } from '@/lib/liveCollection'
import { track } from '@/lib/syncStatus'
import type { Pack, PackInput, PackItem, Product } from '@/types/models'
import type { Minor } from '@/lib/money'

const COL = 'packs'

const packsStore = createLiveCollection<Pack>(() =>
  query(collection(db, shopPath(COL)), orderBy('name')),
)

/**
 * The pack list, plus what a screen needs when the subscription has DIED rather
 * than merely fallen behind.
 *
 * `fatal` used to be dropped here: liveCollection published "I have given up"
 * — after a refusal, a blown quota, or five failures in a row — and this return
 * threw the flag away, so the till went on selling packs off whatever snapshot
 * happened to be resident, with nothing on any screen to say the prices could
 * no longer be confirmed. `retry` comes out with it because reporting a dead
 * listener without offering to re-arm it leaves the owner only a page reload,
 * and with the line down a reload is the single action that can cost him the
 * app entirely.
 *
 * `fatalReason === 'no-shop'` is not an alarm: it means the account is signed
 * out or between shops and a redirect is already on its way. Callers must check
 * it before warning about anything.
 */
export function usePacks() {
  const state = useSyncExternalStore(
    packsStore.subscribe,
    packsStore.getSnapshot,
    packsStore.getSnapshot,
  )
  return {
    packs: state.data,
    loading: state.loading,
    error: state.error,
    fatal: state.fatal,
    fatalReason: state.fatalReason,
    retry: packsStore.retry,
  }
}

/**
 * The give-up on its own, for the one banner in the app shell. See
 * useProductsFatal in src/features/stock/useProducts.ts for why the snapshot is
 * narrowed to a reason string rather than the whole state.
 */
const packsFatal = (): LiveFatalReason | null => {
  const state = packsStore.getSnapshot()
  return state.fatal ? state.fatalReason : null
}

export function usePacksFatal(): LiveFatalReason | null {
  return useSyncExternalStore(packsStore.subscribe, packsFatal, packsFatal)
}

/**
 * The id is minted locally and the write is not awaited: with the line down,
 * Firestore resolves a write only on server acknowledgement, and the owner
 * would sit in front of a spinner. The document is durable in IndexedDB the
 * moment setDoc is called.
 */
export function createPack(input: PackInput): string {
  const now = Date.now()
  const ref = doc(collection(db, shopPath(COL)))
  void track(setDoc(ref, { ...input, createdAt: now, updatedAt: now })).catch(() => {})
  return ref.id
}

/**
 * Neither of the two writes below is awaited, for the same reason createPack is
 * not: Firestore settles a write only on server acknowledgement, so with the
 * line down the promise NEVER settles — it does not reject either, so the
 * try/catch in PackForm.submit cannot help and its `finally setBusy(false)`
 * never runs. The dialog then spins with no way out but Cancel, and Cancel
 * unmounts the form, so the owner reopens it and saves again — a second queued
 * mutation for one intended edit.
 *
 * They stay `async` so every caller keeps awaiting exactly what it awaited
 * before; what changed is that the promise now resolves as soon as the change
 * is in the local cache, which is the moment the pack list behind the dialog
 * already shows it. A refusal from the server (lapsed plan, wrong shop) no
 * longer reaches the caller's catch — it is reported by track() through the
 * sync badge, which is the only place that can report it after the dialog has
 * closed anyway.
 */
export async function updatePack(id: string, input: PackInput) {
  void track(
    updateDoc(doc(db, shopPath(COL), id), { ...input, updatedAt: Date.now() }),
  ).catch(() => {
    /* replayed by the SDK; a refusal surfaces on the sync badge */
  })
}

export async function removePack(id: string) {
  void track(deleteDoc(doc(db, shopPath(COL), id))).catch(() => {
    /* replayed by the SDK; a refusal surfaces on the sync badge */
  })
}

// ---------------------------------------------------------------------------
// Turning a pack into ticket lines
// ---------------------------------------------------------------------------

/** One member of a pack, resolved against the live stock. */
export interface ResolvedPackItem {
  item: PackItem
  /** null when the article has since been deleted from the stock. */
  product: Product | null
}

export interface PackBreakdown {
  members: ResolvedPackItem[]
  /** Sum of the members at their normal shelf prices. */
  normalTotal: Minor
  /** What the pack is actually sold for. */
  packPrice: Minor
  /** normalTotal - packPrice, floored at 0. */
  saving: Minor
  /** Members whose article no longer exists — the pack cannot be sold as is. */
  missing: PackItem[]
  /** Members the stock says are not on the shelf in the quantity required. */
  short: ResolvedPackItem[]
}

export function resolvePack(pack: Pack, products: Product[]): PackBreakdown {
  const byId = new Map(products.map((p) => [p.id, p]))
  const members: ResolvedPackItem[] = pack.items.map((item) => ({
    item,
    product: byId.get(item.productId) ?? null,
  }))
  const normalTotal = members.reduce(
    (sum, m) => sum + (m.product?.salePrice ?? 0) * m.item.qty,
    0,
  )
  return {
    members,
    normalTotal,
    packPrice: pack.price,
    saving: Math.max(0, normalTotal - pack.price),
    missing: members.filter((m) => !m.product).map((m) => m.item),
    short: members.filter((m) => m.product && m.product.quantity < m.item.qty),
  }
}

/** A ticket line the pack expands into. */
export interface PackLine {
  product: Product
  qty: number
  /** Prorated so the whole pack adds up to exactly the pack price. */
  unitPrice: Minor
}

/**
 * Splits the pack price across its members.
 *
 * A pack is deliberately NOT sold as one anonymous line: each article has to
 * move its own stock and carry its own share of the revenue, or the
 * profitability report starts lying about which articles are worth stocking.
 * So the pack price is shared out in proportion to what each member would have
 * sold for on its own.
 *
 * Everything is integer millimes. Splitting a price across several units almost
 * always leaves a remainder, and it is shared out by the largest-remainder rule
 * — the unit that lost the most in the rounding is the first to get a millime
 * back. That makes the lines add up to the pack price EXACTLY, not
 * approximately: a pack that quietly rings up three millimes short every time
 * is a pack that is wrong.
 *
 * A member whose units end up at two different prices becomes two lines (the
 * dearer first). That is the honest way to show it, and it is the only way a
 * single unit price per line can total exactly.
 */
export function packToLines(pack: Pack, products: Product[], count = 1): PackLine[] {
  const { members } = resolvePack(pack, products)
  const sellable = members.filter(
    (m): m is ResolvedPackItem & { product: Product } => !!m.product && m.item.qty > 0,
  )
  if (sellable.length === 0 || count < 1) return []

  // One entry per physical unit, each weighted by what it sells for alone.
  const owner: number[] = []
  const weight: number[] = []
  sellable.forEach((m, memberIndex) => {
    for (let u = 0; u < m.item.qty; u += 1) {
      owner.push(memberIndex)
      weight.push(m.product.salePrice)
    }
  })

  // Every member free of charge would make a proportional split meaningless;
  // fall back to an equal share per unit.
  let total = weight.reduce((a, b) => a + b, 0)
  if (total <= 0) {
    weight.fill(1)
    total = weight.length
  }

  const price = weight.map((w) => Math.floor((pack.price * w) / total))
  const remainder = weight.map((w, i) => pack.price * w - price[i] * total)
  let left = pack.price - price.reduce((a, b) => a + b, 0)

  // Largest remainder first; ties go to the dearer unit, then to the earlier
  // one, so the same pack always splits the same way.
  const order = price
    .map((_, i) => i)
    .sort((a, b) => remainder[b] - remainder[a] || weight[b] - weight[a] || a - b)
  for (let i = 0; i < order.length && left > 0; i += 1) {
    price[order[i]] += 1
    left -= 1
  }

  // Units of one member share a weight, so they can only land on two adjacent
  // prices. Group them, dearer first.
  const lines: PackLine[] = []
  sellable.forEach((m, memberIndex) => {
    const prices = price.filter((_, i) => owner[i] === memberIndex)
    const distinct = [...new Set(prices)].sort((a, b) => b - a)
    for (const value of distinct) {
      lines.push({
        product: m.product,
        qty: prices.filter((p) => p === value).length * count,
        unitPrice: Math.max(0, value),
      })
    }
  })
  return lines
}

/** What the expanded lines really add up to — shown next to the pack price. */
export function linesTotal(lines: PackLine[]): Minor {
  return lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
}
