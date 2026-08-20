import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Flex,
  Heading,
  HStack,
  IconButton,
  Image,
  Input,
  Portal,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react'
import { Download, Keyboard, Pencil, Plus, Printer, QrCode, Trash2, X } from 'lucide-react'
import { COMMAND_CODES, isCommandCode } from '@/features/pos/scanCommands'
import { formatMoney, fromMinor, parseMoney, moneySymbolKey, moneyPlaceholder } from '@/lib/money'
import { fold, foldCode } from '@/lib/textIndex'
import { qrDataUrl, downloadQrLabel } from '@/lib/qr'
import { useProducts } from '@/features/stock/useProducts'
import { useShopSettings, saveShopSettings } from './useShopSettings'
import type { QuickService } from '@/types/models'

/**
 * Services sold by scanning a printed label.
 *
 * The photocopier and the printer have no barcode. The owner defines the
 * service here, downloads the QR, tapes it next to the machine, and from then
 * on selling a photocopy is the same gesture as selling a book: scan, type
 * what it came to, done.
 */

/**
 * A code the QR encoder and the scanner can both carry.
 *
 * Restricted to A-Z and 0-9 on purpose, twice over: the QR library encodes
 * bytes, so an accented or Arabic character would go in as something a reader
 * hands back differently; and a scanner sending US scancodes to a French
 * keyboard cannot reproduce a character that is not on both layouts.
 */
function cleanCode(value: string): string {
  return fold(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)
}

