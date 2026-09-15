import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, HStack, Portal, Stack, Text } from '@chakra-ui/react'
import { OctagonX, Plus } from 'lucide-react'
import type { CatalogEntry } from '@/lib/catalog'

/**
 * THE TILL, STOPPED. A code was scanned that matches nothing this shop sells.
 *
 * Before this existed the miss was an orange line above the ticket and a
 * two-note beep. Both were routinely scanned straight past: the cashier is
 * looking at the customer, the next article is already in his hand, and the
 * beep for "unknown" is not so different from the beep for "added". So a
 * basket of six went through with five on the ticket, and nobody knew which
 * one was missing until the customer counted his change.
 *
 * This covers the whole screen in red and refuses every further scan until a
 * human has pressed a button. It is deliberately NOT a Chakra Dialog: a dialog
 * traps focus on itself, and the scanner wedge (useBarcodeScanner) exists
 * precisely to pull focus back to the scan field — the two would fight, and
 * the loser is whichever the next keystroke lands in.
 *
 * WHAT MAY DISMISS IT, and what may not. A button, Escape, or Space — after a
 * short grace period, and never a key that arrives at machine speed. Enter is
 * excluded outright: a scanner that sends a suffix sends Enter, and the whole
 * point is that the NEXT sweep of the reader must not make this go away. The
 * grace period restarts on every refused scan for the same reason. No button
 * has autoFocus either: a QR label carrying a space would "press" it.
 */
export function UnknownScanOverlay({
  code,
  at,
  nag,
  recognised,
  onDismiss,
  onCreate,
}: {
  /** What was scanned, as the cashier sees it. */
  code: string
  /** performance.now() of the miss, or of the last refused scan since. */
  at: number
  /** How many further scans were refused while this was up. */
  nag: number
  /** What the shared catalogue calls the code, when it answered. */
  recognised: CatalogEntry | null
  onDismiss: () => void
  onCreate: () => void
}) {
  const { t } = useTranslation()
  const lastKey = useRef(0)
  const atRef = useRef(at)
  atRef.current = at

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const now = performance.now()
      const gap = now - lastKey.current
      lastKey.current = now
      // Inside the grace window after the miss (or after the last refused
      // scan): whatever this key is, it is part of a burst, not a decision.
      if (now - atRef.current < GRACE_MS) return
      // Machine speed. The chooser dialog uses the same test.
      if (gap < MACHINE_GAP_MS) return
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        onDismiss()
      }
    }
    // Bubble phase, on purpose: the wedge listens in the capture phase and
    // swallows a scanner's trailing Enter before it could get here.
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <Portal>
      <Box
        position="fixed"
        inset={0}
        zIndex="max"
        bg="red.solid"
        color="red.contrast"
        role="alertdialog"
        aria-live="assertive"
        aria-label={t('pos.unknownTitle')}
        display="grid"
        placeItems="center"
        px={6}
        py={8}
        overflowY="auto"
      >
        <Stack gap={6} align="center" textAlign="center" maxW="46rem" w="full">
          <OctagonX size={96} strokeWidth={1.75} />

          <Text
            fontSize={{ base: '3xl', md: '5xl' }}
            fontWeight="black"
            letterSpacing="wider"
            lineHeight="1.1"
          >
            {t('pos.unknownTitle')}
          </Text>

          <Box
            bg="whiteAlpha.300"
            px={5}
            py={2}
            borderRadius="xl"
            fontFamily="mono"
            fontSize={{ base: 'xl', md: '3xl' }}
            fontWeight="bold"
            wordBreak="break-all"
          >
            {code}
          </Box>

          <Text fontSize={{ base: 'lg', md: 'xl' }} opacity={0.95}>
            {t('pos.unknownBody')}
          </Text>

          {recognised && (
            <Text fontSize="lg" fontWeight="semibold" opacity={0.95}>
              {t('pos.unknownRecognised', { name: recognised.name })}
            </Text>
          )}

          {nag > 0 && (
            <Box
              bg="white"
              color="red.700"
              px={5}
              py={3}
              borderRadius="xl"
              fontSize={{ base: 'lg', md: '2xl' }}
              fontWeight="bold"
            >
              {t('pos.unknownNag')}
            </Box>
          )}

          <HStack gap={4} wrap="wrap" justify="center" pt={2}>
            <Button
              size="2xl"
              h="4.5rem"
              px={10}
              fontSize="2xl"
              fontWeight="bold"
              bg="white"
              color="red.700"
              _hover={{ bg: 'red.50' }}
              onClick={onDismiss}
            >
              {t('pos.unknownAck')}
            </Button>
            <Button
              size="xl"
              h="4.5rem"
              px={6}
              variant="outline"
              borderColor="whiteAlpha.700"
              color="red.contrast"
              _hover={{ bg: 'whiteAlpha.200' }}
              onClick={onCreate}
            >
              <Plus size={22} />
              {t('pos.createFromScan')}
            </Button>
          </HStack>

          <Text fontSize="sm" opacity={0.8}>
            {t('pos.unknownKeys')}
          </Text>
        </Stack>
      </Box>
    </Portal>
  )
}

/**
 * How long after the miss — or after the last refused scan — a key is still
 * treated as part of the scanner's burst rather than as an answer.
 */
const GRACE_MS = 150

/** A key this soon after the previous one was not pressed by a hand. */
const MACHINE_GAP_MS = 90
