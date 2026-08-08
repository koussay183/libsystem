import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  Dialog,
  Field,
  HStack,
  Input,
  Portal,
  Flex,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Coins, HandCoins, CheckCheck, TriangleAlert } from 'lucide-react'
import { useAlive } from '@/lib/useAlive'
import { formatMoney, fromMinor, parseMoney } from '@/lib/money'
import { addCreditEntry } from '@/features/customers/useCustomers'

/** Round sums the owner actually handles: 5, 10, 20 and 50 dinars. */
const QUICK_AMOUNTS = [5_000, 10_000, 20_000, 50_000]

/** Millimes -> the decimal string the money input expects ("5.000"). */
function toInput(minor: number): string {
  return fromMinor(minor).toFixed(3)
}

export function CreditEntryForm({
  open,
  onClose,
  customerId,
  type,
  balance = 0,
}: {
  open: boolean
  onClose: () => void
  customerId: string
  type: 'payment' | 'debit'
  /** What the client owes right now, millimes. Drives "solder tout le compte". */
  balance?: number
}) {
  const { t } = useTranslation()
  const alive = useAlive()
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [overpayAsked, setOverpayAsked] = useState(false)
  const [settling, setSettling] = useState(false)
  const [busy, setBusy] = useState(false)
  /** Synchronous in-flight guard — see the comment in submit(). */
  const submitting = useRef(false)

  const isPayment = type === 'payment'
  const symbol = t('money.symbol')
  const money = (m: number) => formatMoney(m, { symbol })
  const owed = Math.max(0, balance)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setLabel('')
    setError('')
    setSaveError('')
    setOverpayAsked(false)
    setSettling(false)
    setBusy(false)
  }, [open])

  const minor = parseMoney(amount)
  // Paying more than the account holds is legitimate (he leaves an advance),
  // but it must never happen by a slip of the finger — the owner confirms it.
  const overpay = isPayment && minor !== null && minor > owed

  const setAmountTo = (next: number, isSettle = false) => {
    setAmount(toInput(next))
    setError('')
    setOverpayAsked(false)
    setSettling(isSettle)
  }

  const addQuick = (extra: number) => {
    setAmountTo((minor ?? 0) + extra)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (minor === null || minor <= 0) {
      setError(t('credit.amountRequired'))
      return
    }
    if (overpay && !overpayAsked) {
      setOverpayAsked(true)
      return
    }
    // `busy` is state and only lands on the next render; a second Enter before
    // then would record the payment twice and halve the client's debt for free.
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setSaveError('')
    try {
      await addCreditEntry(customerId, type, minor, label.trim() || undefined)
      if (alive.current) onClose()
    } catch (err) {
      if (alive.current) {
        setSaveError(err instanceof Error ? err.message : t('common.error'))
      }
    } finally {
      submitting.current = false
      if (alive.current) setBusy(false)
    }
  }

  return (
    <Dialog.Root scrollBehavior="inside" open={open} onOpenChange={(e) => !e.open && onClose()} size="md">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <HStack gap={3}>
                <Box
                  bg={isPayment ? 'green.subtle' : 'red.subtle'}
                  color={isPayment ? 'green.fg' : 'red.fg'}
                  p={2}
                  borderRadius="lg"
                >
                  {isPayment ? <Coins size={22} /> : <HandCoins size={22} />}
                </Box>
                <Dialog.Title>
                  {isPayment ? t('credit.recordPayment') : t('credit.recordDebit')}
                </Dialog.Title>
              </HStack>
            </Dialog.Header>

            <Dialog.Body>
              <form id="credit-entry-form" onSubmit={submit}>
                <Stack gap={4}>
                  {/* What he owes right now, so the owner never types blind. */}
                  <HStack justify="space-between">
                    <Text color="fg.muted">{t('customer.balance')}</Text>
                    <Text
                      fontSize="xl"
                      fontWeight="bold"
                      color={balance > 0 ? 'red.600' : 'green.600'}
                    >
                      {balance > 0 ? money(balance) : t('credit.settled')}
                    </Text>
                  </HStack>

                  {isPayment && owed > 0 && (
                    <Button
                      type="button"
                      size="lg"
                      variant="subtle"
                      colorPalette="green"
                      onClick={() => setAmountTo(owed, true)}
                    >
                      <CheckCheck size={20} />
                      {t('credit.payAll')}
                    </Button>
                  )}

                  {settling && minor === owed && (
                    <Alert.Root status="info">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>
                          {t('credit.payAllConfirm', { amount: money(owed) })}
                        </Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  <Field.Root required invalid={!!error}>
                    <Field.Label>{`${t('credit.amount')} (${symbol})`}</Field.Label>
                    <Input
                      size="xl"
                      autoFocus
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value)
                        setError('')
                        setOverpayAsked(false)
                        setSettling(false)
                      }}
                      inputMode="decimal"
                      placeholder="0.000"
                      fontSize="2xl"
                      fontWeight="bold"
                      textAlign="end"
                    />
                    <Field.ErrorText>{error}</Field.ErrorText>
                  </Field.Root>

                  <Box>
                    <Text fontSize="sm" color="fg.muted" mb={2}>
                      {t('credit.quickAmounts')}
                    </Text>
                    <Flex wrap="wrap" gap={2}>
                      {QUICK_AMOUNTS.map((q) => (
                        <Button
                          key={q}
                          type="button"
                          size="lg"
                          variant="outline"
                          onClick={() => addQuick(q)}
                        >
                          {`+ ${fromMinor(q)} ${symbol}`}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="lg"
                        variant="ghost"
                        onClick={() => {
                          setAmount('')
                          setError('')
                          setOverpayAsked(false)
                          setSettling(false)
                        }}
                      >
                        {t('common.reset')}
                      </Button>
                    </Flex>
                  </Box>

                  <Field.Root>
                    <Field.Label>{t('credit.label')}</Field.Label>
                    <Input
                      size="lg"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder={t('credit.labelPlaceholder')}
                    />
                    <Field.HelperText>{t('common.optional')}</Field.HelperText>
                  </Field.Root>

                  {overpay && (
                    <Alert.Root status="warning">
                      <Alert.Indicator>
                        <TriangleAlert size={20} />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>
                          {t('credit.creditor', {
                            amount: money((minor ?? 0) - owed),
                          })}
                        </Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  {saveError && (
                    <Alert.Root status="error">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{saveError}</Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}
                </Stack>
              </form>
            </Dialog.Body>

            <Dialog.Footer>
              <Button size="lg" variant="outline" onClick={onClose} disabled={busy}>
                {t('common.cancel')}
              </Button>
              <Button
                size="lg"
                type="submit"
                form="credit-entry-form"
                disabled={busy}
                colorPalette={overpay && overpayAsked ? 'orange' : isPayment ? 'green' : 'red'}
              >
                {busy
                  ? t('common.saving')
                  : overpay && overpayAsked
                    ? t('common.confirm')
                    : t('common.save')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
