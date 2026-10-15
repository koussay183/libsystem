import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Flex, HStack, IconButton, Text } from '@chakra-ui/react'
import { CalendarClock, MessageCircle, Phone, RefreshCw, ShieldAlert, X } from 'lucide-react'
import dayjs from 'dayjs'
import { useAuth } from '@/auth/AuthContext'
import type { ClaimCheck } from '@/auth/AuthContext'
import { useShopSettings } from '@/features/settings/useShopSettings'
import { CONTACT_DISPLAY, CONTACT_TEL, whatsappLink } from '@/lib/contact'

const DAY_MS = 24 * 60 * 60 * 1000

/** The "ends soon" banner can be put away for the day, not for good. */
const SNOOZE_KEY = 'plan.snoozedOn'

function today(): string {
  return dayjs().format('YYYY-MM-DD')
}

function readSnoozed(): boolean {
  try {
    return localStorage.getItem(SNOOZE_KEY) === today()
  } catch {
    return false
  }
}

function writeSnoozed() {
  try {
    localStorage.setItem(SNOOZE_KEY, today())
  } catch {
    /* storage refused — it is hidden for this session only */
  }
}

/** Whole days left until `at`, never below zero. */
function daysUntil(at: number): number {
  return Math.max(0, Math.ceil((at - Date.now()) / DAY_MS))
}

/**
 * The plan, said with dates and with a way to pay.
 *
 * Three states. A week before the deadline: a yellow note the owner can put
 * away until tomorrow. Past the deadline but inside the grace window: orange,
 * with the exact day the server will start refusing — "quelques jours encore"
 * was not something anyone could plan around. Past the grace: red.
 *
 * Every state carries the renewal itself: WhatsApp with the shop already
 * named, and the number to call. Lapsed states also get "J'ai renouvelé", since
 * a renewal only reaches this till with a fresh token.
 */
export function PlanBanner() {
  const { t } = useTranslation()
  const { shopId, paidUntil, lapsed, blocked, expiresSoon, graceEndsAt, refreshClaims } =
    useAuth()
  const { shop } = useShopSettings()
  const [snoozed, setSnoozed] = useState(readSnoozed)
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<ClaimCheck | null>(null)

  if (paidUntil === null) return null
  const soon = expiresSoon && !lapsed && !snoozed
  if (!lapsed && !soon) return null

  const date = dayjs(paidUntil).format('DD/MM/YYYY')
  const graceEnd = graceEndsAt === null ? date : dayjs(graceEndsAt).format('DD/MM/YYYY')

  const bg = blocked ? 'red.solid' : lapsed ? 'orange.solid' : 'yellow.subtle'
  const fg = blocked ? 'red.contrast' : lapsed ? 'orange.contrast' : 'yellow.fg'

  const title = blocked
    ? t('auth.blockedTitle')
    : lapsed
      ? t('auth.lapsedTitle')
      : t('platformFix.planEndsSoonTitle')
  const body = blocked
    ? t('platformFix.planBlockedBody', { date, graceEnd })
    : lapsed
      ? t('platformFix.planLapsedBody', {
          date,
          graceEnd,
          count: graceEndsAt === null ? 0 : daysUntil(graceEndsAt),
        })
      : t('platformFix.planEndsSoonBody', { date, count: daysUntil(paidUntil) })

  const renewText = t('platformFix.renewMessage', {
    shop: shop.name || shopId,
    id: shopId,
  })

  const verify = async () => {
    setChecking(true)
    setCheck(null)
    try {
      setCheck(await refreshClaims())
    } finally {
      setChecking(false)
    }
  }

  const solid = lapsed
  return (
    <Flex
      // A lockout is announced at once; the warnings wait their turn.
      role={blocked ? 'alert' : 'status'}
      align="center"
      gap={3}
      wrap="wrap"
      px={{ base: 3, md: 6 }}
      py={2}
      bg={bg}
      color={fg}
      flexShrink={0}
    >
      <Box flexShrink={0}>
        {lapsed ? <ShieldAlert size={20} /> : <CalendarClock size={20} />}
      </Box>
      <Box minW={0} flex="1 1 18rem">
        <Text fontWeight="bold">{title}</Text>
        <Text fontSize="sm">{body}</Text>
        {check === 'unchanged' && (
          <Text fontSize="sm" fontWeight="semibold">
            {t('platformFix.renewNotYet')}
          </Text>
        )}
        {check === 'unreachable' && (
          <Text fontSize="sm" fontWeight="semibold">
            {t('platformFix.renewOffline')}
          </Text>
        )}
      </Box>
      <HStack gap={2} wrap="wrap" minW={0} w={{ base: 'full', md: 'auto' }}>
        <Button
          asChild
          size="sm"
          colorPalette="green"
          variant={solid ? 'subtle' : 'solid'}
        >
          <a href={whatsappLink(renewText)} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} />
            {t('platformFix.renewWhatsapp')}
          </a>
        </Button>
        <IconButton
          asChild
          size="sm"
          variant="outline"
          color="inherit"
          aria-label={t('platformFix.callUs', { phone: CONTACT_DISPLAY })}
          title={CONTACT_DISPLAY}
        >
          <a href={CONTACT_TEL}>
            <Phone size={16} />
          </a>
        </IconButton>
        {lapsed && (
          <Button size="sm" variant="outline" color="inherit" loading={checking} onClick={verify}>
            <RefreshCw size={16} />
            {t('platformFix.renewCheck')}
          </Button>
        )}
        {!lapsed && (
          <IconButton
            size="sm"
            variant="ghost"
            color="inherit"
            aria-label={t('platformFix.planSnooze')}
            title={t('platformFix.planSnooze')}
            onClick={() => {
              writeSnoozed()
              setSnoozed(true)
            }}
          >
            <X size={16} />
          </IconButton>
        )}
      </HStack>
    </Flex>
  )
}
