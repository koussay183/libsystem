import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  HStack,
  Input,
  Portal,
  Stack,
  Text,
  Alert,
} from '@chakra-ui/react'
import { Wallet } from 'lucide-react'
import { formatMoney, parseMoney, fromMinor, moneySymbolKey } from '@/lib/money'
import { formatDate } from '@/lib/format'
import { useAlive } from '@/lib/useAlive'
import { settlePurchase, purchaseOwed } from './usePurchases'
import type { Purchase } from '@/types/models'

/**
 * Hands money to the supplier against one facture d'achat. The amount is
 * pre-filled with the outstanding balance — the common case is "je paye tout"
 * in one click — and can never exceed it, so an invoice cannot go overpaid.
 */
export function SettlePurchase({
  purchase,
  open,
  onClose,
}: {
  purchase: Purchase
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const alive = useAlive()
  const symbol = t(moneySymbolKey())

  const owed = purchaseOwed(purchase)

  const [amountStr, setAmountStr] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmountStr(String(fromMinor(owed)))
    setError('')
    setBusy(false)
  }, [open, owed])

  const parsed = parseMoney(amountStr)
  const amount = parsed === null ? 0 : Math.min(parsed, owed)
  const leftAfter = Math.max(0, owed - amount)

  /**
   * settlePurchase writes into the local cache and returns without waiting for
   * the server, so closing here means "the payment is recorded on this machine",
   * which is the strongest honest claim when the line is down. The new balance
   * shows on the Achats row immediately because the listener serves it from the
   * same cache. It used to await the acknowledgement: offline that never arrived,
   * the owner cancelled and paid the supplier a second time in the app, and
   * increment() applied both amounts on reconnect.
   */
  const save = async () => {
    if (parsed === null || parsed <= 0) {
      setError(t('credit.amountRequired'))
      return
    }
    setError('')
    setBusy(true)
    try {
      await settlePurchase(purchase.id, amount)
      if (alive.current) onClose()
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
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
                <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                  <Wallet size={22} />
                </Box>
                <Dialog.Title>{t('purchases.settle')}</Dialog.Title>
              </HStack>
            </Dialog.Header>

            <Dialog.Body>
              <Stack gap={4}>
                <Box borderWidth="1px" borderColor="border" borderRadius="xl" p={3}>
                  <Text fontSize="lg" fontWeight="semibold">
                    {purchase.supplier || t('common.none')}
                  </Text>
                  <Text fontSize="sm" color="fg.muted">
                    {formatDate(purchase.date)}
                    {purchase.reference ? ` · ${purchase.reference}` : ''}
                  </Text>
                  <Flex justify="space-between" mt={2}>
                    <Text color="fg.muted">{t('common.total')}</Text>
                    <Text fontWeight="semibold">
                      {formatMoney(purchase.total, { symbol })}
                    </Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text color="fg.muted">{t('purchases.owedToSupplier')}</Text>
                    <Text fontWeight="bold" color="red.600">
                      {formatMoney(owed, { symbol })}
                    </Text>
                  </Flex>
                </Box>

                <Field.Root invalid={!!error}>
                  <Field.Label fontSize="lg">{t('purchases.settleAmount')}</Field.Label>
                  <Input
                    size="xl"
                    autoFocus
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => {
                      setAmountStr(e.target.value)
                      setError('')
                    }}
                  />
                  {error ? (
                    <Field.ErrorText>{error}</Field.ErrorText>
                  ) : (
                    <Field.HelperText>{t('purchases.settleConfirm')}</Field.HelperText>
                  )}
                </Field.Root>

                <Flex justify="space-between">
                  <Text color="fg.muted">{t('purchases.owedToSupplier')}</Text>
                  <Text fontWeight="bold" color={leftAfter > 0 ? 'orange.600' : 'green.600'}>
                    {formatMoney(leftAfter, { symbol })}
                  </Text>
                </Flex>

                {parsed !== null && parsed > owed && (
                  <Alert.Root status="warning">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>
                        {t('purchases.owedToSupplier')} : {formatMoney(owed, { symbol })}
                      </Alert.Title>
                    </Alert.Content>
                  </Alert.Root>
                )}
              </Stack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button size="lg" variant="outline" disabled={busy} onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                size="xl"
                colorPalette="brand"
                px={8}
                loading={busy}
                disabled={busy}
                onClick={save}
              >
                <Wallet size={20} />
                {busy ? t('common.saving') : formatMoney(amount, { symbol })}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
