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
  SegmentGroup,
  Switch,
  Text,
} from '@chakra-ui/react'
import { Check, Copy, Package, ScanLine, X, Zap } from 'lucide-react'
import { useAlive } from '@/lib/useAlive'
import { toInput, parseMoney, parseQuantity, moneySymbolKey, moneyPlaceholder } from '@/lib/money'
import { formatPercent } from '@/lib/format'
import { createProduct, updateProduct, findProductByBarcode } from './useProducts'
import {
  VAT_RATES,
  ttcFromHt,
  htFromTtc,
  saleFromCost,
  marginFromPrices,
  defaultMarginFor,
  defaultVatFor,
  parsePercent,
} from './pricing'
import { useShopSettings } from '@/features/settings/useShopSettings'
import { composeName } from './naming'
import { useCategories, createCategory } from '@/features/categories/useCategories'
import { useSuppliers, createSupplier } from '@/features/suppliers/useSuppliers'
import type { Product, ProductInput } from '@/types/models'
import { lookupCatalog, contributeToCatalog } from '@/lib/catalog'
import type { CatalogEntry } from '@/lib/catalog'

interface ProductFormProps {
  open: boolean
  onClose: () => void
  product?: Product | null
  initialBarcode?: string
  /** Pre-fills the NAME when the owner searched for words, not a code. */
  initialName?: string
  /**
   * A name that came out of the SHARED CATALOGUE rather than out of this shop.
   *
   * Separate from initialName on purpose. initialName carries the owner's own
   * typed words from the stock search, which is a genuine opinion worth
   * contributing back. This carries somebody else's, and a shop that saves it
   * unchanged has agreed to a name, not witnessed one — see ContributeOptions
   * in lib/catalog.ts for why counting that as agreement is how a typo spreads.
   */
  seededName?: string
  /** Pre-fills a brand-new product from an existing one — barcode stays empty. */
  template?: Product | null
  /** Opens on the short path: only the name and the sale price are asked for. */
  quick?: boolean
}

/** Sentinel option value meaning "type a new one". */
const NEW = '__new__'

