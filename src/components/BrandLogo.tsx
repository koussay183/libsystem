/**
 * The Mektebti mark: three rising bars under a growth arrow — the "M" of the
 * logo the brand was drawn from — and the wordmark beside it.
 *
 * Plain SVG and plain spans, no Chakra: the landing page uses it too, and it
 * must render identically there, in the sidebar and on the login screen.
 * Colours come from `currentColor` + one accent, so it works on light and dark.
 */

type MarkProps = {
  size?: number
  /** Colour of the bars and arrow. Defaults to the brand ultramarine. */
  color?: string
  /** Colour of the arrow head and the last bar — the "growth" note. */
  accent?: string
  title?: string
}

export function BrandMark({ size = 32, color = '#2A12CF', accent = '#5B4BFF', title }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <rect x="6" y="38" width="12" height="20" rx="2.5" fill={color} />
      <rect x="22" y="30" width="12" height="28" rx="2.5" fill={color} />
      <rect x="38" y="22" width="12" height="36" rx="2.5" fill={accent} />
      <path
        d="M4 32 C 20 30, 36 22, 50 10"
        fill="none"
        stroke={accent}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M43 6 L58 4 L54 19 Z" fill={accent} />
    </svg>
  )
}

type LogoProps = {
  size?: number
  /** Text colour of the wordmark. */
  textColor?: string
  color?: string
  accent?: string
  /** Hide the ".tn" — the sidebar is narrow. */
  short?: boolean
}

/** Mark + "MEKTEBTI.TN" set in the heaviest weight the system font has. */
export function BrandLogo({ size = 32, textColor = 'currentColor', color, accent, short }: LogoProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.22,
        color: textColor,
        direction: 'ltr',
        lineHeight: 1,
      }}
    >
      <BrandMark size={size} color={color} accent={accent} />
      <span
        style={{
          fontWeight: 900,
          fontSize: size * 0.62,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        MEKTEBTI{short ? '' : <span style={{ opacity: 0.55 }}>.TN</span>}
      </span>
    </span>
  )
}
