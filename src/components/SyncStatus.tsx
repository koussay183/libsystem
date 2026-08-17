import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Flex, HStack, Text } from '@chakra-ui/react'
import { AlertTriangle, Cloud, CloudOff, RefreshCw, ShieldAlert, UploadCloud } from 'lucide-react'
import dayjs from 'dayjs'
import { syncStore } from '@/lib/syncStatus'
import { updateStore, applyUpdate, staleStore, unprotectedStore } from '@/lib/serviceWorker'

/** How long "everything is saved" stays green after the queue empties. */
const SAVED_MS = 4000

/**
 * The time the queue was last proven empty. The date is added as soon as it is
 * not today's: "enregistré 08:15" on a Tuesday morning, about work that in fact
 * landed on Saturday, is the same reassuring lie this component was rewritten to
 * stop telling.
 */
function clock(ts: number): string {
  const at = dayjs(ts)
  return at.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
    ? at.format('HH:mm')
    : at.format('DD/MM HH:mm')
}

/**
 * One badge, five shapes. `loud` keeps the words on screen at every width: the
 * calm states can afford to be an icon on a phone, but "no line" and "not
 * confirmed" are the two the owner must never have to hover to read.
 */
function Pill({
  palette,
  variant,
  icon,
  label,
  hint,
  loud,
}: {
  palette: 'gray' | 'green' | 'blue' | 'yellow' | 'orange' | 'red'
  variant: 'solid' | 'subtle'
  icon: ReactNode
  label: string
  hint: string
  loud?: boolean
}) {
  return (
    <Badge
      colorPalette={palette}
      variant={variant}
      size="lg"
      px={3}
      py={2}
      borderRadius="lg"
      title={hint}
    >
      {icon}
      <Text as="span" ms={1} display={loud ? 'inline' : { base: 'none', md: 'inline' }}>
        {label}
      </Text>
    </Badge>
  )
}

/**
 * Whether the shop has a line, and whether anything is still on its way up.
 *
 * The owner sells through a connection drop without noticing — which is the
 * point — so the one thing he must never have to guess is whether his tickets
 * actually left the building. This badge is the only instrument he has for that,
 * which is why it is allowed to say four things about the work:
 *
 *   · no line, and how much is waiting behind it;
 *   · work leaving now;
 *   · work from a previous session that the server has not confirmed — the
 *     state that used to be invisible, and the one that costs a shop its week;
 *   · everything confirmed, with the time it was confirmed.
 *
 * On top of those, one loud state for a refusal — which is not a delay and must
 * not be dressed as one — and a plain "checking" for the second or two before
 * src/lib/syncStatus.ts has a verdict on the line. That last one exists so the
 * badge never has to pick a side while it does not know: guessing "saved" there
 * is the exact failure this whole component was rewritten to remove, and
 * guessing "no line" on every page load would teach the owner to ignore orange.
 */
export function SyncStatus() {
  const { t } = useTranslation()
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot, syncStore.getSnapshot)
  const [, forceTick] = useState(0)

  // "Saved" fades on its own; nothing else changes at that moment, so the
  // component has to be nudged to re-render when the window closes.
  useEffect(() => {
    if (!sync.syncedAt) return
    const id = setTimeout(() => forceTick((n) => n + 1), SAVED_MS)
    return () => clearTimeout(id)
  }, [sync.syncedAt])

  // Everything not yet acknowledged, whether this session started it or a
  // previous one did. Offline the owner does not care which — he cares how much
  // is riding on this machine.
  const waiting = sync.pending + sync.carried

  /*
    NO LINE OUTRANKS A REJECTION, and the order of these two branches was the
    other way round.

    `denied` is latched on disk until the owner dismisses it, so once anything
    had been rejected this component returned the red pill FIRST, on every
    render of every later session. The badge then never again showed "Hors
    ligne — 312 à envoyer": through a three-week outage carrying three hundred
    unsent tickets, the one instrument that reports them was stuck on a message
    about a write that failed a fortnight ago.

    The rejection has not been dropped — it is on the red banner in AppShell,
    where it has a dismiss button and room for a sentence. What the header must
    show is the thing that changes minute to minute and governs what the owner
    should do next: whether the machine has a line, and how much is riding on it.
  */
  if (!sync.online && !sync.probing) {
    return (
      <Pill
        palette="orange"
        variant="solid"
        icon={<CloudOff size={18} />}
        label={waiting > 0 ? t('sync.offlineWaiting', { count: waiting }) : t('sync.offline')}
        hint={t('sync.offlineHint')}
        loud
      />
    )
  }

  // With a line, a rejection is the most important thing on the header: the
  // write was rolled back, so "sending" and "saved" would both be false.
  if (sync.denied) {
    const lost = sync.deniedReason === 'lost'
    return (
      <Pill
        palette="red"
        variant="solid"
        icon={<ShieldAlert size={18} />}
        label={lost ? t('sync.lost') : t('sync.refused')}
        hint={lost ? t('sync.lostHint') : t('sync.refusedHint')}
        loud
      />
    )
  }

  if (sync.pending > 0) {
    return (
      <Pill
        palette="blue"
        variant="subtle"
        icon={<UploadCloud size={18} />}
        label={t('sync.sendingCount', { count: sync.pending })}
        hint={t('sync.sendingHint')}
      />
    )
  }

  // Writes an earlier session left behind. Nothing in this one can settle them,
  // so this stays up until Firestore itself confirms the queue is empty.
  if (sync.carried > 0) {
    return (
      <Pill
        palette="yellow"
        variant="solid"
        icon={<AlertTriangle size={18} />}
        label={t('sync.unconfirmed', { count: sync.carried })}
        hint={t('sync.unconfirmedHint')}
        loud
      />
    )
  }

  if (sync.probing) {
    return (
      <Pill
        palette="gray"
        variant="subtle"
        icon={<Cloud size={18} />}
        label={t('sync.checking')}
        hint={t('sync.checkingHint')}
      />
    )
  }

  const justSaved = sync.syncedAt !== null && Date.now() - sync.syncedAt < SAVED_MS
  return (
    <Pill
      palette={justSaved ? 'green' : 'gray'}
      variant="subtle"
      icon={<Cloud size={18} />}
      // A device that has never written anything has nothing to have saved, so
      // it says only that the line is up — which now means a real answer from
      // Firestore rather than the operating system's opinion.
      label={sync.syncedAt === null ? t('sync.online') : t('sync.savedAt', { time: clock(sync.syncedAt) })}
      hint={t('sync.onlineHint')}
    />
  )
}

