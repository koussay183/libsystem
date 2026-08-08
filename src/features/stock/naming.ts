import type { Product } from '@/types/models'

/**
 * How a full product name is built from its family and its kind:
 * "Stylo Bic" + "Bleu" -> "Stylo Bic — Bleu".
 * `name` is what the till and every report display, so it must always be
 * filled even when the family/variant pair is half-empty.
 */
export const NAME_SEPARATOR = ' — '

export function composeName(family: string, variant: string): string {
  const f = family.trim()
  const v = variant.trim()
  if (f === '') return v
  if (v === '') return f
  return `${f}${NAME_SEPARATOR}${v}`
}

/** A family and the products (kinds) that belong to it. */
export interface Family {
  family: string
  items: Product[]
  totalQuantity: number
}

/**
 * Splits a product list into families and loners, keeping the incoming order
 * (the collection already arrives sorted by name). A family of one is not
 * worth a folding row, so it stays a plain product line.
 */
export function groupByFamily(products: Product[]): {
  families: Family[]
  loners: Product[]
} {
  const byFamily = new Map<string, Product[]>()
  const order: string[] = []
  const loners: Product[] = []

  for (const p of products) {
    const family = (p.family ?? '').trim()
    if (family === '') {
      loners.push(p)
      continue
    }
    const bucket = byFamily.get(family)
    if (bucket) bucket.push(p)
    else {
      byFamily.set(family, [p])
      order.push(family)
    }
  }

  const families: Family[] = []
  for (const family of order) {
    const items = byFamily.get(family) ?? []
    if (items.length < 2) {
      loners.push(...items)
      continue
    }
    families.push({
      family,
      items,
      totalQuantity: items.reduce((sum, p) => sum + p.quantity, 0),
    })
  }

  loners.sort((a, b) => a.name.localeCompare(b.name))
  return { families, loners }
}
