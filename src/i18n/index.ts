import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { fr } from './fr'
import { ar } from './ar'

export type Lang = 'fr' | 'ar'

const stored = localStorage.getItem('lang')
const initialLang: Lang = stored === 'ar' ? 'ar' : 'fr'

/** Set the document direction + lang attributes to match the language. */
export function applyDirection(lang: string) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lang)
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
  localStorage.setItem('lang', lng)
  applyDirection(lng)
})

// Apply once at startup.
applyDirection(initialLang)

export default i18n
