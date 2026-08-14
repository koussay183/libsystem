import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Badge, Box, Flex, HStack, Input, InputGroup, Text } from '@chakra-ui/react'
import { CheckCircle2, ScanLine } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { beepOk, beepWarn, beepError } from '@/lib/beep'
import { useBarcodeScanner } from '@/features/pos/useBarcodeScanner'
import { searchProducts } from '@/features/pos/posSearch'
import { codeOf, loose } from '@/features/stock/barcode'
import type { Product } from '@/types/models'

/**
 * A search box that behaves like the till: scan an article and it is picked,
 * type a few letters and a list drops under the field.
 *
 * Anywhere the owner builds a list of articles — a pack, tomorrow a purchase —
 * he is standing at the counter with the scanner in his hand. Making him look
 * the article up by name when the code is printed on the box in front of him
 * is the difference between a pack built in a minute and one built in ten.
 *
 * Deliberately narrower than the till: nothing here can create a line that
 * costs money, so an unknown code just says so and waits.
 */
export function ProductScanField({
  products,
  onPick,
  placeholder,
  autoFocus = false,
}: {
  products: Product[]
  onPick: (p: Product) => void
  placeholder: string
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const [notice, setNotice] = useState('')
  /** The article that just went in — the same reassurance the till gives. */
  const [added, setAdded] = useState<Product | null>(null)

  const symbol = t('money.symbol')

  const results = searchProducts(products, q, 8)

  useEffect(() => setHighlight(-1), [q])

  useEffect(() => {
    if (!autoFocus) return
    // A tick late on purpose: a dialog moves the focus itself as it opens, and
    // whoever asks last wins.
    const id = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [autoFocus])

  useEffect(() => {
    if (!added) return
    const id = setTimeout(() => setAdded(null), 4000)
    return () => clearTimeout(id)
  }, [added])

  const pick = useCallback(
    (p: Product) => {
      setQ('')
      setHighlight(-1)
      setNotice('')
      setAdded(p)
      beepOk()
      onPick(p)
      inputRef.current?.focus()
    },
    [onPick],
  )

  /** Articles carrying exactly this code, in either spelling. */
  const byCode = useCallback(
    (term: string, physical?: string | null) => {
      const wanted = new Set(
        [term, loose(term), physical, physical && loose(physical)].filter(
          (v): v is string => !!v,
        ),
      )
      return products.filter((p) => {
        const code = codeOf(p.barcode)
        return code !== '' && (wanted.has(code) || wanted.has(loose(code)))
      })
    },
    [products],
  )

  /** A finished burst off the hand scanner. */
  const onScan = useCallback(
    (code: string, physical: string | null) => {
      const hits = byCode(code, physical)
      if (hits.length === 1) {
        pick(hits[0])
        return
      }
      if (hits.length > 1) {
        // Two articles share this printed code. Guessing would put the wrong
        // one in the pack; the list below IS the question.
        setQ(code)
        setNotice(t('pos.sameCode'))
        beepWarn()
        inputRef.current?.focus()
        return
      }
      // Not a code this shop knows. Leave it in the field: it may still be the
      // beginning of a name, and the list below answers that too.
      setQ(code)
      setNotice(t('pos.notFound', { term: code }))
      beepError()
      inputRef.current?.focus()
    },
    [byCode, pick, t],
  )

  const scanner = useBarcodeScanner({
    targetRef: inputRef,
    onScan,
    onBurstStart: () => setNotice(''),
  })

  const commit = () => {
    scanner.reset()
    const term = q.trim()
    if (term === '') return
    if (highlight >= 0 && results[highlight]) {
      pick(results[highlight])
      return
    }
    const hits = byCode(term)
    if (hits.length === 1) {
      pick(hits[0])
      return
    }
    // An ambiguous code leaves the list up rather than picking one of the two.
    if (hits.length > 1) {
      setNotice(t('pos.sameCode'))
      return
    }
    if (results[0]) {
      pick(results[0])
      return
    }
    setNotice(t('pos.notFound', { term }))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Never let it reach the surrounding form: Enter here means "add this
      // article", not "save the pack".
      e.preventDefault()
      e.stopPropagation()
      commit()
      return
    }
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, -1))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setQ('')
    }
  }

  return (
    <Box>
      <InputGroup
        startElement={
          <Box color="cyan.fg" pointerEvents="none">
            <ScanLine size={22} />
          </Box>
        }
      >
        <Input
          ref={inputRef}
          size="xl"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setNotice('')
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
      </InputGroup>

      {notice !== '' && (
        <Alert.Root status="warning" mt={2} size="sm">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{notice}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {added && results.length === 0 && (
        <Flex
          mt={2}
          align="center"
          gap={2}
          px={3}
          py={2}
          borderWidth="1px"
          borderColor="green.emphasized"
          bg="green.subtle"
          borderRadius="lg"
          color="green.fg"
        >
          <CheckCircle2 size={20} />
          <Text fontWeight="semibold" lineClamp={1}>
            {added.name}
          </Text>
          <Text ms="auto" flexShrink={0} fontSize="sm">
            {t('packs.addedToPack')}
          </Text>
        </Flex>
      )}

      {results.length > 0 && (
        <Box
          role="listbox"
          mt={2}
          borderWidth="1px"
          borderColor="border"
          borderRadius="l3"
          bg="bg.panel"
          boxShadow="sm"
          overflow="hidden"
          maxH="16rem"
          overflowY="auto"
          // Keeps the caret in the field, so the wedge still knows where a
          // burst should land while the mouse is over the list.
          onPointerDown={(e) => e.preventDefault()}
        >
          {results.map((p, i) => (
            <Flex
              key={p.id}
              role="option"
              aria-selected={i === highlight}
              align="center"
              gap={3}
              px={3}
              py={2}
              cursor="pointer"
              borderBottomWidth={i === results.length - 1 ? 0 : '1px'}
              borderColor="border"
              bg={i === highlight ? 'cyan.subtle' : undefined}
              _hover={{ bg: 'cyan.subtle' }}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(p)}
            >
              <Box minW={0} flex="1">
                <Text fontWeight="semibold" lineClamp={1}>
                  {p.name}
                </Text>
                <HStack gap={2} color="fg.muted" fontSize="sm" wrap="wrap">
                  {p.barcode && <Text as="span">{p.barcode}</Text>}
                  <Badge size="sm" variant="subtle" colorPalette={p.quantity <= 0 ? 'red' : 'gray'}>
                    {p.quantity}
                  </Badge>
                </HStack>
              </Box>
              <Text fontWeight="bold" color="brand.fg" whiteSpace="nowrap">
                {formatMoney(p.salePrice, { symbol })}
              </Text>
            </Flex>
          ))}
        </Box>
      )}
    </Box>
  )
}
