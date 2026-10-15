/**
 * The Mektebti logo, exactly as the owner drew it — the PNGs in public/brand
 * are cut straight out of the original artwork, never redrawn.
 *
 *  · `tone="light"` — dark wordmark, for white/pale backgrounds (the app).
 *  · `tone="dark"`  — white wordmark, for the black/ink backgrounds (landing).
 *
 * Plain <img>, no Chakra, so the landing page can use it without pulling the
 * design system's styling in. Width/height are set so nothing jumps on load.
 */

const RATIO = 510 / 110

type LogoProps = {
  /** Rendered height in px. */
  height?: number
  tone?: 'light' | 'dark'
}

export function BrandLogo({ height = 32, tone = 'light' }: LogoProps) {
  return (
    <img
      src={tone === 'dark' ? '/brand/logo-on-dark.png' : '/brand/logo-on-light.png'}
      alt="Mektebti.tn"
      width={Math.round(height * RATIO)}
      height={height}
      style={{ display: 'block', height, width: 'auto', maxWidth: '100%' }}
      decoding="async"
    />
  )
}

/** The bars-and-arrow mark alone (blue), for small places. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/brand/mark.png"
      alt=""
      aria-hidden="true"
      width={Math.round(size * (97 / 107))}
      height={size}
      style={{ display: 'block', height: size, width: 'auto' }}
      decoding="async"
    />
  )
}
