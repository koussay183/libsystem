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
  isPartialBackup,
  partialCollections,
  readLastBackupAt,
  readLastBackupPartial,
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

/** Alert.Root speaks its own vocabulary; the three outcomes map onto it here. */
const ALERT_STATUS = { ok: 'success', warning: 'warning', error: 'error' } as const

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
  const [status, setStatus] = useState<{
    kind: keyof typeof ALERT_STATUS
    text: string
    /** The second line: why the outcome is not simply "done". */
    note?: string
  } | null>(null)
  const [lastAt, setLastAt] = useState<number | null>(readLastBackupAt)
  /** Whether that last backup was the offline, possibly-incomplete kind. */
  const [lastPartial, setLastPartial] = useState<boolean>(readLastBackupPartial)
  /** A file that has been read and understood, waiting for a yes. */
  const [pending, setPending] = useState<BackupFile | null>(null)

  const staleDays = lastAt === null ? null : dayjs().diff(dayjs(lastAt), 'day')
  const isStale = lastAt === null || (staleDays ?? 0) >= STALE_BACKUP_DAYS
  const wasPartial = lastAt !== null && lastPartial

  /** Collection names in the words the owner uses, for a warning sentence. */
  const nameList = (names: string[]) =>
    names.map((n) => (COLLECTION_LABEL[n] ? t(COLLECTION_LABEL[n]) : n)).join(', ')

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
      // A cache-sourced export is still handed over — see exportAll — but it is
      // reported as a warning, not a success, and the collections that could
      // not be confirmed are named. The one thing this screen must never do is
      // let the owner walk away believing an incomplete file is his whole shop.
      const partial = isPartialBackup(backup)
      const now = Date.now()
      writeLastBackupAt(now, partial)
      setLastAt(now)
      setLastPartial(partial)
      setStatus({
        kind: partial ? 'warning' : 'ok',
        text: `${t(partial ? 'backup.exportedPartial' : 'backup.exported')} (${countDocs(
          backup,
        )} ${t('backup.records')})`,
        note: partial
          ? t('backup.partialDetail', { list: nameList(partialCollections(backup)) })
          : undefined,
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
      // restoreAll no longer waits for the server, so "restauré" here means
      // "written to this computer and queued" — durable in IndexedDB and
      // replayed in order on reconnect. The note says exactly that instead of
      // implying an upload nobody has watched finish.
      setStatus({
        kind: 'ok',
        text: t('backup.restored', { count: written }),
        note: t('backup.restoredLocalNote'),
      })
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
        <Alert.Root status={ALERT_STATUS[status.kind]} mb={5}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{status.text}</Alert.Title>
            {status.note && <Alert.Description>{status.note}</Alert.Description>}
          </Alert.Content>
        </Alert.Root>
      )}

      {/* When was the shop last written to a file the owner actually holds —
          and was that file a complete one? A date under a green shield reads as
          "you are covered", so a partial export has to take the shield away. */}
      <Alert.Root status={isStale || wasPartial ? 'warning' : 'success'} mb={5}>
        <Alert.Indicator>
          {isStale || wasPartial ? <TriangleAlert size={20} /> : <ShieldCheck size={20} />}
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>
            {lastAt === null
              ? t('backup.neverBackedUp')
              : t('backup.lastBackup', { when: dayjs(lastAt).format('DD/MM/YYYY HH:mm') })}
          </Alert.Title>
          {(isStale || wasPartial) && (
            <Alert.Description>
              <Stack gap={1}>
                {isStale && <Text>{t('backup.backupOld', { days: STALE_BACKUP_DAYS })}</Text>}
                {wasPartial && <Text>{t('backup.lastBackupPartial')}</Text>}
              </Stack>
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

                  {/* The file says so itself. Shown before the counts, because
                      the counts are what look reassuring, and on a partial file
                      a low count is the symptom rather than the truth. */}
                  {pending && isPartialBackup(pending) && (
                    <Alert.Root status="warning">
                      <Alert.Indicator>
                        <TriangleAlert size={20} />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>{t('backup.filePartial')}</Alert.Title>
                        <Alert.Description>
                          {t('backup.partialDetail', {
                            list: nameList(partialCollections(pending)),
                          })}
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  <Stack gap={2}>
                    {rows.map((row) => (
                      <Flex key={row.name} justify="space-between" align="center" gap={3}>
                        <Text minW={0} truncate>
                          {COLLECTION_LABEL[row.name] ? t(COLLECTION_LABEL[row.name]) : row.name}
                        </Text>
                        <Badge
                          colorPalette={
                            row.fromCache ? 'orange' : row.count > 0 ? 'brand' : 'gray'
                          }
                          variant="subtle"
                          title={row.fromCache ? t('backup.unverified') : undefined}
                        >
                          {row.count}
                          {row.fromCache && ' ?'}
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
