import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { fr } from './fr'
import { ar } from './ar'

export type Lang = 'fr' | 'ar'

// This runs at import time, before React and any error boundary exist: a
// browser that blocks storage (strict cookies, kiosk profiles) throws here and
// would leave the page on the boot spinner forever.
let stored: string | null = null
try {
  stored = localStorage.getItem('lang')
} catch {
  /* storage blocked — start in French */
}
const initialLang: Lang = stored === 'ar' ? 'ar' : 'fr'

/** Set the document direction + lang attributes to match the language. */
export function applyDirection(lang: string) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lang)
}

/**
 * The BCP 47 locale Chakra/Ark components read their direction from. `ar-TN`
 * resolves to the Arabic script, hence right-to-left; both keep Latin digits.
 */
export function localeOf(lang: string): string {
  return lang === 'ar' ? 'ar-TN' : 'fr-TN'
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: initialLang,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('lang', lng)
  } catch {
    /* storage blocked — the choice lasts this session only */
  }
  applyDirection(lng)
})

// Apply once at startup.
applyDirection(initialLang)

export default i18n
