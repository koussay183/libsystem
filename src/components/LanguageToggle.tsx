import { useTranslation } from 'react-i18next'
import { Button } from '@chakra-ui/react'
import { Languages } from 'lucide-react'

/** Toggles between French and Arabic. Shows the language you'll switch TO. */
export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'

  return (
    <Button
      variant="outline"
      size="lg"
      borderRadius="full"
      aria-label={t('common.changeLanguage')}
      onClick={() => i18n.changeLanguage(isArabic ? 'fr' : 'ar')}
    >
      <Languages size={20} />
      {isArabic ? 'Français' : 'العربية'}
    </Button>
  )
}
