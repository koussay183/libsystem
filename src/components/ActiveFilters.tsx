import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Flex, Text } from '@chakra-ui/react'
import { RotateCcw, SearchX, X } from 'lucide-react'

export interface ActiveFilter {
  key: string
  /** What the chip says: "Catégorie : Cahiers". */
  label: string
  onRemove: () => void
}

/**
 * One chip per filter that is narrowing the list, each with its own ×, and
 * "Tout afficher" to drop them all.
 *
 * A select set three screens ago is easy to forget; a list that is quietly
 * short is how "my articles disappeared" gets reported. The chips say, in
 * words, why the list is not everything.
 */
export function ActiveFilters({
  filters,
  onReset,
}: {
  filters: ActiveFilter[]
  onReset: () => void
}) {
  const { t } = useTranslation()
  if (filters.length === 0) return null
  return (
    <Flex gap={2} wrap="wrap" align="center" mb={4} aria-label={t('smart.activeFilters')}>
      {filters.map((f) => (
        <Button
          key={f.key}
          size="sm"
          variant="subtle"
          colorPalette="brand"
          borderRadius="full"
          onClick={f.onRemove}
          title={t('smart.removeFilter')}
        >
          {f.label}
          <X size={14} />
        </Button>
      ))}
      <Button size="sm" variant="ghost" onClick={onReset}>
        <RotateCcw size={14} />
        {t('smart.showAll')}
      </Button>
    </Flex>
  )
}

/**
 * "Nothing shows" that says why, and offers the way back.
 *
 * A bare "Aucun résultat" under a forgotten filter reads as data loss; naming
 * the search term and the filters turns it into something the owner can fix
 * with one press.
 */
export function NoResults({
  search,
  filtered,
  onReset,
  children,
}: {
  /** The term typed, if any. */
  search?: string
  /** True when a filter other than the search is narrowing the list. */
  filtered?: boolean
  onReset?: () => void
  /** Extra actions, e.g. "create this article". */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const term = (search ?? '').trim()
  return (
    <Card.Root>
      <Card.Body>
        <Flex gap={3} align="flex-start" wrap="wrap">
          <Flex color="fg.muted" pt={1}>
            <SearchX size={22} />
          </Flex>
          <Flex direction="column" gap={1} flex="1" minW="12rem">
            <Text fontWeight="semibold">
              {term !== '' ? t('smart.noMatchFor', { term }) : t('stock.noResults')}
            </Text>
            {filtered && (
              <Text color="fg.muted" fontSize="sm">
                {t('smart.noMatchFiltered')}
              </Text>
            )}
          </Flex>
          <Flex gap={2} wrap="wrap">
            {children}
            {onReset && (term !== '' || filtered) && (
              <Button size="lg" variant="outline" onClick={onReset}>
                <RotateCcw size={18} />
                {t('smart.showAll')}
              </Button>
            )}
          </Flex>
        </Flex>
      </Card.Body>
    </Card.Root>
  )
}
