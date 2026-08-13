import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Flex, HStack, Text } from '@chakra-ui/react'
import { Cloud, CloudOff, RefreshCw, UploadCloud } from 'lucide-react'
import { syncStore } from '@/lib/syncStatus'
import { updateStore, applyUpdate } from '@/lib/serviceWorker'

/** How long "everything is saved" stays up after the queue empties. */
const SAVED_MS = 4000

/**
 * Whether the shop has a line, and whether anything is still on its way up.
 *
 * The owner sells through a connection drop without noticing — which is the
 * point — so the one thing he must never have to guess is whether his tickets
 * actually left the building.
 */
export function SyncStatus() {
  const { t } = useTranslation()
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot, syncStore.getSnapshot)
  const [, forceTick] = useState(0)

  // "Saved" fades on its own; nothing else changes at that moment, so the
  // component has to be nudged to re-render when the window closes.
  useEffect(() => {
    if (!sync.syncedAt) return
    const id = setTimeout(() => forceTick((n) => n + 1), SAVED_MS)
    return () => clearTimeout(id)
  }, [sync.syncedAt])

  if (!sync.online) {
    return (
      <Badge
        colorPalette="orange"
        variant="solid"
        size="lg"
        px={3}
        py={2}
        borderRadius="lg"
        title={t('sync.offlineHint')}
      >
        <CloudOff size={18} />
        <Text as="span" ms={1}>
          {t('sync.offline')}
        </Text>
      </Badge>
    )
  }

  if (sync.pending > 0) {
    return (
      <Badge colorPalette="blue" variant="subtle" size="lg" px={3} py={2} borderRadius="lg">
        <UploadCloud size={18} />
        <Text as="span" ms={1} display={{ base: 'none', md: 'inline' }}>
          {t('sync.sending')}
        </Text>
      </Badge>
    )
  }

  const justSaved = sync.syncedAt !== null && Date.now() - sync.syncedAt < SAVED_MS
  return (
    <Badge
      colorPalette={justSaved ? 'green' : 'gray'}
      variant="subtle"
      size="lg"
      px={3}
      py={2}
      borderRadius="lg"
      title={t('sync.online')}
    >
      <Cloud size={18} />
      <Text as="span" ms={1} display={{ base: 'none', md: 'inline' }}>
        {justSaved ? t('sync.saved') : t('sync.online')}
      </Text>
    </Badge>
  )
}

/**
 * A new build is installed and waiting. It is never applied mid-sale on its
 * own, so the owner is asked — and if he ignores it, it lands on the next
 * time the app is opened cold.
 */
export function UpdateBanner() {
  const { t } = useTranslation()
  const waiting = useSyncExternalStore(
    updateStore.subscribe,
    updateStore.getSnapshot,
    updateStore.getSnapshot,
  )
  if (!waiting) return null

  return (
    <Flex
      align="center"
      gap={3}
      wrap="wrap"
      px={{ base: 3, md: 6 }}
      py={2}
      bg="brand.subtle"
      color="brand.fg"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <HStack gap={2} minW={0} flex="1">
        <RefreshCw size={18} />
        <Text fontWeight="semibold" truncate>
          {t('sync.updateReady')}
        </Text>
      </HStack>
      <Button size="sm" colorPalette="brand" onClick={applyUpdate} flexShrink={0}>
        {t('sync.updateNow')}
      </Button>
    </Flex>
  )
}
