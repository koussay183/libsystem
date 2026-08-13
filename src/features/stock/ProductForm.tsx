import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  Dialog,
  Field,
  HStack,
  IconButton,
  Input,
  InputGroup,
  NativeSelect,
  Portal,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react'
import { Copy, Package, ScanLine, X, Zap } from 'lucide-react'
import { useAlive } from '@/lib/useAlive'
import { fromMinor, parseMoney, parseQuantity, marginPercent } from '@/lib/money'
import { formatPercent } from '@/lib/format'
import { createProduct, updateProduct, findProductByBarcode } from './useProducts'
import { composeName } from './naming'
import { useCategories, createCategory } from '@/features/categories/useCategories'
import { useSuppliers, createSupplier } from '@/features/suppliers/useSuppliers'
import type { Product, ProductInput } from '@/types/models'

interface ProductFormProps {
  open: boolean
  onClose: () => void
  product?: Product | null
  initialBarcode?: string
  /** Pre-fills the NAME when the owner searched for words, not a code. */
  initialName?: string
  /** Pre-fills a brand-new product from an existing one — barcode stays empty. */
  template?: Product | null
  /** Opens on the short path: only the name and the sale price are asked for. */
  quick?: boolean
}

const money = (minor: number) => (minor ? String(fromMinor(minor)) : '')

/** Sentinel option value meaning "type a new one". */
const NEW = '__new__'

