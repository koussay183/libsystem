import { useEffect, useRef } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, Input, InputGroup, Kbd, Text } from '@chakra-ui/react'
import type { InputProps } from '@chakra-ui/react'
import { Search, X } from 'lucide-react'

type Props = Omit<InputProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  /** Rows matching right now, shown at the end of the box while a term is typed. */
  count?: number
  /**
   * "/" and Ctrl+K bring the cursor here from anywhere on the page. One box
   * per screen should have it; never on the till, whose keys belong to the
   * scanner.
   */
  shortcut?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
}

/** True when a keystroke is going into something the user is typing in. */
function typingIn(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  return (
    el.isContentEditable ||
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT'
  )
}

/**
 * The search box every list uses: magnifier, a × that empties it, Escape to
 * empty it, and how many rows the term finds.
 *
 * Enter is never consumed here: on the stock screen a USB scanner "types" a
 * barcode into this box and presses Enter, and the page decides what that
 * means.
 */
export function SearchInput({
  value,
  onChange,
  count,
  shortcut = false,
  inputRef,
  onKeyDown,
  size = 'lg',
  ...rest
}: Props) {
  const { t } = useTranslation()
  const ownRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? ownRef

  useEffect(() => {
    if (!shortcut) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      const isCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'
      const isSlash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey
      if (!isCtrlK && !isSlash) return
      // Never pull the cursor out of an open dialog or a field being typed in.
      const target = e.target as Element | null
      if (target?.closest?.('[role="dialog"],[role="alertdialog"]')) return
      if (isSlash && typingIn(e.target)) return
      const input = ref.current
      if (!input) return
      e.preventDefault()
      input.focus()
      input.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcut, ref])

  const clear = () => {
    onChange('')
    ref.current?.focus()
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Escape empties a filled box and stays there; an empty box lets Escape
    // through, so it still closes a dialog the box sits in.
    if (e.key === 'Escape' && value !== '') {
      e.preventDefault()
      e.stopPropagation()
      onChange('')
    }
    onKeyDown?.(e)
  }

  const filled = value !== ''

  return (
    <InputGroup
      startElement={
        <Box color="fg.muted">
          <Search size={20} />
        </Box>
      }
      endElement={
        filled ? (
          <Box display="flex" alignItems="center" gap={1}>
            {count !== undefined && (
              <Text
                fontSize="sm"
                color={count === 0 ? 'red.fg' : 'fg.muted'}
                whiteSpace="nowrap"
                aria-live="polite"
              >
                {t('smart.resultCount', { count })}
              </Text>
            )}
            <IconButton
              aria-label={t('smart.clearSearch')}
              title={t('smart.clearSearch')}
              size="sm"
              variant="ghost"
              onClick={clear}
            >
              <X size={18} />
            </IconButton>
          </Box>
        ) : shortcut ? (
          <Kbd size="sm" display={{ base: 'none', md: 'inline-flex' }} title={t('smart.searchShortcut')}>
            /
          </Kbd>
        ) : undefined
      }
    >
      <Input
        ref={ref}
        size={size}
        // Not type="search": Chrome would add its own × next to ours.
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        // Room for the count and the ×, which sit over the end of the box.
        pe={filled && count !== undefined ? '9.5rem' : undefined}
        {...rest}
      />
    </InputGroup>
  )
}
