import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Group, IconButton, Input } from '@chakra-ui/react'
import type { InputProps } from '@chakra-ui/react'
import { Minus, Plus } from 'lucide-react'
import { parseQuantity } from '@/lib/money'

type Props = Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'> & {
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
}

/**
 * A count of units with − and + on either side, and the arrow keys doing the
 * same. A minus sign cannot be typed: no count in this app is negative, and
 * "-5" read as 5 by the parser would be the worse surprise.
 */
export const QuantityInput = forwardRef<HTMLInputElement, Props>(function QuantityInput(
  { value, onChange, min = 0, max, size = 'lg', disabled, onKeyDown, onFocus, ...rest },
  ref,
) {
  const { t } = useTranslation()
  const current = parseQuantity(value) ?? 0
  const clamp = (n: number) => Math.max(min, max === undefined ? n : Math.min(max, n))
  const step = (delta: number) => onChange(String(clamp(current + delta)))

  return (
    <Group attached w="full">
      <IconButton
        size={size}
        variant="outline"
        aria-label={t('common.decrease')}
        disabled={disabled || current <= min}
        onClick={() => step(-1)}
        tabIndex={-1}
      >
        <Minus size={18} />
      </IconButton>
      <Input
        ref={ref}
        size={size}
        inputMode="numeric"
        autoComplete="off"
        textAlign="center"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/-/g, ''))}
        onFocus={(e) => {
          const el = e.currentTarget
          requestAnimationFrame(() => {
            if (document.activeElement === el) el.select()
          })
          onFocus?.(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            step(1)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            step(-1)
          }
          onKeyDown?.(e)
        }}
        {...rest}
      />
      <IconButton
        size={size}
        variant="outline"
        aria-label={t('common.increase')}
        disabled={disabled || (max !== undefined && current >= max)}
        onClick={() => step(1)}
        tabIndex={-1}
      >
        <Plus size={18} />
      </IconButton>
    </Group>
  )
})
