import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  HStack,
  Portal,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Download, Upload, FileSpreadsheet, ShieldCheck, TriangleAlert } from 'lucide-react'
import dayjs from 'dayjs'
import {
  exportAll,
  downloadJson,
  downloadCsvFiles,
  restoreAll,
  isBackupFile,
  countDocs,
  summarise,
  readLastBackupAt,
  writeLastBackupAt,
  STALE_BACKUP_DAYS,
} from './backupService'
import type { BackupFile } from './backupService'

/** Firestore collection name → the words the owner uses for it. */
const COLLECTION_LABEL: Record<string, string> = {
  products: 'stock.title',
  packs: 'packs.title',
  categories: 'settings.categories',
  suppliers: 'supplier.title',
  customers: 'customer.title',
  credit_entries: 'credit.ledger',
  sales: 'sales.title',
  purchases: 'purchases.title',
  settings: 'settings.title',
}

/**
 * Download the whole shop to a file, or put a file back.
 *
 * Rendered both on its own page and as a tab inside the settings, because the
 * owner looks for it under "réglages" and never finds a separate menu entry.
 */
export function BackupPanel() {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [lastAt, setLastAt] = useState<number | null>(readLastBackupAt)
  /** A file that has been read and understood, waiting for a yes. */
  const [pending, setPending] = useState<BackupFile | null>(null)

  const staleDays = lastAt === null ? null : dayjs().diff(dayjs(lastAt), 'day')
  const isStale = lastAt === null || (staleDays ?? 0) >= STALE_BACKUP_DAYS

  const doExport = async (kind: 'json' | 'csv') => {
    setBusy(true)
    setStatus(null)
    try {
      const backup = await exportAll()
      if (kind === 'json') {
        downloadJson(backup, `librairie-sauvegarde-${dayjs().format('YYYY-MM-DD-HHmm')}.json`)
      } else {
        downloadCsvFiles(backup)
      }
      const now = Date.now()
      writeLastBackupAt(now)
      setLastAt(now)
      setStatus({
        kind: 'ok',
        text: `${t('backup.exported')} (${countDocs(backup)} ${t('backup.records')})`,
      })
    } catch (err) {
      setStatus({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again
    if (!file) return
    setStatus(null)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isBackupFile(parsed)) {
        setStatus({ kind: 'error', text: t('backup.invalidFile') })
        return
      }
      // Never restore straight off a click: the owner sees exactly what the
      // file holds first. A wrong file silently overwriting the shop is the
      // one mistake here that cannot be undone.
      setPending(parsed)
    } catch {
      setStatus({ kind: 'error', text: t('backup.invalidFile') })
    }
  }

  const confirmRestore = async () => {
    const backup = pending
    if (!backup) return
    setPending(null)
    setBusy(true)
    try {
      const written = await restoreAll(backup)
      setStatus({ kind: 'ok', text: t('backup.restored', { count: written }) })
    } catch (err) {
      setStatus({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const rows = pending ? summarise(pending) : []

  return (
    <Box>
      {status && (
        <Alert.Root status={status.kind === 'ok' ? 'success' : 'error'} mb={5}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{status.text}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {/* When was the shop last written to a file the owner actually holds? */}
      <Alert.Root status={isStale ? 'warning' : 'success'} mb={5}>
        <Alert.Indicator>
          {isStale ? <TriangleAlert size={20} /> : <ShieldCheck size={20} />}
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>
            {lastAt === null
              ? t('backup.neverBackedUp')
              : t('backup.lastBackup', { when: dayjs(lastAt).format('DD/MM/YYYY HH:mm') })}
          </Alert.Title>
          {isStale && (
            <Alert.Description>
              {t('backup.backupOld', { days: STALE_BACKUP_DAYS })}
            </Alert.Description>
          )}
        </Alert.Content>
      </Alert.Root>

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={5}>
        {/* -------------------------- Download -------------------------- */}
        <Card.Root>
          <Card.Body>
            <Flex align="center" gap={3} mb={2}>
              <Box color="green.solid">
                <Download size={22} />
              </Box>
              <Heading size="lg">{t('backup.exportTitle')}</Heading>
            </Flex>
            <Text color="fg.muted" mb={4}>
              {t('backup.exportDesc')}
            </Text>
            <Stack gap={3}>
              <Button
                h="3.75rem"
                fontSize="lg"
                colorPalette="brand"
                loading={busy}
                onClick={() => doExport('json')}
              >
                <Download size={20} />
                {t('backup.exportJson')}
              </Button>
              <Button size="lg" variant="outline" loading={busy} onClick={() => doExport('csv')}>
                <FileSpreadsheet size={20} />
                {t('backup.exportCsv')}
              </Button>
            </Stack>
            <Text color="fg.subtle" fontSize="sm" mt={3}>
              {t('backup.exportHint')}
            </Text>
          </Card.Body>
        </Card.Root>

        {/* -------------------------- Restore --------------------------- */}
        <Card.Root>
          <Card.Body>
            <Flex align="center" gap={3} mb={2}>
              <Box color="orange.solid">
                <Upload size={22} />
              </Box>
              <Heading size="lg">{t('backup.restoreTitle')}</Heading>
            </Flex>
            <Text color="fg.muted" mb={4}>
              {t('backup.restoreDesc')}
            </Text>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={onFile}
              style={{ display: 'none' }}
            />
            <Button
              h="3.75rem"
              fontSize="lg"
              w="full"
              variant="outline"
              colorPalette="orange"
              loading={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={20} />
              {t('backup.restoreButton')}
            </Button>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* ---------------- What is actually in that file? ---------------- */}
      <Dialog.Root
        lazyMount
        unmountOnExit
        scrollBehavior="inside"
        open={!!pending}
        onOpenChange={(e) => !e.open && setPending(null)}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxH="92dvh">
              <Dialog.Header>
                <Dialog.Title>{t('backup.reviewTitle')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body overflowY="auto">
                <Stack gap={4}>
                  {pending?.exportedAt && (
                    <Text color="fg.muted">
                      {t('backup.fileFrom', {
                        date: dayjs(pending.exportedAt).format('DD/MM/YYYY HH:mm'),
                      })}
                    </Text>
                  )}

                  <Stack gap={2}>
                    {rows.map((row) => (
                      <Flex key={row.name} justify="space-between" align="center" gap={3}>
                        <Text minW={0} truncate>
                          {COLLECTION_LABEL[row.name] ? t(COLLECTION_LABEL[row.name]) : row.name}
                        </Text>
                        <Badge colorPalette={row.count > 0 ? 'brand' : 'gray'} variant="subtle">
                          {row.count}
                        </Badge>
                      </Flex>
                    ))}
                  </Stack>

                  <Alert.Root status="warning">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{t('backup.restoreConfirm')}</Alert.Title>
                    </Alert.Content>
                  </Alert.Root>
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setPending(null)}>
                  {t('common.cancel')}
                </Button>
                <Button size="lg" colorPalette="orange" loading={busy} onClick={confirmRestore}>
                  <Upload size={18} />
                  {t('backup.restoreNow')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <HStack gap={2} mt={5} color="fg.subtle" fontSize="sm" wrap="wrap">
        <ShieldCheck size={16} />
        <Text>{t('backup.keepSafe')}</Text>
      </HStack>
    </Box>
  )
}
