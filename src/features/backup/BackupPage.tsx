import { useTranslation } from 'react-i18next'
import { Box, Flex, Heading, Text } from '@chakra-ui/react'
import { DatabaseBackup } from 'lucide-react'
import { BackupPanel } from './BackupPanel'

/**
 * The backup on its own page. The same panel also lives inside the settings,
 * which is where the owner actually goes looking for it.
 */
export function BackupPage() {
  const { t } = useTranslation()

  return (
    <Box>
      <Flex align="center" gap={3} mb={1}>
        <Box bg="red.subtle" color="red.fg" p={2} borderRadius="lg">
          <DatabaseBackup size={24} />
        </Box>
        <Heading size="2xl">{t('backup.title')}</Heading>
      </Flex>
      <Text color="fg.muted" mb={5}>
        {t('backup.subtitle')}
      </Text>

      <BackupPanel />
    </Box>
  )
}
