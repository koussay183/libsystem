import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  BookUser,
  Download,
  FolderCheck,
  FolderOpen,
  History,
  RefreshCw,
  RotateCcw,
  Timer,
} from 'lucide-react'
import dayjs from 'dayjs'
import { formatMoney, moneySymbolKey } from '@/lib/money'
import {
  autoBackupStore,
  chooseFolder,
  folderSupported,
  forgetFolder,
  reconnectFolder,
  refreshAutoBackup,
  runAutoBackup,
  setAutoBackupEnabled,
} from './autoBackup'
import { readSnapshot } from './vault'
import { downloadBlob } from './backupService'
import type { BackupFile } from './backupService'
import { carnetCsv } from './carnet'

const when = (ms: number) => {
  const d = dayjs(ms)
  return d.isSame(dayjs(), 'day') ? d.format('HH:mm') : d.format('DD/MM/YYYY HH:mm')
}

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1048576).toFixed(1)} Mo`)

/**
 * The automatic side of the backup: what ran by itself, where the copies are,
 * whether the carnet de crédit checks out, and the restore points kept here.
 */
export function AutoBackupCard({ onRestore }: { onRestore: (backup: BackupFile) => void }) {
  const { t } = useTranslation()
  const s = useSyncExternalStore(autoBackupStore.subscribe, autoBackupStore.getSnapshot)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void refreshAutoBackup()
  }, [])

  const newest = s.points[0]
  const carnet = newest?.carnet
  const money = (m: number) => formatMoney(m, { symbol: t(moneySymbolKey()) })

  const open = async (key: string) => {
    setError(null)
    try {
      const b = await readSnapshot(key)
      if (!b) throw new Error()
      return b
    } catch {
      setError(t('autoBackup.unreadable'))
      return null
    }
  }

  const downloadCarnet = async () => {
    if (!newest) return
    const b = await open(newest.key)
    if (b) downloadBlob(new Blob([carnetCsv(b)], { type: 'text/csv;charset=utf-8' }), `carnet-credit-${dayjs(newest.at).format('YYYY-MM-DD')}.csv`)
  }

  const downloadPoint = async (key: string, at: number) => {
    const b = await open(key)
    if (b) downloadBlob(new Blob([JSON.stringify(b)], { type: 'application/json' }), `librairie-sauvegarde-${dayjs(at).format('YYYY-MM-DD-HHmm')}.json`)
  }

  return (
    <Card.Root mb={5}>
      <Card.Body>
        <Stack gap={4}>
          {/* ------------------------- status ------------------------- */}
          <Flex align="center" gap={3} wrap="wrap">
            <Box color="green.solid">
              <Timer size={22} />
            </Box>
            <Heading size="lg" flex="1" minW="12rem">
              {t('autoBackup.title')}
            </Heading>
            <Badge colorPalette={s.enabled ? 'green' : 'gray'} variant="subtle">
              {s.enabled ? t('autoBackup.on') : t('autoBackup.off')}
            </Badge>
          </Flex>

          <Flex align="center" justify="space-between" gap={3} wrap="wrap">
            <Text color="fg.muted">
              {s.running
                ? t('autoBackup.running')
                : s.lastAt
                  ? t('autoBackup.lastDevice', { when: when(s.lastAt) })
                  : t('autoBackup.noneYet')}
            </Text>
            <Flex gap={2}>
              <Button
                size="sm"
                variant="outline"
                loading={s.running}
                onClick={() => void runAutoBackup({ force: true, interactive: true })}
              >
                <RefreshCw size={16} />
                {t('autoBackup.runNow')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAutoBackupEnabled(!s.enabled)}>
                {s.enabled ? t('autoBackup.disable') : t('autoBackup.enable')}
              </Button>
            </Flex>
          </Flex>

          {s.lastError && !s.running && (
            <Alert.Root status="warning" size="sm">
              <Alert.Indicator />
              <Alert.Title>
                {s.lastError === 'offline' ? t('autoBackup.offline') : t('autoBackup.failed', { error: s.lastError })}
              </Alert.Title>
            </Alert.Root>
          )}
          {error && (
            <Alert.Root status="error" size="sm">
              <Alert.Indicator />
              <Alert.Title>{error}</Alert.Title>
            </Alert.Root>
          )}

          <Separator />

          {/* ------------------------- folder ------------------------- */}
          <Stack gap={2}>
            <Flex align="center" gap={2}>
              <FolderOpen size={18} />
              <Text fontWeight="semibold">{t('autoBackup.folderTitle')}</Text>
            </Flex>
            {!folderSupported() ? (
              <Text color="fg.muted" fontSize="sm">
                {t('autoBackup.folderUnsupported')}
              </Text>
            ) : !s.folder ? (
              <>
                <Text color="fg.muted" fontSize="sm">
                  {t('autoBackup.folderDesc')}
                </Text>
                <Box>
                  <Button colorPalette="brand" onClick={() => void chooseFolder()}>
                    <FolderOpen size={18} />
                    {t('autoBackup.folderPick')}
                  </Button>
                </Box>
              </>
            ) : s.folder.permission === 'granted' ? (
              <Flex align="center" justify="space-between" gap={3} wrap="wrap">
                <Flex align="center" gap={2} color="green.fg">
                  <FolderCheck size={18} />
                  <Text>
                    {t('autoBackup.folderOk', { name: s.folder.name })}
                    {s.folderLastAt && (
                      <Text as="span" color="fg.muted">
                        {' · '}
                        {t('autoBackup.folderLast', { when: when(s.folderLastAt) })}
                      </Text>
                    )}
                  </Text>
                </Flex>
                <Flex gap={2}>
                  <Button size="sm" variant="outline" onClick={() => void chooseFolder()}>
                    {t('autoBackup.folderChange')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void forgetFolder()}>
                    {t('autoBackup.folderForget')}
                  </Button>
                </Flex>
              </Flex>
            ) : (
              // Chrome keeps the folder but forgets the permission when the
              // browser restarts, unless the owner ticked "allow on every
              // visit". One click puts it back.
              <Alert.Root status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t('autoBackup.folderNeedsOk', { name: s.folder.name })}</Alert.Title>
                </Alert.Content>
                <Button size="sm" colorPalette="orange" onClick={() => void reconnectFolder()}>
                  {t('autoBackup.folderAllow')}
                </Button>
              </Alert.Root>
            )}
          </Stack>

          <Separator />

          {/* ------------------------- carnet ------------------------- */}
          <Stack gap={2}>
            <Flex align="center" justify="space-between" gap={3} wrap="wrap">
              <Flex align="center" gap={2}>
                <BookUser size={18} />
                <Text fontWeight="semibold">{t('autoBackup.carnetTitle')}</Text>
              </Flex>
              {newest && (
                <Button size="sm" variant="outline" onClick={() => void downloadCarnet()}>
                  <Download size={16} />
                  {t('autoBackup.carnetDownload')}
                </Button>
              )}
            </Flex>
            {carnet && (
              <>
                <Text color={carnet.mismatches.length ? 'fg.muted' : 'green.fg'}>
                  {carnet.debtors > 0
                    ? t('autoBackup.carnetOk', { debtors: carnet.debtors, amount: money(carnet.outstanding) })
                    : t('autoBackup.carnetEmpty')}
                </Text>
                {carnet.mismatches.length > 0 && (
                  <Alert.Root status="warning" size="sm">
                    <Alert.Indicator />
                    <Alert.Title>
                      {t('autoBackup.carnetMismatch', {
                        count: carnet.mismatches.length,
                        names: carnet.mismatches
                          .slice(0, 5)
                          .map((m) => `${m.name} (${money(m.stored)} ≠ ${money(m.ledger)})`)
                          .join(', '),
                      })}
                    </Alert.Title>
                  </Alert.Root>
                )}
                {carnet.orphanEntries > 0 && (
                  <Text color="fg.subtle" fontSize="sm">
                    {t('autoBackup.carnetOrphans', { count: carnet.orphanEntries })}
                  </Text>
                )}
              </>
            )}
          </Stack>

          <Separator />

          {/* --------------------- restore points --------------------- */}
          <Stack gap={2}>
            <Flex align="center" gap={2}>
              <History size={18} />
              <Text fontWeight="semibold">{t('autoBackup.pointsTitle')}</Text>
            </Flex>
            <Text color="fg.subtle" fontSize="sm">
              {t('autoBackup.pointsDesc')}
            </Text>
            {s.points.length === 0 ? (
              <Text color="fg.muted">{t('autoBackup.pointsEmpty')}</Text>
            ) : (
              <Stack gap={1} maxH="18rem" overflowY="auto">
                {s.points.map((p) => (
                  <Flex key={p.key} align="center" justify="space-between" gap={3} py={1} wrap="wrap">
                    <Box minW={0}>
                      <Text fontWeight="medium">
                        {dayjs(p.at).format('DD/MM/YYYY HH:mm')}
                        {p.source === 'manual' && (
                          <Badge ms={2} size="sm" variant="subtle">
                            {t('autoBackup.pointManual')}
                          </Badge>
                        )}
                      </Text>
                      <Text color="fg.subtle" fontSize="sm">
                        {t('autoBackup.pointLine', { count: p.total })} · {kb(p.bytes)}
                        {p.carnet.outstanding > 0 && ` · ${t('autoBackup.carnetTitle')} ${money(p.carnet.outstanding)}`}
                      </Text>
                    </Box>
                    <Flex gap={1}>
                      <Button size="xs" variant="ghost" onClick={() => void downloadPoint(p.key, p.at)}>
                        <Download size={14} />
                        {t('autoBackup.download')}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        colorPalette="orange"
                        onClick={async () => {
                          const b = await open(p.key)
                          if (b) onRestore(b)
                        }}
                      >
                        <RotateCcw size={14} />
                        {t('autoBackup.restore')}
                      </Button>
                    </Flex>
                  </Flex>
                ))}
              </Stack>
            )}
          </Stack>
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}
