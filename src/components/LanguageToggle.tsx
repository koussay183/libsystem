import { useTranslation } from 'react-i18next'
import { Button, Text } from '@chakra-ui/react'
import { Languages } from 'lucide-react'

/** Toggles between French and Arabic. Shows the language you'll switch TO. */
export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'
  const target = isArabic ? 'fr' : 'ar'
  const label = isArabic ? 'Français' : 'العربية'

  return (
    <Button
      variant="outline"
      size="lg"
      borderRadius="full"
      px={{ base: 3, md: 4 }}
      // The accessible name contains the visible word, so "click العربية"
      // works for voice control.
      aria-label={`${t('common.changeLanguage')} : ${label}`}
      onClick={() => i18n.changeLanguage(target)}
    >
      <Languages size={20} />
      {/* The full word steals the page title's room on a phone. */}
      <Text as="span" lang={target} display={{ base: 'none', md: 'inline' }}>
        {label}
      </Text>
      <Text as="span" lang={target} display={{ base: 'inline', md: 'none' }}>
        {isArabic ? 'FR' : 'ع'}
      </Text>
    </Button>
  )
}
