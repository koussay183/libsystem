import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  HStack,
  IconButton,
  Input,
  Portal,
  SegmentGroup,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Minus, PackagePlus, Plus, X } from 'lucide-react'
import { useAlive } from '@/lib/useAlive'
import { parseQuantity } from '@/lib/money'
import { addStock, setStock } from './useProducts'
import type { Product } from '@/types/models'

type Mode = 'add' | 'set'

interface StockAdjustDialogProps {
  open: boolean
  onClose: () => void
  product: Product | null
}

/**
 * The two things that happen to a shelf: a delivery arrives (add — an atomic
 * increment, so a sale rung up at the same second is not lost), or the owner
 * counts and the count is simply wrong (correct — a plain write).
 */
export function StockAdjustDialog({ open, onClose, product }: StockAdjustDialogProps) {
  const { t } = useTranslation()
  const alive = useAlive()
  const inputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>('add')
  const [value, setValue] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('add')
    setValue('')
    setSaveError('')
    setBusy(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, product])

  const current = product?.quantity ?? 0
  // Refuse to guess: "abc" must not quietly become 0 and empty a shelf.
  const parsed = parseQuantity(value)
  const invalid = parsed === null
  const typed = parsed ?? 0
  const next = mode === 'add' ? current + typed : Math.max(0, typed)

  const step = (delta: number) => {
    setValue(String(Math.max(0, typed + delta)))
    setSaveError('')
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!product) return
    if (invalid) {
      setSaveError(t('common.invalidNumber'))
      return
    }
    setSaveError('')
    setBusy(true)
    try {
      if (mode === 'add') await addStock(product.id, typed)
      else await setStock(product.id, typed)
      if (alive.current) onClose()
    } catch (err) {
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
      onOpenChange={(e) => {
        if (!e.open) onClose()
      }}
      size="md"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <HStack gap={3}>
                <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                  <PackagePlus size={22} />
                </Box>
                <Dialog.Title>{t('stock.restock')}</Dialog.Title>
              </HStack>
              <Dialog.CloseTrigger asChild>
                <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                  <X size={18} />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <form id="stock-adjust-form" onSubmit={submit}>
                <Stack gap={5}>
                  <Box>
                    <Text fontSize="xl" fontWeight="semibold">
                      {product?.name}
                    </Text>
                    <Text color="fg.muted">
                      {`${t('stock.quantity')}: ${current} ${product?.unit || t('stock.units')}`}
                    </Text>
                  </Box>

                  <SegmentGroup.Root
                    size="lg"
                    colorPalette="brand"
                    value={mode}
                    onValueChange={(e: { value: string | null }) => {
                      setMode(e.value === 'set' ? 'set' : 'add')
                      setValue('')
                      setSaveError('')
                    }}
                  >
                    <SegmentGroup.Indicator />
                    <SegmentGroup.Item value="add">
                      <SegmentGroup.ItemText>{t('stock.addStock')}</SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                    <SegmentGroup.Item value="set">
                      <SegmentGroup.ItemText>{t('stock.adjustStock')}</SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                  </SegmentGroup.Root>

                  <Field.Root>
                    <Field.Label>
                      {mode === 'add' ? t('stock.addStock') : t('stock.adjustStock')}
                    </Field.Label>
                    <Flex gap={2} align="center">
                      <IconButton
                        type="button"
                        aria-label={t('common.decrease')}
                        title={t('common.decrease')}
                        size="xl"
                        variant="outline"
                        onClick={() => step(-1)}
                      >
                        <Minus size={22} />
                      </IconButton>
                      <Input
                        ref={inputRef}
                        size="xl"
                        textAlign="center"
                        fontSize="2xl"
                        fontWeight="bold"
                        value={value}
                        onChange={(e) => {
                          setValue(e.target.value)
                          setSaveError('')
                        }}
                        inputMode="numeric"
                        placeholder="0"
                      />
                      <IconButton
                        type="button"
                        aria-label={t('common.increase')}
                        title={t('common.increase')}
                        size="xl"
                        variant="outline"
                        onClick={() => step(1)}
                      >
                        <Plus size={22} />
                      </IconButton>
                    </Flex>
                    <Field.HelperText>
                      {mode === 'add'
                        ? `${current} + ${typed} = ${next} ${t('stock.units')}`
                        : `${next} ${t('stock.units')}`}
                    </Field.HelperText>
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
                type="submit"
                form="stock-adjust-form"
                colorPalette="brand"
                loading={busy}
                loadingText={t('common.saving')}
                // An empty field parses to 0, and in "correct the count" mode
                // that would quietly empty the shelf. Neither mode may save
                // nothing.
                disabled={busy || value.trim() === '' || invalid}
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
