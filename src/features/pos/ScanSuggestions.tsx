import { Badge, Box, Flex, HStack, Text } from '@chakra-ui/react'
import { formatMoney } from '@/lib/money'
import type { Product } from '@/types/models'

/**
 * The list that drops under the scan field while the cashier TYPES.
 *
 * A scanned code never opens it — the article is already on the ticket before
 * a list could paint. This is for the other half of the job: "the blue Bic
 * ones", where the cashier knows the article but not its code.
 *
 * Built by hand rather than with Chakra's Combobox because that component
 * insists on owning Enter, the arrow keys and Escape on its input, and the
 * till's scanner wedge has a prior claim on all three.
 */
export function ScanSuggestions({
  open,
  items,
  highlight,
  symbol,
  onPick,
  onHighlight,
}: {
  open: boolean
  items: Product[]
  /** -1 until the cashier arrows down, so Enter keeps meaning "search". */
  highlight: number
  term: string
  symbol: string
  onPick: (p: Product) => void
  onHighlight: (index: number) => void
}) {
  if (!open || items.length === 0) return null

  return (
    <Box
      id="pos-suggestions"
      role="listbox"
      position="absolute"
      insetStart={0}
      insetEnd={0}
      top="calc(100% + 4px)"
      zIndex="docked"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      borderRadius="l3"
      boxShadow="lg"
      overflow="hidden"
      // Keeps the caret in the scan field: the wedge reads document.activeElement
      // to decide where a burst should land.
      onPointerDown={(e) => e.preventDefault()}
    >
      <Box maxH="min(24rem, calc(100dvh - 16rem))" overflowY="auto">
        {items.map((p, i) => (
          <Flex
            key={p.id}
            role="option"
            aria-selected={i === highlight}
            align="center"
            gap={3}
            px={3}
            py={2}
            cursor="pointer"
            borderBottomWidth={i === items.length - 1 ? 0 : '1px'}
            borderColor="border"
            bg={i === highlight ? 'brand.subtle' : undefined}
            _hover={{ bg: 'brand.subtle' }}
            onMouseEnter={() => onHighlight(i)}
            onClick={() => onPick(p)}
          >
            <Box minW={0} flex="1">
              <Text fontSize="lg" fontWeight="semibold" lineClamp={1}>
                {p.name}
              </Text>
              <HStack gap={2} color="fg.muted" fontSize="sm" wrap="wrap">
                {p.barcode && <Text as="span">{p.barcode}</Text>}
                <Badge
                  size="sm"
                  variant="subtle"
                  colorPalette={p.quantity <= 0 ? 'red' : 'gray'}
                >
                  {p.quantity}
                </Badge>
              </HStack>
            </Box>
            <Text fontSize="lg" fontWeight="bold" color="brand.fg" whiteSpace="nowrap">
              {formatMoney(p.salePrice, { symbol })}
            </Text>
          </Flex>
        ))}
      </Box>
    </Box>
  )
}
