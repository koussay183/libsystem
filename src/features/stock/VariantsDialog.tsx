import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  Field,
  HStack,
  IconButton,
  Input,
  NativeSelect,
  Portal,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react'
import { Layers, Plus, Trash2, X } from 'lucide-react'
import { useAlive } from '@/lib/useAlive'
import { parseMoney, parseQuantity, moneySymbolKey, moneyPlaceholder } from '@/lib/money'
import { createProducts, findProductsByBarcodes } from './useProducts'
import { composeName } from './naming'
import { useCategories, createCategory } from '@/features/categories/useCategories'
import { useSuppliers, createSupplier } from '@/features/suppliers/useSuppliers'
import type { ProductInput } from '@/types/models'

/** Sentinel option value meaning "type a new one". */
const NEW = '__new__'

interface VariantRow {
  key: string
  variant: string
  barcode: string
  /** Empty = use the price shared by the whole family. */
  salePrice: string
  /** Empty = use the quantity shared by the whole family. */
  quantity: string
}

let rowSeq = 0
const blankRow = (): VariantRow => ({
  key: `row-${++rowSeq}`,
  variant: '',
  barcode: '',
  salePrice: '',
  quantity: '',
})

interface VariantsDialogProps {
  open: boolean
  onClose: () => void
  /** Called with how many products were created, so the page can say so. */
  onSaved?: (count: number) => void
}

/**
 * "Un stylo, plusieurs sortes." The owner types the family and the shared
 * numbers once, then one line per kind. Every kind is still saved as its own
 * product — its own barcode, price, stock and profit — in a single batch.
 */
