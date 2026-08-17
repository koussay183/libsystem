import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Alert, Box, Button, Card, Flex, Heading, Spinner, Stack, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { ShieldAlert, LogOut } from 'lucide-react'
import { useAuth } from './AuthContext'

/**
 * Nothing renders until we know WHICH shop this is.
 *
 * The gate is not only "is somebody signed in" — it is "is somebody signed in
 * who owns a shop". An account with no shopId claim has not been provisioned by
 * the CLI, and letting it through would run every hook against a path that
 * cannot be built, which throws in render. So it gets a screen of its own.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { user, loading, shopId, logout } = useAuth()

  if (loading && !user) {
    return (
      <Flex minH="100dvh" align="center" justify="center">
        <Spinner size="xl" colorPalette="brand" />
      </Flex>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Signed in, but this account was never attached to a shop. Waiting would be
  // wrong: no amount of waiting attaches it. Only the CLI can.
  if (!shopId) {
    if (loading) {
      return (
        <Flex minH="100dvh" align="center" justify="center">
          <Spinner size="xl" colorPalette="brand" />
        </Flex>
      )
    }
    return (
      <Flex minH="100dvh" align="center" justify="center" p={4} bg="bg.subtle">
        <Card.Root maxW="30rem" w="full">
          <Card.Body p={{ base: 6, md: 8 }}>
            <Stack gap={5}>
              <Flex align="center" gap={3}>
                <Box bg="orange.subtle" color="orange.fg" p={3} borderRadius="lg">
                  <ShieldAlert size={28} />
                </Box>
                <Heading size="xl">{t('auth.noShopTitle')}</Heading>
              </Flex>
              <Text color="fg.muted" fontSize="lg">
                {t('auth.noShopBody')}
              </Text>
              <Alert.Root status="info">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t('auth.noShopHint')}</Alert.Title>
                </Alert.Content>
              </Alert.Root>
              <Button size="lg" variant="outline" onClick={() => void logout()}>
                <LogOut size={20} />
                {t('common.logout')}
              </Button>
            </Stack>
          </Card.Body>
        </Card.Root>
      </Flex>
    )
  }

  return <>{children}</>
}
