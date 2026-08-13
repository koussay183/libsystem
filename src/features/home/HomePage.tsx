import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  SimpleGrid,
  Stat,
  Text,
} from '@chakra-ui/react'
import {
  Package,
  ReceiptText,
  HandCoins,
  Wallet,
  Truck,
  ShoppingCart,
  BarChart3,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { useTodaySales } from '@/features/sales/useSales'

interface Tile {
  to: string
  icon: LucideIcon
  title: string
  desc: string
  /** Chakra colour palette used for the tile's icon square. */
  palette: string
}

export function HomePage() {
  const { t } = useTranslation()
  const { sales, loading } = useTodaySales()
  const symbol = t('money.symbol')

  // "How did today go?" is the first thing the owner wants when he walks in.
  const today = useMemo(
    () => ({
      count: sales.length,
      total: sales.reduce((sum, s) => sum + s.total, 0),
    }),
    [sales],
  )

  const tiles: Tile[] = [
    {
      to: '/stock',
      icon: Package,
      title: t('home.stockTitle'),
      desc: t('home.stockDesc'),
      palette: 'brand',
    },
    {
      to: '/invoices',
      icon: ReceiptText,
      title: t('home.invoicesTitle'),
      desc: t('home.invoicesDesc'),
      palette: 'blue',
    },
    {
      to: '/credit',
      icon: HandCoins,
      title: t('home.creditTitle'),
      desc: t('home.creditDesc'),
      palette: 'orange',
    },
    {
      to: '/suppliers',
      icon: Truck,
      title: t('home.suppliersTitle'),
      desc: t('home.suppliersDesc'),
      palette: 'purple',
    },
    {
      to: '/dashboard',
      icon: Wallet,
      title: t('home.dashboardTitle'),
      desc: t('home.dashboardDesc'),
      palette: 'green',
    },
    {
      to: '/reports',
      icon: BarChart3,
      title: t('reports.title'),
      desc: t('reports.subtitle'),
      palette: 'teal',
    },
    {
      to: '/settings',
      icon: Settings,
      title: t('settings.title'),
      desc: t('settings.subtitle'),
      palette: 'gray',
    },
  ]

  return (
    <Box>
      <Box mb={6}>
        <Heading size="2xl">{t('home.greeting')}</Heading>
        <Text mt={1} fontSize="lg" color="fg.muted">
          {t('home.subtitle')}
        </Text>
      </Box>

      {/* The till is the everyday job — it gets the whole first row. */}
      <Card.Root mb={4} borderRadius="2xl" bg="brand.solid" color="brand.contrast">
        <Card.Body p={{ base: 5, md: 7 }}>
          <Flex align="center" gap={5} wrap="wrap">
            <Box
              boxSize="4.5rem"
              flexShrink={0}
              display="grid"
              placeItems="center"
              borderRadius="2xl"
              bg="whiteAlpha.300"
            >
              <ShoppingCart size={38} />
            </Box>
            <Box minW={0} flex="1">
              <Text fontSize="3xl" fontWeight="bold">
                {t('home.posTitle')}
              </Text>
              <Text opacity={0.9}>{t('home.posDesc')}</Text>
            </Box>
            <Button asChild size="xl" colorPalette="green" flexShrink={0}>
              <Link to="/caisse">{t('home.openCaisse')}</Link>
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>

      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4} mb={6}>
        <Card.Root borderRadius="2xl">
          <Card.Body>
            <Stat.Root>
              <Stat.Label>{t('home.todaySales')}</Stat.Label>
              <Stat.ValueText fontSize="3xl">
                {loading ? '…' : formatMoney(today.total, { symbol })}
              </Stat.ValueText>
            </Stat.Root>
          </Card.Body>
        </Card.Root>
        <Card.Root borderRadius="2xl">
          <Card.Body>
            <Stat.Root>
              <Stat.Label>{t('home.todayTickets')}</Stat.Label>
              <Stat.ValueText fontSize="3xl">{loading ? '…' : today.count}</Stat.ValueText>
            </Stat.Root>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, sm: 2, xl: 3 }} gap={4}>
        {tiles.map(({ to, icon: Icon, title, desc, palette }) => (
          <Link key={to} to={to}>
            <Card.Root
              h="full"
              borderRadius="2xl"
              transition="transform 0.15s, box-shadow 0.15s"
              _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
            >
              <Card.Body p={5}>
                <Flex align="center" gap={4}>
                  <Box
                    colorPalette={palette}
                    boxSize="3.5rem"
                    flexShrink={0}
                    display="grid"
                    placeItems="center"
                    borderRadius="2xl"
                    bg="colorPalette.solid"
                    color="colorPalette.contrast"
                  >
                    <Icon size={30} />
                  </Box>
                  <Box minW={0}>
                    <Text fontSize="xl" fontWeight="bold" truncate>
                      {title}
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      {desc}
                    </Text>
                  </Box>
                </Flex>
              </Card.Body>
            </Card.Root>
          </Link>
        ))}
      </SimpleGrid>
    </Box>
  )
}
