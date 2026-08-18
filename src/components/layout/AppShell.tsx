import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import {
  LogOut,
  ShieldAlert,
  AlertTriangle,
  CloudOff,
  BookMarked,
  Library,
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
import { SyncStatus, UpdateBanner, StaleBuildBanner, UnprotectedBanner } from '@/components/SyncStatus'
import { syncStore, clearDenied } from '@/lib/syncStatus'
import { retryLiveCollections } from '@/lib/liveCollection'
import { useProductsFatal } from '@/features/stock/useProducts'
import { useCustomersFatal } from '@/features/customers/useCustomers'
import { useCategoriesFatal } from '@/features/categories/useCategories'
import { useSuppliersFatal } from '@/features/suppliers/useSuppliers'
import { usePacksFatal } from '@/features/packs/usePacks'

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
 * The kinds of giving-up that are worth a sentence, worst first.
 *
 * The shell speaks about the first one it finds and stays silent about the rest:
 * these arrive together anyway — a lapsed plan, a revoked session or a blown
 * quota kills all five shared listeners within seconds of each other — and five
 * stacked banners over the till would push the basket below the fold to say one
 * thing five times.
 *
 * 'no-shop' is deliberately absent, and must stay absent. It means the query
 * could not even be built because no shop is selected: the account is signing
 * out or changing hands and a redirect is already on its way, so there is no
 * frozen data and nothing was sold against anything. Announcing it would put a
 * red banner on top of every logout.
 */
const FROZEN_ORDER = ['refused', 'exhausted', 'broken', 'retries'] as const

/**
 * One sentence per reason, because they call for four different actions.
 *
 * `needsDeploy` marks the reason where "try again" would be a button that does
 * nothing — the query itself is malformed or its index is missing, and it will
 * answer the same way however often it is asked.
 */
const FROZEN_COPY: Record<
  (typeof FROZEN_ORDER)[number],
  {
    icon: LucideIcon
    bg: string
    fg: string
    title: string
    body: string
    needsDeploy?: boolean
  }
> = {
  // Red, like the refused-write banner further down, and for the same reason:
  // the server said no. Nothing on this machine argues with that.
  refused: {
    icon: ShieldAlert,
    bg: 'red.solid',
    fg: 'red.contrast',
    title: 'sync.frozenRefusedTitle',
    body: 'sync.frozenRefusedBody',
  },
  // Not this shop's fault and not this shop's to fix: the whole project's daily
  // quota is gone, so every till on the platform is frozen at the same moment.
  exhausted: {
    icon: AlertTriangle,
    bg: 'red.solid',
    fg: 'red.contrast',
    title: 'sync.frozenExhaustedTitle',
    body: 'sync.frozenExhaustedBody',
  },
  broken: {
    icon: AlertTriangle,
    bg: 'red.solid',
    fg: 'red.contrast',
    title: 'sync.frozenBrokenTitle',
    body: 'sync.frozenBrokenBody',
    needsDeploy: true,
  },
  // Orange, not red: nobody refused anything, the line was simply too poor to
  // hold a stream open. It is also the one reason where pressing "try again"
  // regularly works on its own.
  retries: {
    icon: CloudOff,
    bg: 'orange.solid',
    fg: 'orange.contrast',
    title: 'sync.frozenStaleTitle',
    body: 'sync.frozenStaleBody',
  },
}

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
  const { logout, lapsed, blocked } = useAuth()
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

  /**
   * Whether any of the five shared listeners has stopped for good.
   *
   * This is the one thing in the app that used to happen in complete silence:
   * liveCollection publishes "I have given up" — after a refusal, after a blown
   * quota, or after five failures in a row — keeps the last snapshot on screen,
   * and never revives the listener by itself. Every screen went on rendering
   * this morning's stock, and the till went on selling against a count nobody
   * could confirm any more, for the rest of the session.
   *
   * The shell is the right place to say it because it is the only component
   * mounted on every screen, and because it holds these five subscriptions for
   * the whole session: liveCollection retries a transient failure in the
   * background only while somebody is watching, so a store nobody is subscribed
   * to is a store that cannot report and cannot recover either. Each of these
   * hooks subscribes with a reason string rather than the collection, so the
   * ordinary flood of snapshots does not re-render the navigation — see
   * useProductsFatal in src/features/stock/useProducts.ts.
   */
  const gaveUp = [
    useProductsFatal(),
    useCustomersFatal(),
    useCategoriesFatal(),
    useSuppliersFatal(),
    usePacksFatal(),
  ]
  const worst = FROZEN_ORDER.find((reason) => gaveUp.includes(reason)) ?? null

  /**
   * A listener that gave up while the line was down heals itself the moment the
   * line comes back, and does it before anybody is told anything.
   *
   * Without this the banner would be right and useless: 'retries' means five
   * ordinary failures in a row, which is what an afternoon with no line looks
   * like, and liveCollection stops its own retry timer once it has given up. So
   * the store would stay dead through the reconnect, the sync badge would go
   * green, and the owner would be asked to press a button to fix something the
   * app could see was fixable.
   *
   * One attempt per return of the line, tracked in a ref: retrying re-arms the
   * listener, and if it fails five more times the store goes fatal again — so a
   * dependency on `worst` alone would be a loop that re-downloads all five
   * collections every fifteen seconds for as long as the fault lasted. If the
   * automatic attempt does not stick, the banner below asks the owner instead.
   */
  const healedLine = useRef(false)
  useEffect(() => {
    if (!sync.online) {
      healedLine.current = false
      return
    }
    if (worst !== 'retries' || healedLine.current) return
    healedLine.current = true
    retryLiveCollections()
  }, [sync.online, worst])

  /**
   * WHAT MAY BE SAID OUT LOUD, which is less than what is known.
   *
   * BEING OFFLINE IS THE NORMAL STATE OF THIS APP — the line goes for hours, and
   * that is precisely what the cache and the write queue are for. So a give-up
   * that is only the outage wearing the listener out ('retries' with no line)
   * stays quiet: the sync badge already says there is no line, the effect above
   * will re-arm the listener when it returns, and a red banner during every
   * ordinary afternoon would teach the owner to ignore all three of these.
   *
   * A refusal is suppressed only when the orange banner above is already up,
   * which says the same thing better: the plan lapsed. The same rule the
   * refused-write banner follows.
   */
  const frozen =
    worst === null ||
    (worst === 'retries' && !sync.online) ||
    (worst === 'refused' && lapsed)
      ? null
      : worst
  const frozenCopy = frozen === null ? null : FROZEN_COPY[frozen]
  // Capitalised so JSX reads it as a component and not as an HTML tag.
  const FrozenIcon = frozenCopy?.icon ?? AlertTriangle

  const groups: NavGroup[] = [
    {
      label: t('nav.sell'),
      items: [{ to: '/caisse', icon: ShoppingCart, label: t('nav.pos') }],
    },
    {
      label: t('nav.manage'),
      items: [
        { to: '/stock', icon: Package, label: t('nav.stock') },
        { to: '/catalog', icon: Library, label: t('catalog.title') },
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
        <StaleBuildBanner />
        <UnprotectedBanner />

        {/*
          Two things the shop must never meet in silence.

          A lapsed plan makes every write fail, and Firestore's answer to a
          refused write is to roll the change back locally — the article
          appears, then vanishes, with nothing on screen to explain it. And a
          refused write can also mean the session simply needs renewing. Either
          way the answer is a sentence, not a disappearing row.
        */}
        {/*
          TWO WINDOWS, TWO MESSAGES, AND THE DIFFERENCE MATTERS MORE THAN IT LOOKS.

          `lapsed` goes true the moment paidUntil passes, but the rules grant a
          fortnight past it (graceMs() in firestore.rules), so for those fourteen
          days every sale still saves normally. This banner nevertheless read
          "rien ne peut être enregistré" from the first minute — telling a
          shopkeeper his till had stopped recording when it had not. A
          shopkeeper who believes that starts writing tickets on paper, and then
          either enters nothing or enters everything twice; the message meant to
          protect his data was the thing most likely to cost him some.

          So: orange while there is runway — the plan has run out, renew it,
          selling continues. Red only once `blocked` says the grace has closed
          and the server really is refusing.
        */}
        {lapsed && (
          <Flex
            align="center"
            gap={3}
            px={{ base: 3, md: 6 }}
            py={2}
            bg={blocked ? 'red.solid' : 'orange.solid'}
            color={blocked ? 'red.contrast' : 'orange.contrast'}
            flexShrink={0}
          >
            <ShieldAlert size={20} />
            <Box minW={0}>
              <Text fontWeight="bold">
                {blocked ? t('auth.blockedTitle') : t('auth.lapsedTitle')}
              </Text>
              <Text fontSize="sm">{blocked ? t('auth.blockedBody') : t('auth.lapsedBody')}</Text>
            </Box>
          </Flex>
        )}

        {/*
          NOT gated on `lapsed`, and it used to be.

          The Close button below is the only call site of clearDenied() in the
          whole app, so `sync.denied && !lapsed` meant the latch could not be
          released during a lapsed period — which is precisely the period in
          which the server refuses writes and the flag is certain to be up. The
          owner was left with a permanent red badge he had no way to acknowledge,
          on the one occasion the app most needed him to still be reading it.

          Both banners showing at once is the correct outcome anyway: they say
          different things. This one says a change was rolled back; the one above
          says why.
        */}
        {sync.denied && (
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
              {/*
                Two remedies, so two sentences. 'refused' means nothing will
                save until the plan or the sign-in is put right; 'lost' means
                everything still works and one change has to be entered again.
                Telling him to sign in again for a rolled-back stock adjustment
                would send him to a login screen that fixes nothing — and
                offline, cannot even be passed.
              */}
              {sync.deniedReason === 'lost' ? t('auth.lostWrite') : t('auth.deniedWrite')}
            </Text>
            <Button size="sm" variant="outline" ms="auto" flexShrink={0} onClick={clearDenied}>
              {t('common.close')}
            </Button>
          </Flex>
        )}

        {/*
          The third thing the shop must never meet in silence, and the one that
          hides the best: the numbers on screen have stopped being updated.

          A refused write at least makes a row appear and vanish. A dead listener
          shows nothing at all — the stock table still lists everything, the
          prices still look right, and the till still rings up sales, all against
          whatever this machine last managed to confirm. There is no dismiss
          button on purpose: nothing here is news the owner can acknowledge and
          move on from, it goes away when the data is live again.
        */}
        {frozenCopy !== null && (
          <Flex
            align="center"
            gap={3}
            px={{ base: 3, md: 6 }}
            py={2}
            bg={frozenCopy.bg}
            color={frozenCopy.fg}
            flexShrink={0}
          >
            <FrozenIcon size={20} />
            <Box minW={0}>
              <Text fontWeight="bold">{t(frozenCopy.title)}</Text>
              <Text fontSize="sm">{t(frozenCopy.body)}</Text>
            </Box>
            {frozenCopy.needsDeploy ? (
              /*
                The only case where re-arming the listener is pointless: the query
                is malformed or its index is missing, so it answers the same way
                however often it is asked, and only a new build changes that.
                Picking one up needs a line, and with the line down a reload is
                the single action that can cost the shop the app entirely — the
                service worker may be holding a half-installed set of chunks — so
                offline the sentence stands alone and offers nothing.
              */
              sync.online && (
                <Button
                  size="sm"
                  variant="outline"
                  ms="auto"
                  flexShrink={0}
                  onClick={() => window.location.reload()}
                >
                  {t('sync.frozenReload')}
                </Button>
              )
            ) : (
              /*
                Every other reason gets the hand-wound recovery liveCollection
                exposes: it re-arms all five listeners at once, costs one attempt,
                and is the only way back that does not risk the app the way a
                reload does.
              */
              <Button
                size="sm"
                variant="outline"
                ms="auto"
                flexShrink={0}
                onClick={retryLiveCollections}
              >
                {t('common.retry')}
              </Button>
            )}
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
