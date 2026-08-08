import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
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
  Input,
  Portal,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Alert,
  Spinner,
} from '@chakra-ui/react'
import { Settings as SettingsIcon, Store, Tags, Plus, Pencil, Trash2, X } from 'lucide-react'
import { useAlive } from '@/lib/useAlive'
import {
  useCategories,
  createCategory,
  renameCategory,
  removeCategory,
  countProductsInCategory,
} from '@/features/categories/useCategories'
import { useShopSettings, saveShopSettings } from './useShopSettings'
import type { Category, ShopSettings } from '@/types/models'

function ShopTab() {
  const { t } = useTranslation()
  const alive = useAlive()
  const { shop, loading } = useShopSettings()

  const [form, setForm] = useState<ShopSettings>(shop)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // The live document is the source of truth until the owner starts editing.
  useEffect(() => {
    if (!loading) setForm(shop)
  }, [loading, shop])

  const set = (k: keyof ShopSettings) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setDone(false)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await saveShopSettings({ ...form, name: form.name.trim() || 'Librairie' })
      if (alive.current) setDone(true)
    } catch {
      if (alive.current) setError(t('common.error'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  if (loading) {
    return (
      <Flex justify="center" py={12}>
        <Spinner size="xl" colorPalette="brand" />
      </Flex>
    )
  }

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6} alignItems="start">
      <Card.Root>
        <Card.Body>
          <form onSubmit={submit}>
            <Stack gap={4}>
              <Field.Root required>
                <Field.Label>{t('settings.shopName')}</Field.Label>
                <Input size="lg" value={form.name} onChange={set('name')} />
                <Field.HelperText>{t('settings.shopNameHint')}</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>{t('settings.address')}</Field.Label>
                <Input size="lg" value={form.address ?? ''} onChange={set('address')} />
              </Field.Root>

              <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                <Field.Root>
                  <Field.Label>{t('settings.phone')}</Field.Label>
                  <Input size="lg" value={form.phone ?? ''} onChange={set('phone')} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>{t('settings.taxId')}</Field.Label>
                  <Input size="lg" value={form.taxId ?? ''} onChange={set('taxId')} />
                </Field.Root>
              </SimpleGrid>

              <Field.Root>
                <Field.Label>{t('settings.footer')}</Field.Label>
                <Input
                  size="lg"
                  value={form.footer ?? ''}
                  onChange={set('footer')}
                  placeholder={t('settings.footerPlaceholder')}
                />
              </Field.Root>

              {error && (
                <Alert.Root status="error">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{error}</Alert.Title>
                  </Alert.Content>
                </Alert.Root>
              )}
              {done && (
                <Alert.Root status="success">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{t('settings.saved')}</Alert.Title>
                  </Alert.Content>
                </Alert.Root>
              )}

              <Button
                type="submit"
                size="xl"
                colorPalette="brand"
                loading={busy}
                loadingText={t('common.saving')}
              >
                {t('common.save')}
              </Button>
            </Stack>
          </form>
        </Card.Body>
      </Card.Root>

      {/* What the printed ticket header will look like */}
      <Card.Root>
        <Card.Body>
          <Text fontWeight="bold" mb={3}>
            {t('settings.preview')}
          </Text>
          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="md"
            bg="white"
            color="black"
            p={4}
            fontFamily="mono"
            fontSize="sm"
            textAlign="center"
          >
            <Text fontSize="lg" fontWeight="bold">
              {form.name || 'Librairie'}
            </Text>
            {form.address && <Text>{form.address}</Text>}
            {form.phone && <Text>Tél : {form.phone}</Text>}
            {form.taxId && <Text>MF : {form.taxId}</Text>}
            <Text mt={2}>Ticket 260721-143512</Text>
            <Box borderTopWidth="1px" borderBottomWidth="1px" borderColor="gray.400" my={2} py={2}>
              <Flex justify="space-between">
                <Text>Cahier 96 pages</Text>
                <Text>2,500</Text>
              </Flex>
            </Box>
            <Flex justify="space-between" fontWeight="bold">
              <Text>TOTAL</Text>
              <Text>2,500</Text>
            </Flex>
            <Text mt={3}>{form.footer || t('settings.footerPlaceholder')}</Text>
          </Box>
        </Card.Body>
      </Card.Root>
    </SimpleGrid>
  )
}

