import { useTranslation } from 'react-i18next'
import { Alert, Button, Flex, Text } from '@chakra-ui/react'
import type { Similar } from '@/lib/similar'

interface Named {
  id: string
  name: string
  phone?: string
}

/**
 * Under a name field: the existing records this one may be a copy of.
 *
 * A warning, never a block — two clients can really share a name. Each match
 * can be opened instead of creating the copy when the form knows how.
 */
export function SimilarRecords<T extends Named>({
  matches,
  onPick,
}: {
  matches: Similar<T>[]
  onPick?: (item: T) => void
}) {
  const { t } = useTranslation()
  if (matches.length === 0) return null
  const dup = matches.some((m) => m.duplicate)
  return (
    <Alert.Root status={dup ? 'warning' : 'info'} variant="subtle" size="sm">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{dup ? t('smart.duplicateWarn') : t('smart.similarExisting')}</Alert.Title>
        <Flex gap={2} wrap="wrap" mt={2}>
          {matches.map(({ item, duplicate }) =>
            onPick ? (
              <Button
                key={item.id}
                size="sm"
                variant={duplicate ? 'solid' : 'outline'}
                colorPalette={duplicate ? 'orange' : 'gray'}
                // Keeps the cursor in the name field: its blur may save the
                // typed name as new, which is what this button is replacing.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(item)}
                title={t('smart.openExisting')}
              >
                {item.name}
                {item.phone ? ` · ${item.phone}` : ''}
              </Button>
            ) : (
              <Text key={item.id} fontSize="sm" fontWeight={duplicate ? 'bold' : undefined}>
                {item.name}
                {item.phone ? ` · ${item.phone}` : ''}
              </Text>
            ),
          )}
        </Flex>
      </Alert.Content>
    </Alert.Root>
  )
}
