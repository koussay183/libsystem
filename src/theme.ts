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
        brand: {
          50: { value: '#f0f9f8' },
          100: { value: '#d9efec' },
          200: { value: '#b4dfda' },
          300: { value: '#85c8c1' },
          400: { value: '#52aaa3' },
          500: { value: '#348e88' },
          600: { value: '#287a76' },
          700: { value: '#236462' },
          800: { value: '#204f4e' },
          900: { value: '#1e4241' },
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
          solid: { value: '{colors.brand.600}' },
          contrast: { value: 'white' },
          fg: { value: '{colors.brand.700}' },
          muted: { value: '{colors.brand.100}' },
          subtle: { value: '{colors.brand.50}' },
          emphasized: { value: '{colors.brand.200}' },
          focusRing: { value: '{colors.brand.500}' },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
