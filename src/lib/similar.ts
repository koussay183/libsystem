import { fold } from './textIndex'
import { phoneKey } from './phone'

interface Named {
  id: string
  name: string
  phone?: string
}

export interface Similar<T> {
  item: T
  /** Same name or same phone: almost certainly the same person. */
  duplicate: boolean
}

/**
 * Existing customers or suppliers that look like the one being typed.
 *
 * The carnet that holds "Hédi Ben Salah" and "hedi ben salah" splits one debt
 * in two, and neither half is ever chased in full. Names are compared folded
 * (accents, case, Arabic spellings), phones by their digits.
 */
export function findSimilar<T extends Named>(
  items: readonly T[],
  name: string,
  phone: string,
  excludeId?: string,
  limit = 4,
): Similar<T>[] {
  const n = fold(name).replace(/\s+/g, ' ')
  const p = phoneKey(phone)
  const words = n.split(' ').filter((w) => w.length >= 2)
  if (n.length < 2 && p.length < 8) return []

  const out: Similar<T>[] = []
  for (const item of items) {
    if (item.id === excludeId) continue
    const itemName = fold(item.name).replace(/\s+/g, ' ')
    const samePhone = p.length >= 8 && phoneKey(item.phone) === p
    const sameName = n !== '' && itemName === n
    const close =
      n.length >= 3 &&
      (itemName.startsWith(n) || (words.length > 0 && words.every((w) => itemName.includes(w))))
    if (samePhone || sameName || close) out.push({ item, duplicate: samePhone || sameName })
  }
  // The near-certain duplicates first, then by name.
  out.sort(
    (a, b) => Number(b.duplicate) - Number(a.duplicate) || a.item.name.localeCompare(b.item.name),
  )
  return out.slice(0, limit)
}
