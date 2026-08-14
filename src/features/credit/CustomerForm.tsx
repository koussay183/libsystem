import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  Input,
  Portal,
  Stack,
} from '@chakra-ui/react'
import { UserPlus, UserCog } from 'lucide-react'
import { useAlive } from '@/lib/useAlive'
import { createCustomer, updateCustomer } from '@/features/customers/useCustomers'
import type { Customer } from '@/types/models'

export function CustomerForm({
  open,
  onClose,
  customer,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  customer?: Customer | null
  /** Called with the new id after a customer is created (for auto-select). */
  onCreated?: (id: string) => void
}) {
  const { t } = useTranslation()
  const alive = useAlive()
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cin, setCin] = useState('')
  const [note, setNote] = useState('')
  const [nameError, setNameError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(customer?.name ?? '')
    setPhone(customer?.phone ?? '')
    setCin(customer?.cin ?? '')
    setNote(customer?.note ?? '')
    setNameError('')
    setSaveError('')
    setBusy(false)
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [open, customer])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (name.trim() === '') {
      setNameError(t('customer.nameRequired'))
      return
    }
    setBusy(true)
    setSaveError('')
    try {
      const input = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        cin: cin.trim() || undefined,
        note: note.trim() || undefined,
      }
      if (customer) {
        await updateCustomer(customer.id, input)
      } else {
        onCreated?.(createCustomer(input))
      }
      if (alive.current) onClose()
    } catch (err) {
      // Silently closing on a failed write would let the owner believe a client
      // exists when nothing was saved.
      if (alive.current) {
        setSaveError(err instanceof Error ? err.message : t('common.error'))
      }
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  return (
    <Dialog.Root scrollBehavior="inside"
      open={open}
      onOpenChange={(e: { open: boolean }) => !e.open && onClose()}
      size="md"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Flex align="center" gap={3}>
                <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                  {customer ? <UserCog size={22} /> : <UserPlus size={22} />}
                </Box>
                <Dialog.Title>
                  {customer ? t('customer.edit') : t('customer.add')}
                </Dialog.Title>
              </Flex>
            </Dialog.Header>

            <Dialog.Body>
              <form id="customer-form" onSubmit={submit}>
                <Stack gap={4}>
                  <Field.Root required invalid={!!nameError}>
                    <Field.Label>{t('customer.name')}</Field.Label>
                    <Input
                      ref={nameRef}
                      size="lg"
                      value={name}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setName(e.target.value)
                      }}
                      placeholder={t('customer.namePlaceholder')}
                    />
                    <Field.ErrorText>{nameError}</Field.ErrorText>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>{t('customer.phone')}</Field.Label>
                    <Input
                      size="lg"
                      inputMode="tel"
                      value={phone}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setPhone(e.target.value)
                      }}
                    />
                    <Field.HelperText>{t('common.optional')}</Field.HelperText>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>{t('customer.cin')}</Field.Label>
                    <Input
                      size="lg"
                      inputMode="numeric"
                      value={cin}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setCin(e.target.value)
                      }}
                      placeholder={t('customer.cinPlaceholder')}
                    />
                    <Field.HelperText>{t('common.optional')}</Field.HelperText>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>{t('customer.note')}</Field.Label>
                    <Input
                      size="lg"
                      value={note}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setNote(e.target.value)
                      }}
                    />
                    <Field.HelperText>{t('common.optional')}</Field.HelperText>
                  </Field.Root>

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
              <Button size="lg" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                size="lg"
                colorPalette="brand"
                type="submit"
                form="customer-form"
                disabled={busy}
              >
                {busy ? t('common.saving') : t('common.save')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