/**
 * A new build is installed and waiting. It is never applied mid-sale on its
 * own, so the owner is asked — and if he ignores it, it lands on the next
 * time the app is opened cold.
 */
export function UpdateBanner() {
  const { t } = useTranslation()
  const waiting = useSyncExternalStore(
    updateStore.subscribe,
    updateStore.getSnapshot,
    updateStore.getSnapshot,
  )
  if (!waiting) return null

  return (
    <Flex
      align="center"
      gap={3}
      wrap="wrap"
      px={{ base: 3, md: 6 }}
      py={2}
      bg="brand.subtle"
      color="brand.fg"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <HStack gap={2} minW={0} flex="1">
        <RefreshCw size={18} />
        <Text fontWeight="semibold" truncate>
          {t('sync.updateReady')}
        </Text>
      </HStack>
      <Button size="sm" colorPalette="brand" onClick={applyUpdate} flexShrink={0}>
        {t('sync.updateNow')}
      </Button>
    </Flex>
  )
}

/**
 * "This tab has no offline protection."
 *
 * A hard reload — Ctrl+Shift+R, which is what a shopkeeper does when the screen
 * looks wrong — bypasses the service worker in Chrome and Edge. The page then
 * runs uncontrolled, so the next time the line drops there is nothing to serve
 * it and the browser's error page is all he gets. Nothing inside a worker can
 * prevent that, and the cure is a single ordinary reload, which nobody would ever
 * guess. So it is said out loud, once, with the button that does it.
 */
export function UnprotectedBanner() {
  const { t } = useTranslation()
  const bare = useSyncExternalStore(
    unprotectedStore.subscribe,
    unprotectedStore.getSnapshot,
    unprotectedStore.getSnapshot,
  )
  if (!bare) return null

  return (
    <Flex
      align="center"
      gap={3}
      wrap="wrap"
      px={{ base: 3, md: 6 }}
      py={2}
      bg="orange.subtle"
      color="orange.fg"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <HStack gap={2} minW={0} flex="1">
        <CloudOff size={18} />
        <Text fontWeight="semibold">{t('sync.unprotected')}</Text>
      </HStack>
      <Button
        size="sm"
        variant="outline"
        flexShrink={0}
        onClick={() => {
          window.location.reload()
        }}
      >
        {t('sync.reloadNow')}
      </Button>
    </Flex>
  )
}

/**
 * "This tab is running a build that has already been replaced."
 *
 * The other half of UpdateBanner, and it only happens on a machine with two tabs
 * open — which the shop PC has, the till on one and the stock on the other. The
 * owner accepts the update in one tab; that worker calls skipWaiting and
 * clients.claim(), and its activate() deletes the previous cache version. This
 * tab keeps running perfectly well on chunks it has already loaded, and then the
 * first lazy route it has NOT loaded misses a cache that no longer holds it and a
 * server that no longer serves that fingerprinted filename — a blank screen on a
 * page that worked a minute ago.
 *
 * serviceWorker.ts detected this and published it; nothing rendered it, so the
 * case was diagnosed and then kept secret. Deliberately not a reload: something
 * may be on the counter. It is a warning with a button, and the owner chooses
 * when.
 */
export function StaleBuildBanner() {
  const { t } = useTranslation()
  const stale = useSyncExternalStore(
    staleStore.subscribe,
    staleStore.getSnapshot,
    staleStore.getSnapshot,
  )
  if (!stale) return null

  return (
    <Flex
      align="center"
      gap={3}
      wrap="wrap"
      px={{ base: 3, md: 6 }}
      py={2}
      bg="yellow.subtle"
      color="yellow.fg"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <HStack gap={2} minW={0} flex="1">
        <AlertTriangle size={18} />
        <Text fontWeight="semibold">{t('sync.staleBuild')}</Text>
      </HStack>
      <Button
        size="sm"
        variant="outline"
        flexShrink={0}
        onClick={() => {
          window.location.reload()
        }}
      >
        {t('sync.reloadNow')}
      </Button>
    </Flex>
  )
}
