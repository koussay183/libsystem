import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Flex,
  Stack,
  Card,
  Heading,
  Text,
  Button,
  Input,
  Field,
  Alert,
} from '@chakra-ui/react'
import { BookMarked } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { LanguageToggle } from '@/components/LanguageToggle'

/**
 * One password field. The shop is opened with a single shared password — no
 * email, no jargon for a non-technical owner. (See AuthContext for what this
 * does and does not protect.)
 */
export function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(password)
      navigate('/', { replace: true })
    } catch {
      setError(t('auth.wrongPassword'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Flex
      minH="100dvh"
      align="center"
      justify="center"
      p={4}
      bgGradient="to-b"
      gradientFrom="brand.subtle"
      gradientTo="gray.100"
    >
      <Box w="full" maxW="md">
        <Flex align="center" justify="space-between" mb={6}>
          <Flex align="center" gap={2} color="brand.fg">
            <BookMarked size={32} />
            <Text fontSize="2xl" fontWeight="bold">
              {t('app.name')}
            </Text>
          </Flex>
          <LanguageToggle />
        </Flex>

        <Card.Root>
          <Card.Body p={7}>
            <Heading size="2xl">{t('auth.title')}</Heading>
            <Text mt={1} mb={6} color="fg.muted">
              {t('auth.passwordPrompt')}
            </Text>

            <form onSubmit={submit}>
              <Stack gap={4}>
                <Field.Root>
                  <Field.Label>{t('auth.password')}</Field.Label>
                  <Input
                    size="xl"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setPassword(e.target.value)
                    }
                    required
                  />
                </Field.Root>

                {error && (
                  <Alert.Root status="error">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{error}</Alert.Title>
                    </Alert.Content>
                  </Alert.Root>
                )}

                <Button
                  type="submit"
                  size="xl"
                  colorPalette="brand"
                  w="full"
                  disabled={busy}
                >
                  {busy ? t('auth.signingIn') : t('auth.signIn')}
                </Button>
              </Stack>
            </form>
          </Card.Body>
        </Card.Root>
      </Box>
    </Flex>
  )
}
