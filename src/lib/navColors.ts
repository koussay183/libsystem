/**
 * One colour per module, agreed on by the whole app.
 *
 * The owner does not read the sidebar — after a week he goes for the orange
 * one because orange is the carnet. That only works if orange is the carnet
 * everywhere: in the sidebar, on the home tile, and at the top of the page it
 * opens. Keeping the mapping in one place is what stops those three drifting.
 *
 * Values are Chakra colour palettes, so `colorPalette={ROUTE_PALETTE[path]}`
 * makes `colorPalette.solid` / `.subtle` / `.fg` / `.contrast` available on
 * every descendant.
 */
export const ROUTE_PALETTE: Record<string, string> = {
  '/caisse': 'green',
  '/stock': 'brand',
  '/packs': 'cyan',
  '/invoices': 'blue',
  '/suppliers': 'purple',
  '/credit': 'orange',
  '/dashboard': 'teal',
  '/reports': 'pink',
  '/settings': 'gray',
  '/backup': 'red',
}

/** The colour of whatever route this path belongs to. */
export function paletteFor(pathname: string): string {
  const exact = ROUTE_PALETTE[pathname]
  if (exact) return exact
  for (const [route, palette] of Object.entries(ROUTE_PALETTE)) {
    if (pathname.startsWith(`${route}/`)) return palette
  }
  return 'brand'
}
