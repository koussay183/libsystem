import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

/**
 * Chakra v3 design system for the shop.
 * Tuned for a non-technical owner on a wide desktop screen: generous sizing,
 * high contrast, one calm brand colour. `colorPalette="brand"` works on any
 * component thanks to the semantic tokens below.
 */
const config = defineConfig({
  globalCss: {
    'html, body': {
      bg: 'bg.subtle',
      color: 'fg',
      // A stray wide child (a long table, a nav row) must never make the whole
      // page scroll sideways — wide content scrolls inside its own container.
      overflowX: 'clip',
    },
    // Bigger baseline than Chakra's default — easier to read across the shop.
    // Scaled down a little on small screens so nothing overflows.
    html: {
      fontSize: '16px',
      md: { fontSize: '17px' },
    },
    // Wide blocks scroll inside their own container instead — every table in
    // the app wraps in `<Box overflowX="auto">` (or Chakra's Table.ScrollArea),
    // so no global utility class is needed here.
  },
  theme: {
    slotRecipes: {
      // Chakra pins a segmented control to `minW: max-content`, so the two- and
      // three-option switches in this app simply run off the side of a phone
      // with no way to reach the hidden option. Let it shrink and scroll.
      segmentGroup: {
        slots: ['root', 'item'],
        base: {
          root: {
            minW: 0,
            maxW: 'full',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          },
          item: { flexShrink: 0 },
        },
      },
      // Dialogs had no gutter, so on a narrow screen they ran edge to edge and
      // a footer with three buttons pushed the last one out of reach.
      dialog: {
        slots: ['positioner', 'footer'],
        base: {
          positioner: { paddingInline: { base: 3, sm: 4 } },
          footer: { flexWrap: 'wrap' },
        },
      },
    },
    tokens: {
      colors: {
        // Mektebti ultramarine. The logo's own blue (#1800AC) sits at 800: it
        // is too dark to carry a button on its own and vanishes on black, so
        // the scale is built around it on the same hue and buttons use 700,
        // which still reads as "the logo" while passing contrast with white.
        brand: {
          50: { value: '#f1f0ff' },
          100: { value: '#e3e0ff' },
          200: { value: '#c9c3ff' },
          300: { value: '#a69cff' },
          400: { value: '#7d6dff' },
          500: { value: '#5b4bff' },
          600: { value: '#4029f2' },
          700: { value: '#2a12cf' },
          800: { value: '#1800ac' },
          900: { value: '#140a85' },
          950: { value: '#0c0652' },
        },
        // The warm note against the blue: growth, the call to action, the
        // highlight in a chart. Used sparingly so it keeps meaning something.
        accent: {
          50: { value: '#fff8eb' },
          100: { value: '#ffedc6' },
          200: { value: '#ffd988' },
          300: { value: '#ffc24a' },
          400: { value: '#ffad20' },
          500: { value: '#f98d07' },
          600: { value: '#dd6702' },
          700: { value: '#b74606' },
          800: { value: '#94350c' },
          900: { value: '#7a2d0d' },
          950: { value: '#461502' },
        },
        // Near-black with a drop of the brand hue — what the logo's black
        // background becomes on screen. Pure #000 looks like a dead display.
        ink: {
          value: '#0b0a1f',
        },
      },
      fonts: {
        heading: { value: '"Segoe UI", "Noto Kufi Arabic", system-ui, sans-serif' },
        body: { value: '"Segoe UI", "Noto Kufi Arabic", system-ui, sans-serif' },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: '{colors.brand.700}' },
          contrast: { value: 'white' },
          fg: { value: '{colors.brand.700}' },
          muted: { value: '{colors.brand.100}' },
          subtle: { value: '{colors.brand.50}' },
          emphasized: { value: '{colors.brand.200}' },
          focusRing: { value: '{colors.brand.500}' },
        },
        accent: {
          solid: { value: '{colors.accent.400}' },
          contrast: { value: '{colors.ink}' },
          fg: { value: '{colors.accent.700}' },
          muted: { value: '{colors.accent.100}' },
          subtle: { value: '{colors.accent.50}' },
          emphasized: { value: '{colors.accent.200}' },
          focusRing: { value: '{colors.accent.500}' },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
