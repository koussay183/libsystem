import { useEffect, useState, useSyncExternalStore } from 'react'
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import {
  LogOut,
  ShieldAlert,
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
import { ROUTE_PALETTE, paletteFor } from '@/lib/navColors'
import { getMoneyMode, setMoneyMode, subscribeMoneyMode } from '@/lib/money'
import { useShopSettings } from '@/features/settings/useShopSettings'
import { LanguageToggle } from '@/components/LanguageToggle'
import { SyncStatus, UpdateBanner } from '@/components/SyncStatus'
import { syncStore, clearDenied } from '@/lib/syncStatus'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

/** The colour this route answers to, everywhere in the app. */
const paletteOf = (to: string) => ROUTE_PALETTE[to] ?? 'brand'

interface NavGroup {
  label: string
  items: NavItem[]
}

const SIDEBAR_W = '18.5rem'

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
  const { logout, lapsed } = useAuth()
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot, syncStore.getSnapshot)
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const { shop } = useShopSettings()

  /**
   * Dinars or millimes, for the whole app.
   *
   * The mode lives in lib/money, which every price on every screen and every
   * price field already goes through, so nothing else has to know about it.
   * What this subscription buys is the redraw: without it the switch would
   * take effect only on pages mounted afterwards, and the owner would be
   * looking at one page written two different ways.
   */
  const moneyMode = useSyncExternalStore(subscribeMoneyMode, getMoneyMode, getMoneyMode)

  // The shop document is what carries the choice to the other machine; the
  // local copy is only what makes the first paint right.
  useEffect(() => {
    if (shop.moneyMode) setMoneyMode(shop.moneyMode)
  }, [shop.moneyMode])

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

  const current = [...groups.flatMap((g) => g.items), ...footerItems].find(
    (i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`),
  )
  const currentLabel = current?.label ?? t('nav.home')
  const CurrentIcon = current?.icon ?? BookMarked
  const currentPalette = paletteFor(location.pathname)

  /**
   * NavLink sets `aria-current="page"` on the active route, so the active
   * styling is expressed with the `_currentPage` condition. Listed last so it
   * wins over `_hover` (equal specificity, source order decides).
   */
  /**
   * Every module is a coloured block, all the time — not a grey line that only
   * admits to its colour when the mouse is over it. An owner who does not read
   * the labels navigates by colour and position, and neither of those exists
   * until the colour is on the screen.
   */
  const NavButton = ({ to, icon: Icon, label }: NavItem) => {
    // The same rule NavLink uses to set aria-current, so the square and the
    // row it sits on can never disagree about which page is open.
    const active =
      location.pathname === to || location.pathname.startsWith(`${to}/`)
    return (
      <Button
        asChild
        h="3.5rem"
        w="full"
        justifyContent="flex-start"
        gap={3}
        px={3}
        variant="plain"
        colorPalette={paletteOf(to)}
        fontSize="lg"
        fontWeight="bold"
        borderRadius="l3"
        bg="colorPalette.subtle"
        color="colorPalette.fg"
        transition="background-color 0.12s, transform 0.12s"
        _hover={{ bg: 'colorPalette.muted' }}
        _active={{ transform: 'scale(0.985)' }}
        // Listed last so it wins over _hover: same specificity, source order decides.
        _currentPage={{
          bg: 'colorPalette.solid',
          color: 'colorPalette.contrast',
          boxShadow: 'md',
        }}
      >
        <NavLink to={to}>
          {/*
            The square is the strongest mark on the row, so it has to hold up on
            both grounds: a solid block of the module's colour on the pale
            inactive row, and a translucent white one on the saturated active row
            — where a solid block of the same colour would disappear into it.
          */}
          <Box
            as="span"
            flexShrink={0}
            boxSize="2.5rem"
            display="grid"
            placeItems="center"
            borderRadius="lg"
            bg={active ? 'whiteAlpha.300' : 'colorPalette.solid'}
            color="colorPalette.contrast"
          >
            <Icon size={22} />
          </Box>
          <Text as="span" truncate>
            {label}
          </Text>
        </NavLink>
      </Button>
    )
  }

  const navContent = (
    <Stack gap={5} flex="1" overflowY="auto" px={3} py={4}>
      {groups.map((g) => (
        <Stack key={g.label} gap={2}>
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

      <Stack gap={2} borderTopWidth="1px" borderColor="border" pt={3}>
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

        {/*
          Two things the shop must never meet in silence.

          A lapsed plan makes every write fail, and Firestore's answer to a
          refused write is to roll the change back locally — the article
          appears, then vanishes, with nothing on screen to explain it. And a
          refused write can also mean the session simply needs renewing. Either
          way the answer is a sentence, not a disappearing row.
        */}
        {lapsed && (
          <Flex
            align="center"
            gap={3}
            px={{ base: 3, md: 6 }}
            py={2}
            bg="orange.solid"
            color="orange.contrast"
            flexShrink={0}
          >
            <ShieldAlert size={20} />
            <Box minW={0}>
              <Text fontWeight="bold">{t('auth.lapsedTitle')}</Text>
              <Text fontSize="sm">{t('auth.lapsedBody')}</Text>
            </Box>
          </Flex>
        )}

        {sync.denied && !lapsed && (
          <Flex
            align="center"
            gap={3}
            px={{ base: 3, md: 6 }}
            py={2}
            bg="red.solid"
            color="red.contrast"
            flexShrink={0}
          >
            <ShieldAlert size={20} />
            <Text minW={0} fontWeight="semibold">
              {t('auth.deniedWrite')}
            </Text>
            <Button size="sm" variant="outline" ms="auto" flexShrink={0} onClick={clearDenied}>
              {t('common.close')}
            </Button>
          </Flex>
        )}
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

          <Flex align="center" gap={2} flex="1" minW={0} colorPalette={currentPalette}>
            <Box
              flexShrink={0}
              boxSize="2.25rem"
              display="grid"
              placeItems="center"
              borderRadius="lg"
              bg="colorPalette.solid"
              color="colorPalette.contrast"
            >
              <CurrentIcon size={20} />
            </Box>
            <Text fontSize="lg" fontWeight="bold" truncate>
              {currentLabel}
            </Text>
          </Flex>

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
          {/*
            Keyed on the money mode so flipping dinars/millimes rebuilds the
            page from scratch. A re-render alone would leave any amount that
            was worked out inside a useMemo written the old way, and a screen
            showing both units at once is worse than either.

            Safe to remount: the switch lives in the settings, so the till —
            the one screen holding state worth keeping — is not mounted when
            it is touched, and its parked tickets are in localStorage anyway.
          */}
          <Box key={moneyMode} display="contents">
            <Outlet />
          </Box>
        </Box>
      </Flex>
    </Box>
  )
}
