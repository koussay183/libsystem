import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Flex,
  Stack,
  SimpleGrid,
  Heading,
  Text,
  Button,
  IconButton,
  Input,
  InputGroup,
  Card,
  Stat,
  Alert,
  EmptyState,
  Spinner,
} from '@chakra-ui/react'
import { Plus, Search, Truck, Pencil, Trash2, Wallet } from 'lucide-react'
import { formatMoney, moneySymbolKey } from '@/lib/money'
import { useSuppliers, removeSupplier } from './useSuppliers'
import { usePurchases } from '@/features/purchases/usePurchases'
import { SupplierForm } from './SupplierForm'
import type { Supplier } from '@/types/models'

export function SuppliersPage() {
  const { t } = useTranslation()
  const { suppliers, loading, error } = useSuppliers()
  const { purchases } = usePurchases()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)

  const symbol = t(moneySymbolKey())
  const totalFor = (name: string) =>
    purchases.filter((p) => p.supplier === name).reduce((s, p) => s + p.total, 0)
  const totalAll = purchases.reduce((s, p) => s + p.total, 0)

  const q = search.trim().toLowerCase()
  const filtered =
    q === ''
      ? suppliers
      : suppliers.filter(
          (s) =>
            s.name.toLowerCase().includes(q) || (s.phone ?? '').toLowerCase().includes(q),
        )

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (s: Supplier) => {
    setEditing(s)
    setFormOpen(true)
  }
  const onDelete = async (s: Supplier) => {
    if (window.confirm(t('supplier.deleteConfirm'))) await removeSupplier(s.id)
  }
  const onSearchSubmit = (e: FormEvent<HTMLFormElement>) => e.preventDefault()

  return (
    <Box>
      {/* ---------------- Header ---------------- */}
      <Flex align="center" gap={3} mb={5} wrap="wrap">
        <Box bg="purple.subtle" color="purple.fg" p={2} borderRadius="lg">
          <Truck size={26} />
        </Box>
        <Heading size="2xl">{t('supplier.title')}</Heading>
        <Button size="xl" colorPalette="brand" onClick={openAdd} ms="auto">
          <Plus size={22} />
          {t('supplier.add')}
        </Button>
      </Flex>

      {/* ---------------- Stat tiles ---------------- */}
      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3} mb={5}>
        <Card.Root>
          <Card.Body>
            <Flex align="center" gap={3}>
              <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                <Truck size={22} />
              </Box>
              <Stat.Root>
                <Stat.ValueText>{String(suppliers.length)}</Stat.ValueText>
                <Stat.Label>{t('supplier.suppliersCount')}</Stat.Label>
              </Stat.Root>
            </Flex>
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Body>
            <Flex align="center" gap={3}>
              <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
                <Wallet size={22} />
              </Box>
              <Stat.Root>
                <Stat.ValueText>{formatMoney(totalAll, { symbol })}</Stat.ValueText>
                <Stat.Label>{t('supplier.totalPurchased')}</Stat.Label>
              </Stat.Root>
            </Flex>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* ---------------- Search ---------------- */}
      <Box mb={4}>
        <form onSubmit={onSearchSubmit}>
          <InputGroup startElement={<Search size={22} />}>
            <Input
              size="lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('supplier.searchPlaceholder')}
            />
          </InputGroup>
        </form>
      </Box>

      {/* ---------------- List ---------------- */}
      {loading ? (
        <Flex justify="center" align="center" py={16}>
          <Spinner size="lg" colorPalette="brand" />
        </Flex>
      ) : error ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert.Root>
      ) : suppliers.length === 0 ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Truck size={48} />
            </EmptyState.Indicator>
            <EmptyState.Title>{t('supplier.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('supplier.emptyHint')}</EmptyState.Description>
            <Button size="xl" colorPalette="brand" onClick={openAdd} mt={2}>
              <Plus size={22} />
              {t('supplier.add')}
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : filtered.length === 0 ? (
        <Card.Root>
          <Card.Body>
            <Text color="fg.muted">{t('stock.noResults')}</Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Stack gap={3}>
          {filtered.map((s) => (
            <Card.Root key={s.id}>
              <Card.Body>
                <Flex align="center" gap={3}>
                  <Box minW={0} flex="1">
                    <Text fontSize="xl" fontWeight="semibold" truncate>
                      {s.name}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {s.phone && <span>{s.phone}</span>}
                      {s.phone && s.note && <span> · </span>}
                      {s.note && <span>{s.note}</span>}
                    </Text>
                  </Box>
                  <Box textAlign="end">
                    <Text fontWeight="bold" color="brand.fg">
                      {formatMoney(totalFor(s.name), { symbol })}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {t('supplier.totalPurchased')}
                    </Text>
                  </Box>
                  <Flex gap={1} flexShrink={0}>
                    <IconButton
                      aria-label={t('common.edit')}
                      title={t('common.edit')}
                      size="lg"
                      variant="outline"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil size={20} />
                    </IconButton>
                    <IconButton
                      aria-label={t('common.delete')}
                      title={t('common.delete')}
                      size="lg"
                      variant="outline"
                      colorPalette="red"
                      onClick={() => onDelete(s)}
                    >
                      <Trash2 size={20} />
                    </IconButton>
                  </Flex>
                </Flex>
              </Card.Body>
            </Card.Root>
          ))}
        </Stack>
      )}

      {formOpen && (
        <SupplierForm open onClose={() => setFormOpen(false)} supplier={editing} />
      )}
    </Box>
  )
}
