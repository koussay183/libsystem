import { useEffect, useState } from 'react'
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import {
  LogOut,
  BookMarked,
  Package,
  Boxes,
  ReceiptText,
  HandCoins,
  Wallet,
  Truck,
  ShoppingCart,
  BarChart3,
  DatabaseBackup,
  Settings,
  Menu as MenuIcon,
  X,
} from 'lucide-react'
import {
  Box,
  Flex,
  HStack,
  Stack,
  Text,
  Button,
  IconButton,
  Drawer,
  Portal,
} from '@chakra-ui/react'
import { useAuth } from '@/auth/AuthContext'
import { LanguageToggle } from '@/components/LanguageToggle'
import { SyncStatus, UpdateBanner } from '@/components/SyncStatus'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const SIDEBAR_W = '17rem'

/**
 * Routes that own the viewport instead of scrolling with the document.
 *
 * The till is the one screen where scrolling costs money: with a dozen lines on
 * the ticket the total and the Encaisser button go below the fold, and the
 * cashier scrolls with a customer waiting. Every other page is legitimately
 * long and keeps normal document scrolling.
 */
const VIEWPORT_ROUTES = new Set(['/caisse'])

/**
 * Two-part shell: a fixed sidebar from `lg` up, the same navigation inside a
 * drawer below that. The old single-row navbar could not fit eight modules —
 * it overflowed and pushed a horizontal scrollbar onto every page.
 *
 * Spacing uses logical properties (`ms`, `insetStart`) so the Arabic RTL
 * layout mirrors correctly instead of leaving a gap on the wrong side.
 */