function CategoriesTab() {
  const { t } = useTranslation()
  const alive = useAlive()
  const { categories, loading } = useCategories()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [listError, setListError] = useState('')

  const openAdd = () => {
    setEditing(null)
    setName('')
    setError('')
    setOpen(true)
  }

  const openEdit = (c: Category) => {
    setEditing(c)
    setName(c.name)
    setError('')
    setOpen(true)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next = name.trim()
    if (next === '') {
      setError(t('settings.nameRequired'))
      return
    }
    const clash = categories.some(
      (c) => c.id !== editing?.id && c.name.toLowerCase() === next.toLowerCase(),
    )
    if (clash) {
      setError(t('settings.duplicate'))
      return
    }
    setBusy(true)
    setError('')
    try {
      if (editing) await renameCategory(editing.id, editing.name, next)
      else await createCategory(next)
      if (alive.current) setOpen(false)
    } catch {
      if (alive.current) setError(t('common.error'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const confirmDelete = async (c: Category) => {
    setListError('')
    try {
      const used = await countProductsInCategory(c.name)
      const message =
        used > 0
          ? `${t('settings.categoryInUse', { count: used })}\n${t('settings.categoryDeleteConfirm')}`
          : t('settings.categoryDeleteConfirm')
      if (!window.confirm(message)) return
      await removeCategory(c.id)
    } catch {
      if (alive.current) setListError(t('common.error'))
    }
  }

  return (
    <Stack gap={4}>
      <Flex justify="space-between" align="center" gap={3} wrap="wrap">
        <Text color="fg.muted">{t('settings.categoryRenameHint')}</Text>
        <Button size="lg" colorPalette="brand" onClick={openAdd}>
          <Plus size={20} />
          {t('settings.addCategory')}
        </Button>
      </Flex>

      {listError && (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{listError}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      )}

      {loading ? (
        <Flex justify="center" py={12}>
          <Spinner size="xl" colorPalette="brand" />
        </Flex>
      ) : categories.length === 0 ? (
        <EmptyState.Root size="lg" py={10}>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Tags size={48} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('settings.categoryEmpty')}</EmptyState.Title>
            <EmptyState.Description>
              {t('settings.categoryEmptyHint')}
            </EmptyState.Description>
            <Button size="xl" colorPalette="brand" mt={2} onClick={openAdd}>
              <Plus size={20} />
              {t('settings.addCategory')}
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={3}>
          {categories.map((c) => (
            <Card.Root key={c.id}>
              <Card.Body>
                <Flex align="center" gap={2}>
                  <Text flex="1" minW={0} fontWeight="semibold" truncate>
                    {c.name}
                  </Text>
                  <IconButton
                    aria-label={t('common.edit')}
                    variant="ghost"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil size={18} />
                  </IconButton>
                  <IconButton
                    aria-label={t('common.delete')}
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => confirmDelete(c)}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </Flex>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>
      )}

      <Dialog.Root scrollBehavior="inside" open={open} onOpenChange={(e) => setOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {editing ? t('settings.editCategory') : t('settings.addCategory')}
                </Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label={t('common.close')} variant="ghost" size="sm">
                    <X size={18} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                <form id="category-form" onSubmit={submit}>
                  <Field.Root required invalid={!!error}>
                    <Field.Label>{t('settings.categoryName')}</Field.Label>
                    <Input
                      size="lg"
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <Field.ErrorText>{error}</Field.ErrorText>
                    {editing && (
                      <Field.HelperText>
                        {t('settings.categoryRenameHint')}
                      </Field.HelperText>
                    )}
                  </Field.Root>
                </form>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="lg" variant="outline" onClick={() => setOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="lg"
                  type="submit"
                  form="category-form"
                  colorPalette="brand"
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
    </Stack>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <Box>
      <Flex align="center" gap={3} mb={2}>
        <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
          <SettingsIcon size={26} />
        </Box>
        <Heading size="2xl">{t('settings.title')}</Heading>
      </Flex>
      <Text color="fg.muted" mb={6}>
        {t('settings.subtitle')}
      </Text>

      <Tabs.Root defaultValue="shop" size="lg">
        <Tabs.List mb={5}>
          <Tabs.Trigger value="shop">
            <HStack gap={2}>
              <Store size={18} />
              {t('settings.shopTab')}
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger value="categories">
            <HStack gap={2}>
              <Tags size={18} />
              {t('settings.categoriesTab')}
            </HStack>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="shop">
          <ShopTab />
        </Tabs.Content>
        <Tabs.Content value="categories">
          <CategoriesTab />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}