let seq = 0
const newId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`


/**
 * THE COUNTER LABELS: buttons the shopkeeper scans instead of clicking.
 *
 * He is an old man with a queue in front of him and the reader already in his
 * hand. Putting it down, finding a button with the mouse and picking it up
 * again is the slowest thing he does all day. These print onto the same sticky
 * labels the service QRs use, and go next to the reader.
 *
 * Lives on the Services screen rather than in a section of its own because it
 * is the same gesture with the same machinery — define a code, print it, stick
 * it down — and a seventh settings section for three fixed labels would be one
 * more place for him to have to remember.
 */
function ScanShortcuts() {
  const { t } = useTranslation()

  const items = [
    { code: COMMAND_CODES[0], label: t('shortcut.pay'), hint: t('shortcut.payHint') },
    { code: COMMAND_CODES[1], label: t('shortcut.ok'), hint: t('shortcut.okHint') },
    { code: COMMAND_CODES[2], label: t('shortcut.print'), hint: t('shortcut.printHint') },
  ]

  return (
    <Card.Root mb={5} borderColor="brand.emphasized" borderWidth="1px">
      <Card.Body>
        <Flex align="start" gap={3} mb={4}>
          <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg" flexShrink={0}>
            <Keyboard size={22} />
          </Box>
          <Box minW={0}>
            <Text fontWeight="bold">{t('shortcut.title')}</Text>
            <Text fontSize="sm" color="fg.muted">
              {t('shortcut.subtitle')}
            </Text>
          </Box>
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
          {items.map((it) => (
            <Box
              key={it.code}
              borderWidth="1px"
              borderColor="border"
              borderRadius="l3"
              p={3}
              textAlign="center"
            >
              <Image
                src={qrDataUrl(it.code, 150)}
                alt={it.label}
                w="7rem"
                h="7rem"
                mx="auto"
                bg="white"
                p={1}
                borderRadius="md"
              />
              <Text fontWeight="bold" mt={2}>
                {it.label}
              </Text>
              <Text fontSize="xs" color="fg.muted" minH="2.5rem">
                {it.hint}
              </Text>
              <Button
                size="sm"
                variant="outline"
                mt={1}
                onClick={() => downloadQrLabel(it.code, it.label, it.hint, `${it.code}.png`)}
              >
                <Download size={16} />
                {t('services.downloadQr')}
              </Button>
            </Box>
          ))}
        </SimpleGrid>
      </Card.Body>
    </Card.Root>
  )
}

export function ServicesTab() {
  const { t } = useTranslation()
  const { shop, loading } = useShopSettings()
  const { products } = useProducts()

  const [editing, setEditing] = useState<QuickService | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const symbol = t(moneySymbolKey())
  const money = (m: number) => formatMoney(m, { symbol })
  const services = shop.services ?? []

  /**
   * Every barcode in the stock, folded — so the form can say when a service
   * code would collide with an article and turn every scan into a question.
   */
  const productCodes = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      const code = foldCode(p.barcode)
      if (code !== '') set.add(code)
    }
    return set
  }, [products])

  /**
   * Writes the whole list back — it lives as one array on the shop document.
   *
   * Refuses while the document is still loading. `shop` reads as DEFAULT_SHOP
   * until the first snapshot lands, so a write in that window would spread the
   * default name and footer over the real ones and, far worse, save a services
   * array built from an empty list — deleting every service the shop had.
   */
  const persist = (next: QuickService[]): boolean => {
    if (loading) {
      setError(t('services.notReady'))
      return false
    }
    setError('')
    saveShopSettings({ ...shop, services: next })
    return true
  }

  const upsert = (service: QuickService) => {
    const exists = services.some((s) => s.id === service.id)
    const ok = persist(
      exists ? services.map((s) => (s.id === service.id ? service : s)) : [...services, service],
    )
    if (!ok) return
    setFormOpen(false)
    setEditing(null)
  }

  const remove = (service: QuickService) => {
    if (!window.confirm(t('services.deleteConfirm', { name: service.name }))) return
    persist(services.filter((s) => s.id !== service.id))
  }

  const toggle = (service: QuickService) => {
    persist(
      services.map((s) => (s.id === service.id ? { ...s, active: s.active === false } : s)),
    )
  }

  const download = (service: QuickService) => {
    downloadQrLabel(
      service.code,
      service.name,
      t('services.labelCaption', { shop: shop.name }),
      `qr-${cleanCode(service.name).toLowerCase() || 'service'}.png`,
    )
  }

  /** Anything going into the print window's markup, made inert first. */
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  /** Printing the label straight from the browser, for a shop with no editor. */
  const print = (service: QuickService) => {
    const src = qrDataUrl(service.code, 640)
    const w = window.open('', '_blank', 'width=520,height=680')
    if (!w) return
    const safeName = escapeHtml(service.name)
    const safeCaption = escapeHtml(t('services.labelCaption', { shop: shop.name }))
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${safeName}</title>` +
        `<style>body{font-family:Segoe UI,Arial,sans-serif;text-align:center;margin:0;padding:32px}` +
        `img{width:74%;max-width:420px}h1{font-size:30px;margin:14px 0 4px}` +
        `p{color:#555;font-size:14px;margin:0}</style></head><body>` +
        `<img src="${src}" alt=""><h1>${safeName}</h1>` +
        `<p>${safeCaption}</p>` +
        `<script>window.onload=function(){window.print()}<\/script>` +
        `</body></html>`,
    )
    w.document.close()
  }

  return (
    <Box>
      <Flex align="center" gap={3} mb={2} wrap="wrap">
        <Box bg="purple.subtle" color="purple.fg" p={2} borderRadius="lg">
          <QrCode size={24} />
        </Box>
        <Heading size="lg">{t('services.title')}</Heading>
        <Button
          size="lg"
          colorPalette="purple"
          ms="auto"
          // Nothing may be added before the existing list has arrived, or the
          // save would write this one service over all of them.
          disabled={loading}
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={20} />
          {t('services.add')}
        </Button>
      </Flex>
      <Text color="fg.muted" mb={5} maxW="46rem">
        {t('services.subtitle')}
      </Text>

      <ScanShortcuts />

      {error && (
        <Alert.Root status="error" mb={4}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {loading ? null : services.length === 0 ? (
        <EmptyState.Root size="lg">
          <EmptyState.Content>
            <EmptyState.Indicator>
              <QrCode size={44} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('services.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('services.emptyHint')}</EmptyState.Description>
            <Button
              size="lg"
              colorPalette="purple"
              mt={2}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus size={20} />
              {t('services.add')}
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={4}>
          {services.map((service) => (
            <Card.Root key={service.id} opacity={service.active === false ? 0.6 : 1}>
              <Card.Body>
                <Flex gap={4} align="flex-start">
                  {/* The square as the cashier will see it on the counter. */}
                  <Box
                    flexShrink={0}
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="md"
                    overflow="hidden"
                    bg="white"
                    p={1}
                  >
                    <Image
                      src={qrDataUrl(service.code, 132)}
                      alt=""
                      w="5.5rem"
                      h="5.5rem"
                      display="block"
                    />
                  </Box>

                  <Box minW={0} flex="1">
                    <Text fontSize="lg" fontWeight="bold" lineClamp={1}>
                      {service.name}
                    </Text>
                    <Text fontFamily="mono" fontSize="sm" color="fg.muted" lineClamp={1}>
                      {service.code}
                    </Text>
                    <HStack gap={2} mt={2} wrap="wrap">
                      {service.defaultPrice ? (
                        <Badge colorPalette="purple" variant="subtle">
                          {money(service.defaultPrice)}
                        </Badge>
                      ) : (
                        <Badge colorPalette="gray" variant="subtle">
                          {t('services.noDefault')}
                        </Badge>
                      )}
                      {service.active === false && (
                        <Badge colorPalette="gray" variant="subtle">
                          {t('packs.inactive')}
                        </Badge>
                      )}
                    </HStack>
                  </Box>

                  <Switch.Root
                    checked={service.active !== false}
                    onCheckedChange={() => toggle(service)}
                    colorPalette="purple"
                    disabled={busy}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control />
                  </Switch.Root>
                </Flex>

                <HStack gap={2} mt={4} wrap="wrap">
                  <Button
                    size="sm"
                    colorPalette="purple"
                    variant="solid"
                    onClick={() => download(service)}
                  >
                    <Download size={16} />
                    {t('services.downloadQr')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => print(service)}>
                    <Printer size={16} />
                    {t('common.print')}
                  </Button>
                  <IconButton
                    aria-label={t('common.edit')}
                    title={t('common.edit')}
                    size="sm"
                    variant="ghost"
                    ms="auto"
                    onClick={() => {
                      setEditing(service)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    aria-label={t('common.delete')}
                    title={t('common.delete')}
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => remove(service)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </HStack>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>
      )}

      {formOpen && (
        <ServiceForm
          open={formOpen}
          service={editing}
          services={services}
          productCodes={productCodes}
          busy={busy}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSave={upsert}
        />
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------

function ServiceForm({
  open,
  service,
  services,
  productCodes,
  busy,
  onClose,
  onSave,
}: {
  open: boolean
  service: QuickService | null
  services: QuickService[]
  productCodes: Set<string>
  busy: boolean
  onClose: () => void
  onSave: (service: QuickService) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  /** True once the owner has typed a code himself; the name stops driving it. */
  const [codeTouched, setCodeTouched] = useState(false)

  const symbol = t(moneySymbolKey())

  useEffect(() => {
    if (!open) return
    setName(service?.name ?? '')
    setCode(service?.code ?? '')
    setPrice(service?.defaultPrice ? String(fromMinor(service.defaultPrice)) : '')
    setError('')
    // Editing keeps the code that is already printed on the counter; a new
    // service lets the name write it.
    setCodeTouched(!!service)
  }, [open, service])

  const setNameAndCode = (value: string) => {
    setName(value)
    if (!codeTouched) setCode(cleanCode(value))
    setError('')
  }

  const folded = foldCode(code)
  const clash: 'service' | 'product' | null = useMemo(() => {
    if (folded === '') return null
    if (services.some((s) => s.id !== service?.id && foldCode(s.code) === folded)) {
      return 'service'
    }
    if (productCodes.has(folded)) return 'product'
    return null
  }, [folded, services, service?.id, productCodes])

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (name.trim() === '') {
      setError(t('services.nameRequired'))
      return
    }
    if (code.trim() === '') {
      setError(t('services.codeRequired'))
      return
    }
    if (clash === 'service') {
      setError(t('services.codeTakenService'))
      return
    }
    /*
      A reserved counter label. The till reads these BEFORE it looks anything up
      (see scanCommands.ts), and a service wearing the same code would be shadowed
      by whichever the till checked first — sometimes selling a photocopy, at
      other times opening the payment, with nothing on screen to explain either.
      Refused at the one moment the owner can still pick a different code.
    */
    if (isCommandCode(code)) {
      setError(t('services.codeReserved'))
      return
    }
    // Empty means "no usual price". Unreadable means the owner mistyped, and
    // saving it as "no usual price" would quietly drop the one on file.
    const typed = price.trim()
    const parsed = typed === '' ? null : parseMoney(typed)
    if (typed !== '' && (parsed === null || parsed < 0)) {
      setError(t('common.invalidNumber'))
      return
    }
    onSave({
      id: service?.id ?? newId(),
      name: name.trim(),
      code: code.trim(),
      // A zero usual price is the same as none: it would print 0,000 next to
      // the service in the till's list as if that were the charge.
      defaultPrice: parsed || undefined,
      active: service?.active !== false,
    })
  }

  return (
    <Dialog.Root
      lazyMount
      unmountOnExit
      scrollBehavior="inside"
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxH="92dvh" maxW="34rem">
            <Dialog.Header>
              <Dialog.Title>
                {service ? t('services.edit') : t('services.add')}
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                  <X size={18} />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body overflowY="auto">
              <form id="service-form" onSubmit={submit}>
                <Stack gap={5}>
                  <Field.Root required>
                    <Field.Label>{t('services.name')}</Field.Label>
                    <Input
                      size="lg"
                      autoFocus
                      value={name}
                      onChange={(e) => setNameAndCode(e.target.value)}
                      placeholder={t('services.namePlaceholder')}
                    />
                    <Field.HelperText>{t('services.nameHint')}</Field.HelperText>
                  </Field.Root>

                  <Field.Root required>
                    <Field.Label>{t('services.code')}</Field.Label>
                    <Input
                      size="lg"
                      fontFamily="mono"
                      value={code}
                      onChange={(e) => {
                        setCodeTouched(true)
                        setCode(cleanCode(e.target.value))
                        setError('')
                      }}
                      placeholder="PHOTOCOPIE"
                    />
                    <Field.HelperText>{t('services.codeHint')}</Field.HelperText>
                  </Field.Root>

                  {clash && (
                    <Alert.Root status={clash === 'service' ? 'error' : 'warning'}>
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>
                          {t(
                            clash === 'service'
                              ? 'services.codeTakenService'
                              : 'services.codeTakenProduct',
                          )}
                        </Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  <Field.Root>
                    <Field.Label>{`${t('services.defaultPrice')} (${symbol})`}</Field.Label>
                    <Input
                      size="lg"
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder={moneyPlaceholder()}
                    />
                    <Field.HelperText>{t('services.defaultPriceHint')}</Field.HelperText>
                  </Field.Root>

                  {/* The square, live, so the owner sees what he will print. */}
                  {code.trim() !== '' && (
                    <Flex
                      align="center"
                      gap={4}
                      p={3}
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="l3"
                      bg="bg.subtle"
                    >
                      <Box bg="white" p={1} borderRadius="md" flexShrink={0}>
                        <Image
                          src={qrDataUrl(code.trim(), 120)}
                          alt=""
                          w="5rem"
                          h="5rem"
                          display="block"
                        />
                      </Box>
                      <Text fontSize="sm" color="fg.muted">
                        {t('services.previewHint')}
                      </Text>
                    </Flex>
                  )}

                  {error && (
                    <Alert.Root status="error">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{error}</Alert.Title>
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
                form="service-form"
                colorPalette="purple"
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
