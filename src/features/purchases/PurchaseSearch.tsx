import { useCallback, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Badge, Box, Button, Flex, HStack, Input, InputGroup, Text } from '@chakra-ui/react'
import { Plus, ScanLine } from 'lucide-react'
import { formatMoney, moneySymbolKey } from '@/lib/money'
import { beepError, beepOk, beepWarn } from '@/lib/beep'
import { searchProducts } from '@/features/pos/posSearch'
import { codeOf, loose, looksLikeCode, normalizeScannedCode } from '@/features/stock/barcode'
import { ScanWedge } from '@/features/stock/ScanWedge'
import type { Product } from '@/types/models'

/**
 * The article box of a purchase: scan or type, as at the till.
 *
 * It replaces the plain search box the purchase used to share with the
 * invoices screen, which had three faults on a delivery day: a scan on the
 * shop's AZERTY PC arrived as &é"'(… and matched nothing, a miss said nothing
 * at all, and an article the shop did not have yet could not be created
 * without closing the purchase — and losing every line typed so far.
 *
 * Shows the COST price and the stock, not the sale price: that is what a
 * delivery is checked against.
 */
export function PurchaseSearch({
  products,
  onPick,
  onCreate,
  scanEnabled,
  inputRef,
}: {
  products: Product[]
  onPick: (p: Product) => void
  /** The term that found nothing, to create the article on the spot. */
  onCreate: (term: string) => void
  /** False while something over the purchase owns the scanner, or a free-text field is in use. */
  scanEnabled: boolean
  inputRef: RefObject<HTMLInputElement | null>
}) {
  const { t } = useTranslation()
  const symbol = t(moneySymbolKey())
  const [q, setQ] = useState('')
  const [highlight, setHighlight] = useState(-1)
  /** The term that matched nothing, or that matched two articles. */
  const [missed, setMissed] = useState<{ term: string; ambiguous: boolean } | null>(null)

  const results = useMemo(() => searchProducts(products, q, 8), [products, q])
  useEffect(() => setHighlight(-1), [q])

  const pick = useCallback(
    (p: Product) => {
      setQ('')
      setMissed(null)
      beepOk()
      onPick(p)
    },
    [onPick],
  )

  /** Articles carrying exactly one of these codes, compared loosely. */
  const byCode = useCallback(
    (...terms: (string | null | undefined)[]) => {
      const wanted = new Set(terms.filter((v): v is string => !!v).map((v) => loose(v)))
      return products.filter((p) => {
        const code = loose(codeOf(p.barcode))
        return code !== '' && wanted.has(code)
      })
    },
    [products],
  )

  /** True when an article was picked. */
  const resolve = (term: string, physical: string | null = null): boolean => {
    const hits = byCode(term, normalizeScannedCode(term), physical)
    if (hits.length === 1) {
      pick(hits[0])
      return true
    }
    // A code the scanner read off AZERTY keys is shown as the digits it meant.
    const shown = physical && !looksLikeCode(normalizeScannedCode(term)) ? physical : normalizeScannedCode(term)
    setQ(shown)
    if (hits.length > 1) {
      // Two articles share this printed code: the list below IS the question.
      setMissed({ term: shown, ambiguous: true })
      beepWarn()
      return false
    }
    setMissed({ term: shown, ambiguous: false })
    beepError()
    return false
  }

  const onScan = (code: string, physical: string | null) => {
    // A pick moves the cursor to the new line's quantity (NewPurchase); a
    // miss keeps it here, next to the "créer" button.
    if (!resolve(code, physical)) inputRef.current?.focus()
  }

  const commit = () => {
    const term = q.trim()
    if (term === '') return
    if (highlight >= 0 && results[highlight]) {
      pick(results[highlight])
      return
    }
    const hits = byCode(term, normalizeScannedCode(term))
    if (hits.length === 1) {
      pick(hits[0])
      return
    }
    if (hits.length === 0 && results.length > 0 && !looksLikeCode(normalizeScannedCode(term))) {
      pick(results[0])
      return
    }
    void resolve(term)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      commit()
      return
    }
    // Escape empties a filled box and stops there. Let through, it reached
    // the dialog and threw the whole delivery away.
    if (e.key === 'Escape' && q !== '') {
      e.preventDefault()
      e.stopPropagation()
      setQ('')
      setMissed(null)
      return
    }
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, -1))
    }
  }

  return (
    <Box>
      {scanEnabled && (
        <ScanWedge
          targetRef={inputRef}
          onScan={onScan}
          onBurstStart={() => setMissed(null)}
        />
      )}
      <InputGroup
        startElement={
          <Box color="fg.muted" pointerEvents="none">
            <ScanLine size={22} />
          </Box>
        }
      >
        <Input
          ref={inputRef}
          size="lg"
          autoFocus
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setMissed(null)
          }}
          onKeyDown={onKeyDown}
          placeholder={t('purchases.searchProduct')}
          aria-label={t('purchases.searchProduct')}
        />
      </InputGroup>

      {missed && (
        <Alert.Root status="warning" mt={2} size="sm">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {missed.ambiguous ? t('pos.sameCode') : t('pos.notFound', { term: missed.term })}
            </Alert.Title>
          </Alert.Content>
          {!missed.ambiguous && (
            <Button
              size="sm"
              colorPalette="brand"
              flexShrink={0}
              onClick={() => {
                onCreate(missed.term)
                setMissed(null)
                setQ('')
              }}
            >
              <Plus size={16} />
              {t('backFix.createArticle')}
            </Button>
          )}
        </Alert.Root>
      )}

      {results.length > 0 && (
        <Box
          role="listbox"
          mt={1}
          maxH="16rem"
          overflowY="auto"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          bg="bg.panel"
          boxShadow="sm"
          // Keeps the caret in the box, so a scan still lands there.
          onPointerDown={(e) => e.preventDefault()}
        >
          {results.map((p, i) => (
            <Flex
              key={p.id}
              role="option"
              aria-selected={i === highlight}
              align="center"
              gap={3}
              px={4}
              py={2}
              cursor="pointer"
              borderBottomWidth={i === results.length - 1 ? 0 : '1px'}
              borderColor="border"
              bg={i === highlight ? 'brand.subtle' : undefined}
              _hover={{ bg: 'brand.subtle' }}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(p)}
            >
              <Box minW={0} flex="1">
                <Text fontWeight="medium" truncate>
                  {p.name}
                </Text>
                <HStack gap={2} color="fg.muted" fontSize="sm">
                  {p.barcode && <Text as="span">{p.barcode}</Text>}
                  <Badge size="sm" variant="subtle" colorPalette={p.quantity <= 0 ? 'red' : 'gray'}>
                    {p.quantity}
                  </Badge>
                </HStack>
              </Box>
              <Text flexShrink={0} fontSize="sm" color="fg.muted" whiteSpace="nowrap">
                {formatMoney(p.costPrice, { symbol })}
              </Text>
            </Flex>
          ))}
        </Box>
      )}
    </Box>
  )
}