export function ProductForm({
  open,
  onClose,
  product,
  initialBarcode,
  initialName,
  seededName,
  template,
  quick = false,
}: ProductFormProps) {
  const { t } = useTranslation()
  const alive = useAlive()
  const nameRef = useRef<HTMLInputElement>(null)
  const { categories } = useCategories()
  const { suppliers } = useSuppliers()
  const { shop } = useShopSettings()

  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [family, setFamily] = useState('')
  const [variant, setVariant] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const [supplier, setSupplier] = useState('')
  /**
   * Four numbers that describe one thing, so they are kept in step instead of
   * being worked out on paper:
   *
   *   achat HT  --+ TVA -->  achat TTC  --+ marge -->  prix de vente
   *
   * Typing in any of them recomputes the ones downstream, and typing a sale
   * price works backwards to the margin it implies. Nothing is locked: the
   * owner can always overrule the arithmetic.
   */
  const [costHT, setCostHT] = useState('')
  const [vat, setVat] = useState<number>(() => defaultVatFor(shop))
  const [costPrice, setCostPrice] = useState('')
  const [marginText, setMarginText] = useState('')
  const [salePrice, setSalePrice] = useState('')
  /** Once he sets a margin himself, the category stops overriding it. */
  const marginTouched = useRef(false)
  const [quantity, setQuantity] = useState('')
  const [threshold, setThreshold] = useState('')
  const [nameError, setNameError] = useState('')
  const [priceError, setPriceError] = useState('')
  const [barcodeError, setBarcodeError] = useState('')
  /**
   * The name the CATALOGUE proposed, kept even after the panel is dismissed.
   *
   * Separate from `recognised`, which is the panel's visibility and goes to null
   * the moment the owner answers it. This has to outlive that: the check it
   * feeds happens at save time, and the question it answers is "is the name
   * being contributed merely the one we were handed?" — see ContributeOptions
   * in lib/catalog.ts.
   */
  const [offered, setOffered] = useState('')

  /**
   * The catalogue answered for this barcode. Shown, not just applied: the value
   * of a shared catalogue is entirely in the owner KNOWING his shop recognised
   * an article nobody here has ever stocked.
   */
  const [recognised, setRecognised] = useState<CatalogEntry | null>(null)
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
    const cost = source?.costPrice ?? 0
    const sale = source?.salePrice ?? 0
    const rate = source?.vatRate ?? defaultVatFor(shop)
    setVat(rate)
    setCostPrice(toInput(cost))
    // No stored HT means the article predates the split — derive it from what
    // the shop paid rather than showing an empty field.
    setCostHT(toInput(source?.costPriceHT ?? (cost > 0 ? htFromTtc(cost, rate) : 0)))
    setSalePrice(toInput(sale))
    const known =
      source?.margin ??
      (cost > 0 && sale > 0 ? marginFromPrices(cost, sale) : null) ??
      defaultMarginFor(source?.category, shop)
    setMarginText(known === null ? '' : String(Math.round(known * 10) / 10))
    marginTouched.current = source?.margin !== undefined
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

    /*
      Ask the shared catalogue what this barcode is called, but only for a NEW
      article that arrived with a code and no name.

      The three guards are each doing real work. Editing an existing product must
      never have its name replaced by somebody else's idea of it. A duplicate
      ("Dupliquer") already carries the name the owner is copying. And a form
      opened with a name already in it — from the till's miss tail, or from a
      template — has an answer better than the catalogue's, because it came from
      this shop.

      The write into state is guarded again on arrival: the request is on a 700 ms
      deadline and the owner may well have typed by then, and taking the field out
      from under him would be worse than not helping.
    */
    setRecognised(null)
    setOffered(seededName ?? '')
    if (!product && !template && (initialBarcode ?? '') !== '' && (initialName ?? '') === '') {
      void lookupCatalog(initialBarcode).then((hit) => {
        if (!hit) return
        /*
          OFFERED, NOT APPLIED — and it used to be applied.

          These three lines wrote another shop’s name, unit and category
          straight into the form. That is the whole of the bug the owner
          reported: a bookshop somewhere typed “cahier 24 componser”, it
          reached the shared catalogue on nothing but its own say-so, and from
          then on every other shop scanning that code got the misspelling typed
          in for them. People accept what is already in the box — so the typo
          travelled, and the shop that received it had no way of knowing it had
          not typed it itself.

          Nothing from another shop now reaches this product unless the owner
          reads it and presses the button in the panel below. The catalogue
          keeps its whole value — he still does not have to KNOW the name, only
          to agree to it — and loses the one property that made it dangerous.
        */
        setRecognised(hit)
        setOffered(hit.name)
      })
    }
  }, [open, product, template, initialBarcode, initialName, seededName, quick, shop])

  const symbol = t(moneySymbolKey())

  /**
   * One handler per field. Each writes the fields DOWNSTREAM of itself and
   * nothing else, so there is no effect loop and no field ever fights the
   * hand that is typing in it.
   */
  const priceFrom = (ttcMinor: number, percentText: string) => {
    const pct = parsePercent(percentText)
    if (pct === null) return
    setSalePrice(toInput(saleFromCost(ttcMinor, pct)))
  }

  const applyHt = (text: string) => {
    setCostHT(text)
    const ht = parseMoney(text)
    if (ht === null) return
    const ttc = ttcFromHt(ht, vat)
    setCostPrice(toInput(ttc))
    priceFrom(ttc, marginText)
  }

  const applyVat = (next: number) => {
    setVat(next)
    const ht = parseMoney(costHT)
    if (ht === null) return
    const ttc = ttcFromHt(ht, next)
    setCostPrice(toInput(ttc))
    priceFrom(ttc, marginText)
  }

  const applyTtc = (text: string) => {
    setCostPrice(text)
    const ttc = parseMoney(text)
    if (ttc === null) return
    setCostHT(toInput(htFromTtc(ttc, vat)))
    priceFrom(ttc, marginText)
  }

  const applyMargin = (text: string) => {
    setMarginText(text)
    marginTouched.current = true
    const ttc = parseMoney(costPrice)
    if (ttc === null) return
    priceFrom(ttc, text)
  }

  /** Typing the shelf price he wants works backwards to the margin it implies. */
  const applySale = (text: string) => {
    setSalePrice(text)
    setPriceError('')
    const sale = parseMoney(text)
    const ttc = parseMoney(costPrice)
    if (sale === null || ttc === null || ttc <= 0) return
    const pct = marginFromPrices(ttc, sale)
    if (pct !== null) setMarginText(String(Math.round(pct * 10) / 10))
  }

  /**
   * Paper goods carry a thinner margin than the rest, so choosing the category
   * sets it — until the owner overrules it, after which it is his.
   */
  const applyCategory = (next: string) => {
    setCategory(next)
    if (marginTouched.current) return
    const pct = defaultMarginFor(next, shop)
    setMarginText(String(pct))
    const ttc = parseMoney(costPrice)
    if (ttc !== null) priceFrom(ttc, String(pct))
  }

  const costMinor = parseMoney(costPrice) ?? 0
  const saleMinor = parseMoney(salePrice) ?? 0
  /**
   * The readout under the price fields, and it has to be the SAME definition of
   * margin as the field the owner typed into three rows above: `saleFromCost`
   * put the sale price there as cost x (1 + marge/100), so only
   * `marginFromPrices` reads it back as the number he entered. This used to call
   * `money.marginPercent`, which was margin of the sale price, so cost 1000 and
   * marge 35 showed a sale price of 1350 and a readout of "25,9 %" — one dialog,
   * two answers, both called marge. That function is now gone; see the note left
   * where it lived in src/lib/money.ts.
   *
   * Guarded on the sale price as well as on the cost, because margin on cost is
   * -100 % for a sale price of nothing, and an empty field must read as no
   * answer rather than as a 100 % loss.
   */
  const actualMargin = saleMinor > 0 ? marginFromPrices(costMinor, saleMinor) : null
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
      applyCategory('')
    } else {
      setNewCategory(false)
      applyCategory(value)
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
    /*
      A PRICE IS INSISTED ON FOR EVERY NEW ARTICLE, not only on the short path.

      `short` is a switch the owner can flip, not a code path, so this read as
      "a product the till cannot price is useless — unless you happened to turn
      the toggle off". Both other ways into this form arrive with it off: the
      catalogue's Ajouter button and the stock screen's "code not found". Both
      therefore wrote articles at 0,000 DT that rang up nothing on every till in
      the shop.

      Creates only. An article ALREADY saved at zero must stay editable, or the
      form would refuse to open the very products that need repairing.
    */
    if (!product && saleMinor <= 0) {
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
      costPriceHT: parseMoney(costHT) ?? undefined,
      vatRate: vat,
      costPrice: costMinor,
      margin: parsePercent(marginText) ?? undefined,
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
      // Only a NEW article is offered to the shared catalogue. An edit is very
      // often the owner correcting a name for his own shelf — "Cahier 96p (bleu)"
      // — and a local correction is not a better answer for everybody else.
      if (!product)
        contributeToCatalog(input.barcode, input.name, {
          // What the catalogue proposed, whether it arrived through the
          // recognised panel or straight off the catalogue browser. A name that
          // only repeats it is an echo and is not contributed — see
          // ContributeOptions in lib/catalog.ts.
          seed: offered || seededName,
          unit: input.unit ?? undefined,
          category: input.category ?? undefined,
        })
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
                  {/*
                    THE POINT OF THE WHOLE SHARED CATALOGUE, SAID OUT LOUD.

                    A prefilled field looks like the form remembering something.
                    What actually happened is worth more than that: a barcode this
                    shop has never stocked was recognised, because another
                    bookshop somewhere in the country entered it first. The owner
                    has to SEE that, or he will keep typing names he did not need
                    to type — and he will never understand why the catalogue is
                    worth anything.

                    What it deliberately does not carry is a price. Identity is
                    shared; what an article cost and what it sells for is this
                    shop's own business, and those are the three fields below that
                    he still fills in himself.
                  */}
                  {recognised && (
                    <Alert.Root status="info" variant="subtle">
                      <Alert.Indicator />
                      <Alert.Content gap={2}>
                        <Alert.Title>{t('stock.recognised')}</Alert.Title>
                        <Alert.Description>
                          {/* The proposed name is the thing being decided, so
                              it is the biggest thing in the panel. */}
                          <Text fontWeight="bold" fontSize="lg">
                            {recognised.name}
                          </Text>
                          <Text fontSize="sm" color="fg.muted">
                            {[recognised.brand, recognised.category].filter(Boolean).join(' · ') ||
                              t('stock.recognisedHint')}
                          </Text>
                        </Alert.Description>
                        <HStack gap={2} wrap="wrap">
                          <Button
                            size="sm"
                            colorPalette="brand"
                            onClick={() => {
                              setName(recognised.name)
                              if (recognised.unit) setUnit(recognised.unit)
                              if (recognised.category) setCategory(recognised.category)
                              // Dismissed on use: the panel asked a question
                              // and it has been answered.
                              setRecognised(null)
                            }}
                          >
                            <Check size={16} />
                            {t('stock.recognisedUse')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRecognised(null)}>
                            {t('stock.recognisedIgnore')}
                          </Button>
                        </HStack>
                      </Alert.Content>
                    </Alert.Root>
                  )}

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
                            onChange={(e) => applyCategory(e.target.value)}
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

                  {!short && (
                    <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                      <Field.Root>
                        <Field.Label>{`${t('stock.costPriceHT')} (${symbol})`}</Field.Label>
                        <Input
                          size="lg"
                          value={costHT}
                          onChange={(e) => applyHt(e.target.value)}
                          inputMode="decimal"
                          placeholder={moneyPlaceholder()}
                        />
                        <Field.HelperText>{t('stock.costPriceHtHint')}</Field.HelperText>
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>{t('stock.vat')}</Field.Label>
                        <SegmentGroup.Root
                          size="lg"
                          colorPalette="brand"
                          value={String(vat)}
                          onValueChange={(e: { value: string | null }) =>
                            applyVat(Number(e.value ?? 0))
                          }
                        >
                          <SegmentGroup.Indicator />
                          {VAT_RATES.map((rate) => (
                            <SegmentGroup.Item key={rate} value={String(rate)}>
                              <SegmentGroup.ItemText>{`${rate} %`}</SegmentGroup.ItemText>
                              <SegmentGroup.ItemHiddenInput />
                            </SegmentGroup.Item>
                          ))}
                        </SegmentGroup.Root>
                      </Field.Root>
                    </SimpleGrid>
                  )}

                  <SimpleGrid columns={{ base: 1, sm: short ? 1 : 3 }} gap={4}>
                    {!short && (
                      <Field.Root>
                        <Field.Label>{`${t('stock.costPrice')} (${symbol})`}</Field.Label>
                        <Input
                          size="lg"
                          value={costPrice}
                          onChange={(e) => applyTtc(e.target.value)}
                          inputMode="decimal"
                          placeholder={moneyPlaceholder()}
                        />
                        <Field.HelperText>{t('stock.costPriceHint')}</Field.HelperText>
                      </Field.Root>
                    )}
                    {!short && (
                      <Field.Root>
                        <Field.Label>{t('stock.marginPercent')}</Field.Label>
                        <Input
                          size="lg"
                          value={marginText}
                          onChange={(e) => applyMargin(e.target.value)}
                          inputMode="decimal"
                          placeholder="35"
                        />
                        <Field.HelperText>{t('stock.marginHint')}</Field.HelperText>
                      </Field.Root>
                    )}
                    <Field.Root required={short} invalid={!!priceError}>
                      <Field.Label>{`${t('stock.salePrice')} (${symbol})`}</Field.Label>
                      <Input
                        size="lg"
                        fontWeight="bold"
                        value={salePrice}
                        onChange={(e) => applySale(e.target.value)}
                        inputMode="decimal"
                        placeholder={moneyPlaceholder()}
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

                  {actualMargin !== null && !belowCost && (
                    <Text fontSize="sm" color="fg.muted">
                      {t('stock.margin')}:{' '}
                      <Text as="span" fontWeight="semibold" color="green.600">
                        {formatPercent(actualMargin)}
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
