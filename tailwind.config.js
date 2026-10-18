/**
 * Tailwind is used for the public landing page only (src/features/landing).
 *
 * The shop app is styled by Chakra, so two things keep Tailwind out of it:
 *  · preflight (Tailwind's global reset) is off — it would restyle every
 *    Chakra component the moment the landing stylesheet loaded in the SPA;
 *  · every utility is scoped under `.mk`, the landing's root element, so a
 *    class name that happens to match cannot leak into the till.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/features/landing/**/*.{ts,tsx}'],
  important: '.mk',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0b0a1f', soft: '#3d3b5c', muted: '#5d5b7a' },
        brand: {
          50: '#f1f0ff',
          100: '#e3e0ff',
          200: '#c9c3ff',
          300: '#a69cff',
          400: '#7d6dff',
          500: '#5b4bff',
          600: '#4029f2',
          700: '#2a12cf',
          800: '#1800ac',
          900: '#140a85',
          950: '#0c0652',
        },
        amber: { 300: '#ffc24a', 400: '#ffad20', 500: '#f98d07' },
        line: '#e7e5f5',
        paper: '#f7f7fb',
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Noto Kufi Arabic"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,10,31,.06), 0 8px 24px -12px rgba(11,10,31,.12)',
        shot: '0 2px 6px rgba(11,10,31,.08), 0 30px 60px -24px rgba(24,0,172,.35)',
      },
    },
  },
  plugins: [],
}
