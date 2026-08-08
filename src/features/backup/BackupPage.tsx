import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Flex,
  Stack,
  Heading,
  Text,
  Button,
  Card,
  Alert,
  SimpleGrid,
} from '@chakra-ui/react'
import { Download, Upload, DatabaseBackup, FileSpreadsheet } from 'lucide-react'
import dayjs from 'dayjs'
import {
  exportAll,
  downloadJson,
  downloadCsvFiles,
  restoreAll,
  isBackupFile,
  countDocs,
} from './backupService'

export function BackupPage() {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const doExport = async (kind: 'json' | 'csv') => {
    setBusy(true)
    setStatus(null)
    try {
      const backup = await exportAll()
      if (kind === 'json') {
        downloadJson(backup, `librairie-sauvegarde-${dayjs().format('YYYY-MM-DD')}.json`)
      } else {
        downloadCsvFiles(backup)
      }
      setStatus({ kind: 'ok', text: `${t('backup.exported')} (${countDocs(backup)} ${t('backup.records')})` })
    } catch (err) {
      setStatus({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    setStatus(null)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isBackupFile(parsed)) {
        setStatus({ kind: 'error', text: t('backup.invalidFile') })
        return
      }
      if (!window.confirm(t('backup.restoreConfirm'))) return
      setBusy(true)
      const written = await restoreAll(parsed)
      setStatus({ kind: 'ok', text: t('backup.restored', { count: written }) })
    } catch (err) {
      setStatus({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <Flex align="center" gap={3} mb={1}>
        <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
          <DatabaseBackup size={24} />
        </Box>
        <Heading size="2xl">{t('backup.title')}</Heading>
      </Flex>
      <Text color="fg.muted" mb={5}>
        {t('backup.subtitle')}
      </Text>

      {status && (
        <Alert.Root status={status.kind === 'ok' ? 'success' : 'error'} mb={5}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{status.text}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={5}>
        {/* -------- Export -------- */}
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
                size="xl"
                colorPalette="brand"
                loading={busy}
                onClick={() => doExport('json')}
              >
                <Download size={20} />
                {t('backup.exportJson')}
              </Button>
              <Button
                size="lg"
                variant="outline"
                loading={busy}
                onClick={() => doExport('csv')}
              >
                <FileSpreadsheet size={20} />
                {t('backup.exportCsv')}
              </Button>
            </Stack>
          </Card.Body>
        </Card.Root>

        {/* -------- Restore -------- */}
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
              size="xl"
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
    </Box>
  )
}
