import { forwardRef, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input, Text } from '@chakra-ui/react'
import type { InputProps } from '@chakra-ui/react'
import { formatPhoneTyping, isTnPhone, normalizePhone } from '@/lib/phone'

type Props = Omit<InputProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/**
 * A phone field that writes the number the way it is read aloud,
 * "98 123 456", as it is typed — and says so, without refusing, when what was
 * typed is not a Tunisian number.
 */
export const PhoneInput = forwardRef<HTMLInputElement, Props>(function PhoneInput(
  { value, onChange, onBlur, ...rest },
  ref,
) {
  const { t } = useTranslation()
  // Judged once he leaves the field: half a number is not a wrong number.
  const [left, setLeft] = useState(false)
  const typed = useRef(false)
  const odd = left && !isTnPhone(value)

  return (
    <>
      <Input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="98 123 456"
        // Digits read left to right in Arabic too; kept on the reading side.
        dir="ltr"
        _rtl={{ textAlign: 'right' }}
        value={value}
        onChange={(e) => {
          setLeft(false)
          typed.current = true
          onChange(formatPhoneTyping(e.target.value))
        }}
        onBlur={(e) => {
          setLeft(true)
          // Only a number he has just typed is tidied: merely passing through
          // the field must not rewrite a stored one (and mark a form changed).
          if (typed.current) {
            typed.current = false
            const tidy = normalizePhone(value)
            if (tidy !== value) onChange(tidy)
          }
          onBlur?.(e)
        }}
        {...rest}
      />
      {odd && (
        <Text fontSize="sm" color="orange.fg" mt={1}>
          {t('smart.phoneOdd')}
        </Text>
      )}
    </>
  )
})