export function AppShell() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const groups: NavGroup[] = [
    {
      label: t('nav.sell'),
      items: [{ to: '/caisse', icon: ShoppingCart, label: t('nav.pos') }],
    },
    {
      label: t('nav.manage'),
      items: [
        { to: '/stock', icon: Package, label: t('nav.stock') },
        { to: '/packs', icon: Boxes, label: t('packs.title') },
        { to: '/invoices', icon: ReceiptText, label: t('nav.invoices') },
        { to: '/suppliers', icon: Truck, label: t('nav.suppliers') },
        { to: '/credit', icon: HandCoins, label: t('nav.credit') },
      ],
    },
    {
      label: t('nav.analyse'),
      items: [
        { to: '/dashboard', icon: Wallet, label: t('nav.dashboard') },
        { to: '/reports', icon: BarChart3, label: t('nav.reports') },
      ],
    },
  ]

  const footerItems: NavItem[] = [
    { to: '/settings', icon: Settings, label: t('nav.settings') },
    { to: '/backup', icon: DatabaseBackup, label: t('nav.backup') },
  ]

  // Close the drawer whenever navigation happens, so tapping a link on a phone
  // does not leave the overlay covering the page it just opened.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const fullHeight = VIEWPORT_ROUTES.has(location.pathname)

  const currentLabel =
    [...groups.flatMap((g) => g.items), ...footerItems].find(
      (i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`),
    )?.label ?? t('nav.home')

  /**
   * NavLink sets `aria-current="page"` on the active route, so the active
   * styling is expressed with the `_currentPage` condition. Listed last so it
   * wins over `_hover` (equal specificity, source order decides).
   */
  const NavButton = ({ to, icon: Icon, label }: NavItem) => (
    <Button
      asChild
      size="lg"
      w="full"
      justifyContent="flex-start"
      gap={3}
      px={3}
      variant="ghost"
      colorPalette="brand"
      fontWeight="semibold"
      color="fg.muted"
      _hover={{ bg: 'brand.subtle', color: 'brand.fg' }}
      _currentPage={{ bg: 'brand.solid', color: 'brand.contrast' }}
    >
      <NavLink to={to}>
        <Icon size={20} />
        <Text as="span" truncate>
          {label}
        </Text>
      </NavLink>
    </Button>
  )

  const navContent = (
    <Stack gap={5} flex="1" overflowY="auto" px={3} py={4}>
      {groups.map((g) => (
        <Stack key={g.label} gap={1}>
          <Text
            fontSize="xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wider"
            color="fg.subtle"
            px={3}
            mb={1}
          >
            {g.label}
          </Text>
          {g.items.map((item) => (
            <NavButton key={item.to} {...item} />
          ))}
        </Stack>
      ))}

      <Box flex="1" />

      <Stack gap={1} borderTopWidth="1px" borderColor="border" pt={3}>
        {footerItems.map((item) => (
          <NavButton key={item.to} {...item} />
        ))}
      </Stack>
    </Stack>
  )

  const brand = (
    <HStack asChild gap={2} color="brand.fg" px={4} py={4} minH="4.5rem">
      <Link to="/">
        <BookMarked size={28} />
        <Text fontSize="xl" fontWeight="bold" truncate>
          {t('app.name')}
        </Text>
      </Link>
    </HStack>
  )

  return (
    <Box minH="100dvh" bg="bg.subtle" overflowX="clip">
      {/* ---------------- Fixed sidebar (lg and up) ---------------- */}
      <Flex
        as="aside"
        direction="column"
        display={{ base: 'none', lg: 'flex' }}
        position="fixed"
        insetStart={0}
        top={0}
        bottom={0}
        w={SIDEBAR_W}
        bg="bg"
        borderEndWidth="1px"
        borderColor="border"
        zIndex={30}
      >
        <Box borderBottomWidth="1px" borderColor="border">
          {brand}
        </Box>
        {navContent}
      </Flex>

      {/* ---------------- Drawer nav (below lg) ---------------- */}
      <Drawer.Root
        open={menuOpen}
        onOpenChange={(e) => setMenuOpen(e.open)}
        placement="start"
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content maxW={SIDEBAR_W}>
              <Flex direction="column" h="full">
                <Flex
                  align="center"
                  justify="space-between"
                  borderBottomWidth="1px"
                  borderColor="border"
                  pe={2}
                >
                  {brand}
                  <Drawer.CloseTrigger asChild>
                    <IconButton aria-label={t('common.close')} variant="ghost">
                      <X size={20} />
                    </IconButton>
                  </Drawer.CloseTrigger>
                </Flex>
                {navContent}
              </Flex>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      {/* ---------------- Content column ---------------- */}
      {/*
        A flex column with a definite height lets the till simply say
        `flex="1" minH={0}` and inherit whatever is left, instead of hard-coding
        `calc(100dvh - 7.5rem)` — an arithmetic that would silently drift the
        day the header gains a line or the update banner appears.
        minH (not h) on every other route leaves those pages untouched.
      */}
      <Flex
        direction="column"
        ms={{ base: 0, lg: SIDEBAR_W }}
        minW={0}
        minH="100dvh"
        h={fullHeight ? '100dvh' : undefined}
      >
        <UpdateBanner />
        <Flex
          as="header"
          position="sticky"
          top={0}
          zIndex={20}
          flexShrink={0}
          align="center"
          gap={3}
          minH="4.5rem"
          px={{ base: 3, md: 6 }}
          borderBottomWidth="1px"
          borderColor="border"
          bg="bg/85"
          backdropFilter="blur(8px)"
        >
          <IconButton
            aria-label={t('common.menu')}
            variant="ghost"
            size="lg"
            display={{ base: 'inline-flex', lg: 'none' }}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon size={24} />
          </IconButton>

          <Text fontSize="lg" fontWeight="bold" truncate flex="1" minW={0}>
            {currentLabel}
          </Text>

          <HStack gap={{ base: 1, sm: 2 }} flexShrink={0}>
            <SyncStatus />
            <LanguageToggle />
            <Button variant="ghost" size="lg" onClick={handleLogout}>
              <LogOut size={20} />
              <Text as="span" display={{ base: 'none', md: 'inline' }}>
                {t('common.logout')}
              </Text>
            </Button>
          </HStack>
        </Flex>

        <Box
          as="main"
          mx="auto"
          w="full"
          maxW="100rem"
          px={{ base: 3, md: 6 }}
          py={fullHeight ? { base: 3, md: 4 } : { base: 4, md: 6 }}
          minW={0}
          flex="1"
          minH={0}
          display="flex"
          flexDirection="column"
          // `clip`, not `hidden`: a hidden box is still programmatically
          // scrollable, and the till calls focusScan() after every scan — one
          // stray pixel and .focus() would scroll the scan field out of reach
          // with no scrollbar to bring it back.
          overflow={fullHeight ? 'clip' : undefined}
        >
          <Outlet />
        </Box>
      </Flex>
    </Box>
  )
}
