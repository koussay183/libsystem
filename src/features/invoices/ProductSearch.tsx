import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Input, InputGroup, Text } from '@chakra-ui/react'
import { Search } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { useProducts } from '@/features/stock/useProducts'
import type { Product } from '@/types/models'

/**
 * A search box that finds a product by name or barcode and calls onPick.
 * Scanner-friendly: pressing Enter picks the exact barcode match (or the top
 * result) and clears the box, ready for the next scan.
 */
export function ProductSearch({
  onPick,
  placeholder,
}: {
  onPick: (p: Product) => void
  placeholder: string
}) {
  const { t } = useTranslation()
  const { products } = useProducts()
  const [q, setQ] = useState('')

  const symbol = t('money.symbol')
  const query = q.trim().toLowerCase()
  const results =
    query === ''
      ? []
      : products
          .filter(
            (p) =>
              p.name.toLowerCase().includes(query) ||
              (p.barcode ?? '').toLowerCase().includes(query),
          )
          .slice(0, 8)

  const pick = (p: Product) => {
    onPick(p)
    setQ('')
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const exact = products.find((p) => p.barcode === q.trim())
    const chosen = exact ?? results[0]
    if (chosen) pick(chosen)
  }

  return (
    <form onSubmit={submit}>
      <InputGroup
        startElement={
          <Box color="gray.400" pointerEvents="none">
            <Search size={22} />
          </Box>
        }
      >
        <Input
          autoFocus
          size="lg"
          value={q}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
          placeholder={placeholder}
        />
      </InputGroup>

      {results.length > 0 && (
        <Box
          as="ul"
          listStyleType="none"
          mt={1}
          maxH="14rem"
          overflowY="auto"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          bg="bg.panel"
          boxShadow="sm"
        >
          {results.map((p) => (
            <Box as="li" key={p.id}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => pick(p)}
                w="full"
                h="auto"
                justifyContent="space-between"
                gap={3}
                px={4}
                py={3}
                borderRadius="none"
                fontWeight="normal"
              >
                <Text minW="0" truncate fontWeight="medium">
                  {p.name}
                </Text>
                <Text flexShrink={0} fontSize="sm" color="fg.muted" fontWeight="normal">
                  {formatMoney(p.salePrice, { symbol })} · {p.quantity}
                </Text>
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </form>
  )
}
