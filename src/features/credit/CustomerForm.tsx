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
import { moneyPlaceholder, moneySymbolKey, parseMoney } from '@/lib/money'
import {
  createCustomer,
  updateCustomer,
  addCreditEntry,
} from '@/features/customers/useCustomers'
import type { Customer } from '@/types/models'

export function CustomerForm({
  open,
  onClose,
  customer,
  onCreated,
  withOpeningDebt = false,
}: {
  open: boolean
  onClose: () => void
  customer?: Customer | null
  /** Called with the new id after a customer is created (for auto-select). */
  onCreated?: (id: string) => void
  /**
   * Offers an "il doit déjà" amount on a NEW client.
   *
   * The owner opening this form from the Crédits screen is, nine times out of
   * ten, copying a client in from a paper carnet — a person who already owes
   * him something. The form used to create the client with a zero balance and
   * close; the green "Soldé" badge then said the opposite of what he had just
   * typed the name for, and he had to find the client, open him and press
   * "Il a pris" to write the number he already had in front of him.
   */
  withOpeningDebt?: boolean
}) {
  const { t } = useTranslation()
  const alive = useAlive()
  const nameRef = useRef<HTMLInputElement>(null)
  const symbol = t(moneySymbolKey())

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cin, setCin] = useState('')
  const [note, setNote] = useState('')
  const [opening, setOpening] = useState('')
  const [nameError, setNameError] = useState('')
  const [openingError, setOpeningError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * A synchronous re-entrancy latch, next to the rendered `busy`.
   *
   * `busy` is state and lands a render late. Enter held down for a beat on the
   * name field fires submit twice inside that render, and createCustomer mints
   * an id and queues a write on each call — two clients with the same name,
   * both durable, both replayed. CreditEntryForm has carried this latch for
   * the same reason since the twenty-dinars-twice incident.
   */
  const submitting = useRef(false)

  /**
   * Keyed on the customer's ID, not the customer object.
   *
   * useCustomer builds a fresh object on every snapshot, and a snapshot arrives
   * whenever anything writes to that document — the till queuing a credit
   * ticket for this very client while the owner is correcting his phone number.
   * Keyed on the object, this effect ran again and put the stored phone back
   * over the half-typed one.
   */
  const customerId = customer?.id
  useEffect(() => {
    if (!open) return
    setName(customer?.name ?? '')
    setPhone(customer?.phone ?? '')
    setCin(customer?.cin ?? '')
    setNote(customer?.note ?? '')
    setOpening('')
    setNameError('')
    setOpeningError('')
    setSaveError('')
    setBusy(false)
    submitting.current = false
    setTimeout(() => nameRef.current?.focus(), 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting.current) return
    setNameError('')
    setOpeningError('')
    if (name.trim() === '') {
      setNameError(t('customer.nameRequired'))
      return
    }
    // Blank means "no opening debt", which is the common case. Anything typed
    // must read as money, or the amount he meant is dropped without a word.
    let openingMinor = 0
    if (withOpeningDebt && !customer && opening.trim() !== '') {
      const parsed = parseMoney(opening)
      if (parsed === null || parsed <= 0) {
        setOpeningError(t('credit.amountInvalid'))
        return
      }
      openingMinor = parsed
    }
    submitting.current = true
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
        const id = createCustomer(input)
        // Queued right behind the customer's own write. Firestore replays
        // mutations in enqueue order, so the increment() on his balance can
        // never reach the server before the document it increments.
        if (openingMinor > 0) {
          await addCreditEntry(id, 'debit', openingMinor, t('credit.openingDebtLabel'))
        }
        onCreated?.(id)
      }
      if (alive.current) onClose()
    } catch (err) {
      // Silently closing on a failed write would let the owner believe a client
      // exists when nothing was saved.
      if (alive.current) {
        setSaveError(err instanceof Error ? err.message : t('common.error'))
      }
    } finally {
      submitting.current = false
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
              {/*
                noValidate, because the browser's own "please fill in this
                field" bubble was pre-empting the message below. Field.Root
                required puts a native `required` on the input; on the shop's
                kiosk the bubble is a grey tooltip that vanishes in a second,
                and the owner was left with a form that "did nothing".
              */}
              <form id="customer-form" noValidate onSubmit={submit}>
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

                  {withOpeningDebt && !customer && (
                    <Field.Root invalid={!!openingError}>
                      <Field.Label>{`${t('credit.openingDebt')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        inputMode="decimal"
                        value={opening}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          setOpening(e.target.value)
                          setOpeningError('')
                        }}
                        placeholder={moneyPlaceholder()}
                      />
                      <Field.ErrorText>{openingError}</Field.ErrorText>
                      {!openingError && (
                        <Field.HelperText>{t('credit.openingDebtHint')}</Field.HelperText>
                      )}
                    </Field.Root>
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
