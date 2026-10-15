import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  Input,
  Portal,
  Stack,
} from '@chakra-ui/react'
import { Truck, PencilLine } from 'lucide-react'
import { useAlive } from '@/lib/useAlive'
import { useProducts } from '@/features/stock/useProducts'
import { createSupplier, updateSupplier } from './useSuppliers'
import { PhoneInput } from '@/components/PhoneInput'
import { SimilarRecords } from '@/components/SimilarRecords'
import { findSimilar } from '@/lib/similar'
import { normalizePhone } from '@/lib/phone'
import type { Purchase, Supplier } from '@/types/models'

export function SupplierForm({
  open,
  onClose,
  supplier,
  purchases = [],
  suppliers = [],
  purchasesLoading = false,
  onPickExisting,
}: {
  open: boolean
  onClose: () => void
  supplier?: Supplier | null
  /** The live purchases, so a rename can carry them to the new name. */
  purchases?: Purchase[]
  /** The existing suppliers, to warn before a second "Sotupa" is created. */
  suppliers?: Supplier[]
  /** The purchases have not arrived yet: a rename now would carry none of them. */
  purchasesLoading?: boolean
  /** Switches the form to an existing supplier the owner recognised. */
  onPickExisting?: (supplier: Supplier) => void
}) {
  const { t } = useTranslation()
  const { products } = useProducts()
  const alive = useAlive()
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [nameError, setNameError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(supplier?.name ?? '')
    setPhone(supplier?.phone ?? '')
    setNote(supplier?.note ?? '')
    setNameError('')
    setBusy(false)
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [open, supplier])

  // Only while creating: a rename that looks like another supplier is a
  // deliberate act, and the list would mostly echo the one being edited.
  const similar = useMemo(
    () => (supplier ? [] : findSimilar(suppliers, name, phone)),
    [supplier, suppliers, name, phone],
  )

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    if (name.trim() === '') {
      setNameError(t('supplier.nameRequired'))
      return
    }
    // Renamed before the purchases list arrived, nothing was re-tagged and the
    // supplier came out with 0 DT bought.
    if (supplier && name.trim() !== supplier.name && purchasesLoading) {
      setNameError(t('backFix.waitPurchases'))
      return
    }
    setBusy(true)
    try {
      const input = {
        name: name.trim(),
        phone: normalizePhone(phone) || undefined,
        note: note.trim() || undefined,
      }
      if (supplier) {
        await updateSupplier(supplier.id, input, {
          from: supplier.name,
          purchases,
          products,
        })
      }
      else await createSupplier(input)
      if (alive.current) onClose()
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  return (
    <Dialog.Root scrollBehavior="inside"
      open={open}
      onOpenChange={(e: { open: boolean }) => {
        if (!e.open) onClose()
      }}
      size="md"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Flex align="center" gap={3}>
                <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                  {supplier ? <PencilLine size={22} /> : <Truck size={22} />}
                </Box>
                <Dialog.Title>
                  {supplier ? t('supplier.edit') : t('supplier.add')}
                </Dialog.Title>
              </Flex>
            </Dialog.Header>

            <Dialog.Body>
              <form id="supplier-form" noValidate onSubmit={submit}>
                <Stack gap={4}>
                  <Field.Root required invalid={!!nameError}>
                    <Field.Label>{t('supplier.name')}</Field.Label>
                    <Input
                      ref={nameRef}
                      size="lg"
                      value={name}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setName(e.target.value)
                        setNameError('')
                      }}
                      placeholder={t('supplier.namePlaceholder')}
                    />
                    <Field.ErrorText>{nameError}</Field.ErrorText>
                  </Field.Root>

                  <SimilarRecords matches={similar} onPick={onPickExisting} />

                  <Field.Root>
                    <Field.Label>{t('supplier.phone')}</Field.Label>
                    <PhoneInput size="lg" value={phone} onChange={setPhone} />
                    <Field.HelperText>{t('common.optional')}</Field.HelperText>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>{t('supplier.note')}</Field.Label>
                    <Input
                      size="lg"
                      value={note}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setNote(e.target.value)
                      }
                    />
                    <Field.HelperText>{t('common.optional')}</Field.HelperText>
                  </Field.Root>
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
                form="supplier-form"
                loading={busy}
                loadingText={t('common.saving')}
              >
                {t('common.save')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
