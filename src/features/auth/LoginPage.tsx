import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
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
import { BrandLogo } from '@/components/BrandLogo'
import { markShopMachine } from '@/features/landing/shopMachine'
import { useAuth } from '@/auth/AuthContext'
import { LanguageToggle } from '@/components/LanguageToggle'
import { CONTACT_DISPLAY, whatsappLink } from '@/lib/contact'

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
  const { login, user, shopId } = useAuth()
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
      markShopMachine()
      navigate('/', { replace: true })
    } catch (err) {
      // Firebase's codes, said in words a shopkeeper can act on. Wrong email
      // and wrong password are deliberately the SAME message: telling an
      // attacker which of the two was right is how account lists get
      // enumerated.
      const code = (err as { code?: string } | null)?.code ?? ''
      if (code === 'auth/network-request-failed') setError(t('auth.offline'))
      else if (code === 'auth/too-many-requests') setError(t('auth.tooMany'))
      else if (code === 'auth/user-disabled') setError(t('auth.disabled', { phone: CONTACT_DISPLAY }))
      else setError(t('auth.invalid'))
    } finally {
      setBusy(false)
    }
  }

  // Already signed in on this machine (a bookmark, or Back after logging in):
  // the form again would read as "my session is gone".
  if (user && shopId && !busy) return <Navigate to="/" replace />

  return (
    <Flex
      minH="100dvh"
      align="center"
      justify="center"
      p={4}
      bgGradient="to-b"
      gradientFrom="brand.muted"
      gradientTo="gray.100"
    >
      <Box w="full" maxW="md">
        <Flex align="center" justify="space-between" mb={6}>
          <Link to="/decouvrir" aria-label={t('app.name')} style={{ color: '#0b0a1f' }}>
            <BrandLogo height={40} />
          </Link>
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
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'login-error' : undefined}
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
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                </Field.Root>

                {error && (
                  <Alert.Root status="error" role="alert" id="login-error">
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

                {/* Accounts and passwords are handled by Mektebti, so both ways
                    out of this screen are a WhatsApp message already written. */}
                <Flex justify="space-between" gap={3} wrap="wrap" fontSize="sm">
                  <a
                    href={whatsappLink(t('platformFix.forgotMessage', { email: email.trim() }))}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'underline' }}
                  >
                    {t('platformFix.forgotPassword')}
                  </a>
                  <a
                    href={whatsappLink(t('platformFix.newClientMessage'))}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'underline' }}
                  >
                    {t('auth.noAccountHint')}
                  </a>
                </Flex>
              </Stack>
            </form>
          </Card.Body>
        </Card.Root>
      </Box>
    </Flex>
  )
}
