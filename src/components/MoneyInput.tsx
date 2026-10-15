import { forwardRef, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Input, Text } from '@chakra-ui/react'
import type { InputProps } from '@chakra-ui/react'
import {
  formatMoney,
  getMoneyMode,
  moneyPlaceholder,
  moneySymbolKey,
  parseMoney,
  subscribeMoneyMode,
} from '@/lib/money'

type Props = Omit<InputProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  /**
   * The "= 10,500 DT" echo. Off where the amount is already shown next to the
   * field; "illisible" is said either way.
   */
  preview?: boolean
}

/**
 * A price field that says what it understood.
 *
 * Under the box, live: "= 10,500 DT" once the typing reads as money, and
 * "Montant illisible" when it does not — at the moment of typing, rather than
 * as a refusal at Save after the owner has moved on. Reading is parseMoney's,
 * so both "," and "." are accepted exactly as everywhere else.
 *
 * The whole amount is selected on focus, so retyping a price never means
 * clearing the old one first.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onChange, preview = true, onFocus, ...rest },
  ref,
) {
  const { t } = useTranslation()
  // Redraw when the owner flips dinars/millimes in the settings.
  useSyncExternalStore(subscribeMoneyMode, getMoneyMode)

  const typed = value.trim()
  const parsed = typed === '' ? null : parseMoney(typed)
  const formatted = parsed === null ? '' : formatMoney(parsed)
  // Not repeated when the box already says exactly that.
  const echo = parsed !== null && formatted !== typed

  return (
    <>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        placeholder={moneyPlaceholder()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          const el = e.currentTarget
          // After the click has placed its caret, or the click undoes it.
          requestAnimationFrame(() => {
            if (document.activeElement === el) el.select()
          })
          onFocus?.(e)
        }}
        {...rest}
      />
      {typed !== '' && parsed === null && (
        <Text fontSize="sm" color="red.fg" mt={1} role="alert">
          {t('smart.moneyUnreadable')}
        </Text>
      )}
      {preview && echo && parsed !== null && (
        <Text fontSize="sm" color="fg.muted" mt={1}>
          = {formatMoney(parsed, { symbol: t(moneySymbolKey()) })}
        </Text>
      )}
    </>
  )
})
