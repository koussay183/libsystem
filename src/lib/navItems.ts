import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Boxes,
  DatabaseBackup,
  HandCoins,
  Library,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react'

/**
 * THE MENU, WRITTEN DOWN ONCE.
 *
 * It used to live inside AppShell, built inline from `t()` calls. That was fine
 * while the shell was the only thing that had an opinion about it — but the
 * owner can now switch modules off (Réglages → Menu), and the screen holding
 * those switches has to list exactly the same rows, in exactly the same order,
 * as the sidebar it is editing. Two hand-kept copies of that list is how a
 * module ends up with a switch that turns nothing off, or a sidebar row nobody
 * can reach the switch for.
 *
 * Labels are i18n KEYS, not translated strings: this module is imported at the
 * top level, long before a language is chosen, and the sidebar has to follow
 * the language toggle without a reload.
 */
export interface NavItemDef {
  to: string
  icon: LucideIcon
  labelKey: string
}

export interface NavGroupDef {
  labelKey: string
  items: NavItemDef[]
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    labelKey: 'nav.sell',
    items: [{ to: '/caisse', icon: ShoppingCart, labelKey: 'nav.pos' }],
  },
  {
    labelKey: 'nav.manage',
    items: [
      { to: '/stock', icon: Package, labelKey: 'nav.stock' },
      { to: '/catalog', icon: Library, labelKey: 'catalog.title' },
      { to: '/packs', icon: Boxes, labelKey: 'packs.title' },
      { to: '/invoices', icon: ReceiptText, labelKey: 'nav.invoices' },
      { to: '/suppliers', icon: Truck, labelKey: 'nav.suppliers' },
      { to: '/credit', icon: HandCoins, labelKey: 'nav.credit' },
    ],
  },
  {
    labelKey: 'nav.analyse',
    items: [
      { to: '/dashboard', icon: Wallet, labelKey: 'nav.dashboard' },
      { to: '/reports', icon: BarChart3, labelKey: 'nav.reports' },
    ],
  },
]

/** Sits under the divider at the bottom of the sidebar. */
export const NAV_FOOTER: NavItemDef[] = [
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
  { to: '/backup', icon: DatabaseBackup, labelKey: 'nav.backup' },
]

/** Every row of the menu, in the order it is drawn. */
export const ALL_NAV_ITEMS: NavItemDef[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...NAV_FOOTER,
]

/**
 * The one row that can never be switched off.
 *
 * Réglages is the only way back to the screen holding the switches, so hiding
 * it would lock the owner out of his own menu with no way back short of typing
 * a URL — which is precisely the thing this app assumes he never does.
 */
export const LOCKED_NAV = new Set(['/settings'])

/**
 * Whether a module shows in the menu.
 *
 * HIDING IS A MENU DECISION AND NOTHING MORE. The route stays mounted and
 * reachable: /credit/:id is opened from the carnet, the till links to the
 * stock, and a bookmark must keep working. Switching a module off tidies the
 * menu; it does not take the module away, and nothing is deleted.
 */
export function isNavVisible(hidden: readonly string[] | undefined, to: string): boolean {
  if (LOCKED_NAV.has(to)) return true
  return !hidden?.includes(to)
}

/** The groups as drawn, with hidden rows — and any group left empty — removed. */
export function visibleNavGroups(hidden: readonly string[] | undefined): NavGroupDef[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => isNavVisible(hidden, i.to)),
  })).filter((g) => g.items.length > 0)
}

/** The footer rows as drawn. Réglages survives whatever the stored list says. */
export function visibleNavFooter(hidden: readonly string[] | undefined): NavItemDef[] {
  return NAV_FOOTER.filter((i) => isNavVisible(hidden, i.to))
}

/**
 * A stored hidden-list cleaned up before it is written or read.
 *
 * Drops the locked route (an older build, a hand-edited document or a restored
 * backup could carry it) and anything that no longer names a module — a list
 * that accumulates dead paths would silently start hiding a future route that
 * happens to reuse one.
 */
export function sanitiseHiddenNav(hidden: readonly string[] | undefined): string[] {
  if (!hidden?.length) return []
  const known = new Set(ALL_NAV_ITEMS.map((i) => i.to))
  return [...new Set(hidden)].filter((to) => known.has(to) && !LOCKED_NAV.has(to))
}
