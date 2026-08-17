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
 * Email and password, one account per shop.
 *
 * Accounts are not created here and there is no "sign up" — the owner of the
 * product creates them from the admin CLI. A shop that cannot get in has to
 * ring him, which is exactly the intended flow for a paid product with a
 * handful of customers.
 */
export function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      // Firebase's codes, said in words a shopkeeper can act on. Wrong email
      // and wrong password are deliberately the SAME message: telling an
      // attacker which of the two was right is how account lists get
      // enumerated.
      const code = (err as { code?: string } | null)?.code ?? ''
      if (code === 'auth/network-request-failed') setError(t('auth.offline'))
      else if (code === 'auth/too-many-requests') setError(t('auth.tooMany'))
      else if (code === 'auth/user-disabled') setError(t('auth.disabled'))
      else setError(t('auth.invalid'))
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
              {t('auth.subtitle')}
            </Text>

            <form onSubmit={submit}>
              <Stack gap={4}>
                <Field.Root>
                  <Field.Label>{t('auth.email')}</Field.Label>
                  <Input
                    size="xl"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    value={email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>{t('auth.password')}</Field.Label>
                  <Input
                    size="xl"
                    type="password"
                    autoComplete="current-password"
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

                <Text fontSize="sm" color="fg.subtle" textAlign="center">
                  {t('auth.noAccountHint')}
                </Text>
              </Stack>
            </form>
          </Card.Body>
        </Card.Root>
      </Box>
    </Flex>
  )
}
