import type { Minor } from '@/lib/money'
import type { ShopSettings } from '@/types/models'

/**
 * The chain from the supplier's invoice to the shelf label:
 *
 *   prix d'achat HT  --+ TVA -->  prix d'achat TTC  --+ marge -->  prix de vente
 *
 * The owner should only ever have to type the first number and pick the rate;
 * everything to the right of it fills itself in. Every step is reversible, so
 * he can also type the sale price he wants and see the margin it implies —
 * which is how he actually thinks about it at the counter.
 *
 * All amounts are integer millimes (src/lib/money.ts). Percentages are plain
 * numbers: 19 means 19%.
 */

/** The VAT rates a Tunisian shop actually meets. */
export const VAT_RATES = [0, 7, 19] as const

/** Used when the shop has set nothing: a fair general-purpose retail margin. */
export const FALLBACK_MARGIN = 35

/** Used when nothing is configured for a new article. */
export const FALLBACK_VAT = 19

const round = (n: number) => Math.max(0, Math.round(n))

/** Purchase price with the tax added on. */
export function ttcFromHt(htMinor: Minor, vatPercent: number): Minor {
  return round(htMinor * (1 + vatPercent / 100))
}

/** The other way round — what the invoice said before the tax. */
export function htFromTtc(ttcMinor: Minor, vatPercent: number): Minor {
  return round(ttcMinor / (1 + vatPercent / 100))
}

/** Sale price that leaves `marginPercent` on top of what the shop paid. */
export function saleFromCost(costTtcMinor: Minor, marginPercent: number): Minor {
  return round(costTtcMinor * (1 + marginPercent / 100))
}

/**
 * The margin a chosen sale price actually represents. Null when there is no
 * purchase price to compare against, so the caller shows nothing rather than
 * a confident "0%".
 */
export function marginFromPrices(costTtcMinor: Minor, saleMinor: Minor): number | null {
  if (costTtcMinor <= 0) return null
  return ((saleMinor - costTtcMinor) / costTtcMinor) * 100
}

/**
 * What margin to start a new article at. The category wins over the shop-wide
 * default, because paper goods carry a thinner one than everything else and
 * the owner should not have to remember which is which.
 */
export function defaultMarginFor(
  category: string | undefined,
  shop: ShopSettings | undefined,
): number {
  const perCategory = category ? shop?.categoryMargins?.[category] : undefined
  if (typeof perCategory === 'number' && Number.isFinite(perCategory)) return perCategory
  const general = shop?.defaultMargin
  if (typeof general === 'number' && Number.isFinite(general)) return general
  return FALLBACK_MARGIN
}

export function defaultVatFor(shop: ShopSettings | undefined): number {
  const vat = shop?.defaultVat
  return typeof vat === 'number' && Number.isFinite(vat) ? vat : FALLBACK_VAT
}

/** Parses a typed percentage ("35", "35,5", " 20 %"). Null when unusable. */
export function parsePercent(input: string): number | null {
  const cleaned = input.trim().replace('%', '').replace(',', '.')
  if (cleaned === '') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null
  // A margin can be negative (selling off at a loss is a real decision), but a
  // thousand percent is a typo, not a decision.
  return Math.max(-100, Math.min(1000, value))
}