export function ProductForm({
  open,
  onClose,
  product,
  initialBarcode,
  initialName,
  template,
  quick = false,
}: ProductFormProps) {
  const { t } = useTranslation()
  const alive = useAlive()
  const nameRef = useRef<HTMLInputElement>(null)
  const { categories } = useCategories()
  const { suppliers } = useSuppliers()

  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [family, setFamily] = useState('')
  const [variant, setVariant] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const [supplier, setSupplier] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [threshold, setThreshold] = useState('')
  const [nameError, setNameError] = useState('')
  const [priceError, setPriceError] = useState('')
  const [barcodeError, setBarcodeError] = useState('')
  /**
   * The article that already carries this barcode, once the owner has been
   * told. Two genuinely different products can share a printed code — cheap
   * imported stock does it all the time — so this is a warning he can accept,
   * not a refusal. The till asks him which one when such a code is scanned.
   */
  const [twin, setTwin] = useState<{ code: string; name: string } | null>(null)
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [short, setShort] = useState(false)
  const [newCategory, setNewCategory] = useState(false)
  const [newSupplier, setNewSupplier] = useState(false)

  /** Last name we composed ourselves — lets us stop overwriting a typed one. */
  const autoName = useRef('')

  useEffect(() => {
    if (!open) return
    // Editing works on the product; "Dupliquer" copies everything but the code.
    const source = product ?? template ?? null
    setBarcode(product?.barcode ?? initialBarcode ?? '')
    setTwin(null)
    setName(source?.name ?? initialName ?? '')
    setFamily(source?.family ?? '')
    setVariant(product?.variant ?? '')
    setUnit(source?.unit ?? '')
    setCategory(source?.category ?? '')
    setSupplier(source?.supplier ?? '')
    setCostPrice(money(source?.costPrice ?? 0))
    setSalePrice(money(source?.salePrice ?? 0))
    setQuantity(product ? String(product.quantity) : '')
    setThreshold(source ? String(source.lowStockThreshold) : '')
    setNameError('')
    setPriceError('')
    setBarcodeError('')
    setSaveError('')
    setBusy(false)
    setShort(product ? false : quick)
    setNewCategory(false)
    setNewSupplier(false)
    autoName.current = source?.name ?? ''
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [open, product, template, initialBarcode, quick])

  const symbol = t('money.symbol')
  const costMinor = parseMoney(costPrice) ?? 0
  const saleMinor = parseMoney(salePrice) ?? 0
  const margin = marginPercent(costMinor, saleMinor)
  const belowCost = saleMinor > 0 && costMinor > 0 && saleMinor < costMinor
  const categoryNames = categories.map((c) => c.name)
  const supplierNames = suppliers.map((s) => s.name)

  // A value typed by hand (or not yet loaded) keeps the free-text input visible.
  const categoryIsFree = newCategory || (category !== '' && !categoryNames.includes(category))
  const supplierIsFree = newSupplier || (supplier !== '' && !supplierNames.includes(supplier))

  /** Keeps `name` in step with family/variant until the owner types his own. */
  const syncName = (nextFamily: string, nextVariant: string) => {
    const composed = composeName(nextFamily, nextVariant)
    setName((current) =>
      current.trim() === '' || current === autoName.current ? composed : current,
    )
    autoName.current = composed
  }

  const onFamilyChange = (value: string) => {
    setFamily(value)
    syncName(value, variant)
  }

  const onVariantChange = (value: string) => {
    setVariant(value)
    syncName(family, value)
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

  /** Keeps the shared category/supplier lists in sync, as the old combobox did. */
  const ensureCategory = async (nm: string) => {
    if (nm === '' || categoryNames.includes(nm)) return
    try {
      await createCategory(nm)
    } catch {
      // Saving the product matters more than seeding the list.
    }
  }

  const ensureSupplier = async (nm: string) => {
    if (nm === '' || supplierNames.includes(nm)) return
    try {
      await createSupplier({ name: nm })
    } catch {
      // Saving the product matters more than seeding the list.
    }
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setNameError('')
    setPriceError('')
    setBarcodeError('')
    setSaveError('')

    if (name.trim() === '') {
      setNameError(t('stock.nameRequired'))
      return
    }
    // On the short path the sale price is the only other thing we insist on —
    // a product the till cannot price is useless.
    if (short && saleMinor <= 0) {
      setPriceError(t('common.required'))
      return
    }

    const input: ProductInput = {
      barcode: barcode.trim() || null,
      name: name.trim(),
      family: family.trim() || undefined,
      variant: variant.trim() || undefined,
      unit: unit.trim() || undefined,
      category: category.trim() || undefined,
      supplier: supplier.trim() || undefined,
      costPrice: costMinor,
      salePrice: saleMinor,
      quantity: parseQuantity(quantity) ?? 0,
      lowStockThreshold: parseQuantity(threshold) ?? 0,
    }

    setBusy(true)
    try {
      // A barcode that already belongs to another article is worth saying out
      // loud — it is usually a mistake — but it is not forbidden: two different
      // products really can carry the same printed code, and the till handles
      // it by asking which one. So the first save warns, the second goes ahead.
      if (input.barcode && twin?.code !== input.barcode) {
        const owner = await findProductByBarcode(input.barcode)
        if (!alive.current) return
        if (owner && owner.id !== product?.id) {
          setTwin({ code: input.barcode, name: owner.name })
          return
        }
      }
      await ensureCategory(input.category ?? '')
      await ensureSupplier(input.supplier ?? '')
      if (product) await updateProduct(product.id, input)
      else await createProduct(input)
      if (alive.current) onClose()
    } catch (err) {
      if (alive.current) {
        setSaveError(err instanceof Error ? err.message : t('common.error'))
      }
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const title = product
    ? t('stock.editProduct')
    : template
      ? t('stock.duplicate')
      : short
        ? t('stock.quickAdd')
        : t('stock.addProduct')

  return (
    <Dialog.Root scrollBehavior="inside"
      open={open}
      onOpenChange={(e) => {
        if (!e.open) onClose()
      }}
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <HStack gap={3}>
                <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                  {template ? (
                    <Copy size={22} />
                  ) : short ? (
                    <Zap size={22} />
                  ) : (
                    <Package size={22} />
                  )}
                </Box>
                <Dialog.Title>{title}</Dialog.Title>
              </HStack>
              <Dialog.CloseTrigger asChild>
                <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                  <X size={18} />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <form id="product-form" onSubmit={submit}>
                <Stack gap={4}>
                  {/* The short path: name + sale price and nothing else. */}
                  {!product && (
                    <Switch.Root
                      size="lg"
                      colorPalette="brand"
                      checked={short}
                      onCheckedChange={(e: { checked: boolean }) => setShort(e.checked)}
                    >
                      <Switch.HiddenInput />
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Label>
                        <Stack gap={0}>
                          <Text fontWeight="semibold">{t('stock.quickAdd')}</Text>
                          <Text fontSize="sm" color="fg.muted">
                            {t('stock.quickAddHint')}
                          </Text>
                        </Stack>
                      </Switch.Label>
                    </Switch.Root>
                  )}

                  <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                    <Field.Root required invalid={!!nameError}>
                      <Field.Label>{t('stock.name')}</Field.Label>
                      <Input
                        ref={nameRef}
                        size="lg"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('stock.namePlaceholder')}
                      />
                      <Field.ErrorText>{nameError}</Field.ErrorText>
                    </Field.Root>

                    <Field.Root invalid={!!barcodeError}>
                      <Field.Label>{t('stock.barcode')}</Field.Label>
                      <InputGroup
                        startElement={
                          <Box color="fg.muted">
                            <ScanLine size={20} />
                          </Box>
                        }
                      >
                        <Input
                          size="lg"
                          value={barcode}
                          onChange={(e) => {
                            setBarcode(e.target.value)
                            setBarcodeError('')
                            setTwin(null)
                          }}
                          placeholder={t('stock.barcodePlaceholder')}
                          inputMode="numeric"
                        />
                      </InputGroup>
                      <Field.ErrorText>{barcodeError}</Field.ErrorText>
                      {!barcodeError && !twin && (
                        <Field.HelperText>{t('common.optional')}</Field.HelperText>
                      )}
                    </Field.Root>
                  </SimpleGrid>

                  {/* Family + kind: the same pen in several colours. */}
                  {!short && (
                    <SimpleGrid columns={{ base: 1, sm: 3 }} gap={4}>
                      <Field.Root>
                        <Field.Label>{t('stock.family')}</Field.Label>
                        <Input
                          size="lg"
                          value={family}
                          onChange={(e) => onFamilyChange(e.target.value)}
                          placeholder={t('stock.familyPlaceholder')}
                        />
                        <Field.HelperText>{t('stock.familyHint')}</Field.HelperText>
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>{t('stock.variant')}</Field.Label>
                        <Input
                          size="lg"
                          value={variant}
                          onChange={(e) => onVariantChange(e.target.value)}
                          placeholder={t('stock.variantPlaceholder')}
                        />
                        <Field.HelperText>{t('stock.variantHint')}</Field.HelperText>
                      </Field.Root>

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
                    </SimpleGrid>
                  )}

                  {/* Category + supplier: pick an existing one or type a new one */}
                  {!short && (
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
                        <Field.HelperText>{t('common.optional')}</Field.HelperText>
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
                        <Field.HelperText>{t('common.optional')}</Field.HelperText>
                      </Field.Root>
                    </SimpleGrid>
                  )}

                  <SimpleGrid columns={2} gap={4}>
                    {!short && (
                      <Field.Root>
                        <Field.Label>{`${t('stock.costPrice')} (${symbol})`}</Field.Label>
                        <Input
                          size="lg"
                          value={costPrice}
                          onChange={(e) => setCostPrice(e.target.value)}
                          inputMode="decimal"
                          placeholder="0.000"
                        />
                      </Field.Root>
                    )}
                    <Field.Root required={short} invalid={!!priceError}>
                      <Field.Label>{`${t('stock.salePrice')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        value={salePrice}
                        onChange={(e) => {
                          setSalePrice(e.target.value)
                          setPriceError('')
                        }}
                        inputMode="decimal"
                        placeholder="0.000"
                      />
                      <Field.ErrorText>{priceError}</Field.ErrorText>
                    </Field.Root>
                  </SimpleGrid>

                  {/* A warning, never a wall: the shop sometimes sells at a loss. */}
                  {belowCost && (
                    <Alert.Root status="warning">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{t('stock.priceBelowCost')}</Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  {margin !== null && !belowCost && (
                    <Text fontSize="sm" color="fg.muted">
                      {t('stock.margin')}:{' '}
                      <Text as="span" fontWeight="semibold" color="green.600">
                        {formatPercent(margin)}
                      </Text>
                    </Text>
                  )}

                  <SimpleGrid columns={2} gap={4}>
                    {/* Editing never sets the count: this dialog holds the
                        quantity captured when it opened, so saving would undo
                        any sale rung up meanwhile. Restocking and inventory
                        corrections go through the dedicated stock dialog. */}
                    {!product && (
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
                    )}
                    {product && (
                      <Field.Root>
                        <Field.Label>{t('stock.quantity')}</Field.Label>
                        <Input size="lg" value={product.quantity} readOnly disabled />
                        <Field.HelperText>{t('stock.restock')}</Field.HelperText>
                      </Field.Root>
                    )}
                    {!short && (
                      <Field.Root>
                        <Field.Label>{t('stock.lowStockThreshold')}</Field.Label>
                        <Input
                          size="lg"
                          value={threshold}
                          onChange={(e) => setThreshold(e.target.value)}
                          inputMode="numeric"
                          placeholder="0"
                        />
                        <Field.HelperText>{t('common.optional')}</Field.HelperText>
                      </Field.Root>
                    )}
                  </SimpleGrid>

                  {/* Not an error: the owner is being told, and may go ahead. */}
                  {twin && (
                    <Alert.Root status="warning">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>
                          {t('stock.barcodeShared', { name: twin.name })}
                        </Alert.Title>
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
              <Button size="lg" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                size="lg"
                type="submit"
                form="product-form"
                colorPalette={twin ? 'orange' : 'brand'}
                loading={busy}
                loadingText={t('common.saving')}
              >
                {twin ? t('stock.saveAnyway') : t('common.save')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