export function VariantsDialog({ open, onClose, onSaved }: VariantsDialogProps) {
  const { t } = useTranslation()
  const alive = useAlive()
  const familyRef = useRef<HTMLInputElement>(null)
  const variantRefs = useRef<Array<HTMLInputElement | null>>([])
  const { categories } = useCategories()
  const { suppliers } = useSuppliers()

  const [family, setFamily] = useState('')
  const [category, setCategory] = useState('')
  const [supplier, setSupplier] = useState('')
  const [unit, setUnit] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [threshold, setThreshold] = useState('')
  const [rows, setRows] = useState<VariantRow[]>([blankRow(), blankRow()])
  const [familyError, setFamilyError] = useState('')
  const [saveError, setSaveError] = useState('')
  /**
   * A barcode already in use, once the owner has been told. Shared codes are
   * allowed — the till asks which article when one is scanned — so this is a
   * warning he can accept rather than a wall.
   */
  const [sharedWarning, setSharedWarning] = useState('')
  const sharedOk = sharedWarning !== ''
  const [busy, setBusy] = useState(false)
  const [newCategory, setNewCategory] = useState(false)
  const [newSupplier, setNewSupplier] = useState(false)

  useEffect(() => {
    if (!open) return
    setFamily('')
    setCategory('')
    setSupplier('')
    setUnit('')
    setCostPrice('')
    setSalePrice('')
    setQuantity('')
    setThreshold('')
    setRows([blankRow(), blankRow()])
    setFamilyError('')
    setSaveError('')
    setBusy(false)
    setNewCategory(false)
    setNewSupplier(false)
    variantRefs.current = []
    setTimeout(() => familyRef.current?.focus(), 50)
  }, [open])

  const symbol = t(moneySymbolKey())
  const categoryNames = categories.map((c) => c.name)
  const supplierNames = suppliers.map((s) => s.name)
  const categoryIsFree = newCategory || (category !== '' && !categoryNames.includes(category))
  const supplierIsFree = newSupplier || (supplier !== '' && !supplierNames.includes(supplier))

  const sharedCost = parseMoney(costPrice) ?? 0
  const sharedSale = parseMoney(salePrice) ?? 0
  const sharedQty = parseQuantity(quantity) ?? 0
  const sharedThreshold = parseQuantity(threshold) ?? 0

  const filledRows = rows.filter((r) => r.variant.trim() !== '')
  const belowCost =
    sharedCost > 0 &&
    filledRows.some((r) => {
      const price = r.salePrice.trim() === '' ? sharedSale : (parseMoney(r.salePrice) ?? 0)
      return price > 0 && price < sharedCost
    })

  const patchRow = (key: string, patch: Partial<VariantRow>) => {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    setSaveError('')
  }

  const addRow = () => {
    setRows((current) => [...current, blankRow()])
  }

  const removeRow = (key: string) => {
    setRows((current) =>
      current.length > 1 ? current.filter((r) => r.key !== key) : current,
    )
  }

  /** Enter in a kind field jumps to the next one, adding a line at the end. */
  const onVariantKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const isLast = index === rows.length - 1
    if (isLast) addRow()
    setTimeout(() => variantRefs.current[index + 1]?.focus(), 30)
  }

  const pickCategory = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.currentTarget.value
    if (value === NEW) {
      setNewCategory(true)
      setCategory('')
    } else {
      setNewCategory(false)
      setCategory(value)
    }
  }

  const pickSupplier = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.currentTarget.value
    if (value === NEW) {
      setNewSupplier(true)
      setSupplier('')
    } else {
      setNewSupplier(false)
      setSupplier(value)
    }
  }

  const ensureCategory = async (nm: string) => {
    if (nm === '' || categoryNames.includes(nm)) return
    try {
      await createCategory(nm)
    } catch {
      // Saving the products matters more than seeding the list.
    }
  }

  const ensureSupplier = async (nm: string) => {
    if (nm === '' || supplierNames.includes(nm)) return
    try {
      await createSupplier({ name: nm })
    } catch {
      // Saving the products matters more than seeding the list.
    }
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFamilyError('')
    setSaveError('')

    const familyName = family.trim()
    if (familyName === '') {
      setFamilyError(t('stock.nameRequired'))
      return
    }
    if (filledRows.length === 0) {
      setSaveError(t('stock.nameRequired'))
      return
    }

    // Two lines sharing one barcode is usually a slip, so it is worth saying —
    // but it is allowed: the same printed code really does turn up on different
    // articles, and the till asks which one when it is scanned. Warn once, then
    // let the second click through.
    const seen = new Map<string, string>()
    for (const row of filledRows) {
      const code = row.barcode.trim()
      if (code === '') continue
      const other = seen.get(code)
      if (other && !sharedOk) {
        setSharedWarning(t('stock.barcodeShared', { name: other }))
        return
      }
      seen.set(code, composeName(familyName, row.variant))
    }

    const inputs: ProductInput[] = filledRows.map((row) => {
      const rowSale = row.salePrice.trim() === '' ? null : parseMoney(row.salePrice)
      const rowQty = row.quantity.trim() === '' ? null : Number(row.quantity)
      return {
        barcode: row.barcode.trim() || null,
        name: composeName(familyName, row.variant),
        family: familyName,
        variant: row.variant.trim(),
        unit: unit.trim() || undefined,
        category: category.trim() || undefined,
        supplier: supplier.trim() || undefined,
        costPrice: sharedCost,
        salePrice: rowSale ?? sharedSale,
        quantity: rowQty === null ? sharedQty : Math.max(0, Math.trunc(rowQty || 0)),
        lowStockThreshold: sharedThreshold,
      }
    })

    setBusy(true)
    try {
      const codes = inputs.map((i) => i.barcode ?? '').filter((c) => c !== '')
      if (codes.length > 0 && !sharedOk) {
        const owners = await findProductsByBarcodes(codes)
        if (!alive.current) return
        const clash = codes.find((c) => owners.has(c))
        if (clash) {
          setSharedWarning(
            t('stock.barcodeShared', { name: owners.get(clash)?.name ?? clash }),
          )
          return
        }
      }
      await ensureCategory(category.trim())
      await ensureSupplier(supplier.trim())
      const count = await createProducts(inputs)
      if (alive.current) {
        onSaved?.(count)
        onClose()
      }
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
      size="xl"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <HStack gap={3}>
                <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                  <Layers size={22} />
                </Box>
                <Dialog.Title>{t('stock.addVariants')}</Dialog.Title>
              </HStack>
              <Dialog.CloseTrigger asChild>
                <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                  <X size={18} />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <form id="variants-form" onSubmit={submit}>
                <Stack gap={5}>
                  <Text color="fg.muted">{t('stock.addVariantsHint')}</Text>

                  <Field.Root required invalid={!!familyError}>
                    <Field.Label>{t('stock.family')}</Field.Label>
                    <Input
                      ref={familyRef}
                      size="xl"
                      value={family}
                      onChange={(e) => {
                        setFamily(e.target.value)
                        setFamilyError('')
                      }}
                      placeholder={t('stock.familyPlaceholder')}
                    />
                    <Field.ErrorText>{familyError}</Field.ErrorText>
                    {!familyError && (
                      <Field.HelperText>{t('stock.familyHint')}</Field.HelperText>
                    )}
                  </Field.Root>

                  {/* Everything the kinds have in common, typed once. */}
                  <Card.Root variant="subtle">
                    <Card.Body>
                      <Stack gap={4}>
                        <Text fontWeight="semibold">{t('stock.sameForAll')}</Text>

                        <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                          <Field.Root>
                            <Field.Label>{t('stock.category')}</Field.Label>
                            <NativeSelect.Root size="lg">
                              <NativeSelect.Field
                                value={categoryIsFree ? NEW : category}
                                onChange={pickCategory}
                              >
                                <option value="">{t('common.select')}</option>
                                {categoryNames.map((nm) => (
                                  <option key={nm} value={nm}>
                                    {nm}
                                  </option>
                                ))}
                                <option value={NEW}>{t('common.add')}</option>
                              </NativeSelect.Field>
                              <NativeSelect.Indicator />
                            </NativeSelect.Root>
                            {categoryIsFree && (
                              <Input
                                size="lg"
                                mt={2}
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder={t('stock.category')}
                              />
                            )}
                          </Field.Root>

                          <Field.Root>
                            <Field.Label>{t('stock.supplier')}</Field.Label>
                            <NativeSelect.Root size="lg">
                              <NativeSelect.Field
                                value={supplierIsFree ? NEW : supplier}
                                onChange={pickSupplier}
                              >
                                <option value="">{t('common.select')}</option>
                                {supplierNames.map((nm) => (
                                  <option key={nm} value={nm}>
                                    {nm}
                                  </option>
                                ))}
                                <option value={NEW}>{t('common.add')}</option>
                              </NativeSelect.Field>
                              <NativeSelect.Indicator />
                            </NativeSelect.Root>
                            {supplierIsFree && (
                              <Input
                                size="lg"
                                mt={2}
                                value={supplier}
                                onChange={(e) => setSupplier(e.target.value)}
                                placeholder={t('stock.supplier')}
                              />
                            )}
                          </Field.Root>
                        </SimpleGrid>

                        <SimpleGrid columns={{ base: 2, sm: 4 }} gap={4}>
                          <Field.Root>
                            <Field.Label>{`${t('stock.costPrice')} (${symbol})`}</Field.Label>
                            <Input
                              size="lg"
                              value={costPrice}
                              onChange={(e) => setCostPrice(e.target.value)}
                              inputMode="decimal"
                              placeholder={moneyPlaceholder()}
                            />
                          </Field.Root>
                          <Field.Root>
                            <Field.Label>{`${t('stock.salePrice')} (${symbol})`}</Field.Label>
                            <Input
                              size="lg"
                              value={salePrice}
                              onChange={(e) => setSalePrice(e.target.value)}
                              inputMode="decimal"
                              placeholder={moneyPlaceholder()}
                            />
                          </Field.Root>
                          <Field.Root>
                            <Field.Label>{t('stock.quantity')}</Field.Label>
                            <Input
                              size="lg"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              inputMode="numeric"
                              placeholder="0"
                            />
                          </Field.Root>
                          <Field.Root>
                            <Field.Label>{t('stock.lowStockThreshold')}</Field.Label>
                            <Input
                              size="lg"
                              value={threshold}
                              onChange={(e) => setThreshold(e.target.value)}
                              inputMode="numeric"
                              placeholder="0"
                            />
                          </Field.Root>
                        </SimpleGrid>

                        <Field.Root>
                          <Field.Label>{t('stock.unit')}</Field.Label>
                          <Input
                            size="lg"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            placeholder={t('stock.unitPlaceholder')}
                          />
                          <Field.HelperText>{t('common.optional')}</Field.HelperText>
                        </Field.Root>
                      </Stack>
                    </Card.Body>
                  </Card.Root>

                  {/* One line per kind. */}
                  <Stack gap={3}>
                    <Text fontWeight="semibold">{t('stock.variants')}</Text>
                    <Box overflowX="auto">
                      <Table.Root size="md">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader>{t('stock.variant')}</Table.ColumnHeader>
                            <Table.ColumnHeader>{t('stock.barcode')}</Table.ColumnHeader>
                            <Table.ColumnHeader>
                              {`${t('stock.salePrice')} (${symbol})`}
                            </Table.ColumnHeader>
                            <Table.ColumnHeader>{t('stock.quantity')}</Table.ColumnHeader>
                            <Table.ColumnHeader />
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {rows.map((row, index) => (
                            <Table.Row key={row.key}>
                              <Table.Cell minW="12rem">
                                <Input
                                  ref={(el: HTMLInputElement | null) => {
                                    variantRefs.current[index] = el
                                  }}
                                  size="lg"
                                  value={row.variant}
                                  onChange={(e) =>
                                    patchRow(row.key, { variant: e.target.value })
                                  }
                                  onKeyDown={(e) => onVariantKeyDown(e, index)}
                                  placeholder={t('stock.variantPlaceholder')}
                                />
                              </Table.Cell>
                              <Table.Cell minW="11rem">
                                <Input
                                  size="lg"
                                  value={row.barcode}
                                  onChange={(e) =>
                                    patchRow(row.key, { barcode: e.target.value })
                                  }
                                  inputMode="numeric"
                                  placeholder={t('stock.barcodePlaceholder')}
                                />
                              </Table.Cell>
                              <Table.Cell minW="8rem">
                                <Input
                                  size="lg"
                                  value={row.salePrice}
                                  onChange={(e) =>
                                    patchRow(row.key, { salePrice: e.target.value })
                                  }
                                  inputMode="decimal"
                                  placeholder={salePrice || '0.000'}
                                />
                              </Table.Cell>
                              <Table.Cell minW="7rem">
                                <Input
                                  size="lg"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    patchRow(row.key, { quantity: e.target.value })
                                  }
                                  inputMode="numeric"
                                  placeholder={quantity || '0'}
                                />
                              </Table.Cell>
                              <Table.Cell>
                                <IconButton
                                  type="button"
                                  aria-label={t('common.remove')}
                                  title={t('common.remove')}
                                  size="lg"
                                  variant="ghost"
                                  colorPalette="red"
                                  disabled={rows.length <= 1}
                                  onClick={() => removeRow(row.key)}
                                >
                                  <Trash2 size={20} />
                                </IconButton>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </Box>

                    <Box>
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        colorPalette="brand"
                        onClick={addRow}
                      >
                        <Plus size={20} />
                        {t('stock.addVariantRow')}
                      </Button>
                    </Box>
                  </Stack>

                  {belowCost && (
                    <Alert.Root status="warning">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{t('stock.priceBelowCost')}</Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  {sharedWarning && (
                    <Alert.Root status="warning">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{sharedWarning}</Alert.Title>
                        <Alert.Description>{t('stock.sharedCodeHint')}</Alert.Description>
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
              <Text color="fg.muted" me="auto">
                {t('stock.variantsCount', { count: filledRows.length })}
              </Text>
              <Button size="lg" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                size="lg"
                type="submit"
                form="variants-form"
                colorPalette={sharedOk ? 'orange' : 'brand'}
                loading={busy}
                loadingText={t('common.saving')}
              >
                {sharedOk ? t('stock.saveAnyway') : t('common.save')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
