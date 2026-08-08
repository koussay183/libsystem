import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { Box, Card, Flex, Grid, Heading, Stack, Text } from '@chakra-ui/react'
import { LanguageToggle } from '@/components/LanguageToggle'

const ENV_TEMPLATE = `VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...`

/** One numbered bullet in the setup checklist. */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <Flex as="li" gap={3} align="start">
      <Flex
        flexShrink={0}
        boxSize={8}
        align="center"
        justify="center"
        borderRadius="full"
        bg="brand.subtle"
        color="brand.fg"
        fontWeight="bold"
      >
        {n}
      </Flex>
      <Text>{children}</Text>
    </Flex>
  )
}

/** Shown when .env.local has no Firebase config yet. */
export function SetupNeeded() {
  const { t } = useTranslation()

  return (
    <Grid minH="100vh" placeItems="center" bg="bg.muted" p={4}>
      <Box w="full" maxW="lg">
        <Flex justify="flex-end" mb={4}>
          <LanguageToggle />
        </Flex>

        <Card.Root>
          <Card.Body p={7}>
            <Flex align="center" gap={3} mb={4} color="brand.fg">
              <Settings size={30} />
              <Heading size="2xl">{t('setup.title')}</Heading>
            </Flex>

            <Text color="fg.muted">{t('setup.body')}</Text>

            <Stack as="ol" gap={3} mt={5} listStyleType="none">
              <Step n={1}>{t('setup.step1')}</Step>
              <Step n={2}>{t('setup.step2')}</Step>
              <Step n={3}>{t('setup.step3')}</Step>
            </Stack>

            <Box
              as="pre"
              dir="ltr"
              mt={5}
              p={4}
              borderRadius="xl"
              overflowX="auto"
              bg="gray.900"
              color="gray.100"
              fontFamily="mono"
              fontSize="sm"
            >
              {ENV_TEMPLATE}
            </Box>
          </Card.Body>
        </Card.Root>
      </Box>
    </Grid>
  )
}
