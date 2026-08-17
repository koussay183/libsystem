import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Card,
  Collapsible,
  Flex,
  Heading,
  Stack,
  Text,
} from '@chakra-ui/react'
import { ChevronDown, RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react'

/**
 * Turns a render-time throw into a screen the shop can read, instead of the
 * white page it produces today.
 *
 * Why this exists at all: a single throw anywhere in the tree unmounts the
 * whole root. Offline that is unrecoverable by the one move a shopkeeper knows
 * — the service worker serves `/assets/*` cache-first with no fallback, so a
 * chunk that failed to download during install stays failed, and reloading a
 * blank page with no line only produces another blank page. The owner is
 * standing at a counter with a customer in front of him and no way back in.
 *
 * Why a class: `componentDidCatch` / `getDerivedStateFromError` are still the
 * only way to catch a descendant's throw in React 19. There is no hook.
 *
 * What it does NOT catch, so nobody assumes otherwise: throws inside a native
 * event listener (the barcode wedge arms its own window `keydown`), inside a
 * `setTimeout`, and rejected promises. Those never pass through React's render
 * phase and never reach a boundary.
 */
interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * Which boundary this is, printed with the console line. The owner reads the
   * console back to us over the phone; "root" versus "route" is the difference
   * between "the shell broke" and "one page broke".
   */
  where: string
  /**
   * The root boundary owns the whole viewport because there is nothing else on
   * screen. The route-level one sits inside AppShell, where taking 100dvh would
   * push the navigation the owner needs in order to walk to another screen.
   */
  fullScreen?: boolean
}

interface ErrorBoundaryState {
  error: Error | null
  /** React's component stack for the throw, kept so the fallback can show it. */
  stack: string
}

/**
 * One readable line for the thrown value. Typed `unknown` deliberately: React's
 * signature promises an `Error`, but a throw is not required to be one — `throw
 * 'boom'`, a rejected string, a DOMException — and this function runs on the
 * screen whose entire job is to not crash.
 */
function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message ? `${error.name}: ${error.message}` : error.name
  }
  try {
    return String(error)
  } catch {
    return 'Error'
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, stack: '' }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // There is no telemetry of any kind in this app. The console is the only
    // record that a crash ever happened, and the only thing we can ask the shop
    // to photograph, so both halves go there in full: the error with its own
    // stack, and React's component stack, which is what actually names the
    // screen that threw.
    console.error(`[crash:${this.props.where}]`, error)
    console.error(`[crash:${this.props.where}] component stack:`, info.componentStack)
    this.setState({ stack: info.componentStack ?? '' })
  }

  /**
   * Drop the error and render the children again. A remount is genuinely enough
   * for a transient render error — one odd product in a snapshot, a field that
   * arrived undefined. It is NOT enough for a chunk that failed to download:
   * React caches a rejected `lazy()` import, so that case throws again straight
   * away and lands back on this screen. That is why "Recharger" is offered
   * next to it and not instead of it.
   */
  private retry = () => {
    this.setState({ error: null, stack: '' })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <CrashScreen
        detail={describe(this.state.error)}
        stack={this.state.stack}
        fullScreen={this.props.fullScreen}
        onRetry={this.retry}
      />
    )
  }
}

interface CrashScreenProps {
  detail: string
  stack: string
  fullScreen?: boolean
  onRetry: () => void
}

/**
 * The fallback, as a function component so it can translate itself and follow a
 * language change. Direction comes from the `dir` attribute on <html>
 * (`i18n/index.ts` applyDirection), and every box below is laid out with logical
 * Chakra props, so Arabic mirrors without a second code path — except the
 * technical detail, which is forced LTR the way the setup screen forces it: an
 * English exception message reordered by the bidi algorithm is unreadable, and
 * this is the one line that has to survive being read out loud.
 */
function CrashScreen({ detail, stack, fullScreen, onRetry }: CrashScreenProps) {
  const { t } = useTranslation()

  return (
    <Flex
      minH={fullScreen ? '100dvh' : '50dvh'}
      align="center"
      justify="center"
      p={4}
      bg={fullScreen ? 'bg.subtle' : undefined}
    >
      <Card.Root maxW="34rem" w="full">
        <Card.Body p={{ base: 6, md: 8 }}>
          <Stack gap={5}>
            <Flex align="center" gap={3}>
              <Box bg="orange.subtle" color="orange.fg" p={3} borderRadius="lg">
                <TriangleAlert size={28} />
              </Box>
              <Heading size="xl">{t('crash.title')}</Heading>
            </Flex>

            {/* The one thing the owner needs to know before he decides whether
                to panic: the sales already taken are on this machine. */}
            <Text color="fg.muted" fontSize="lg">
              {t('crash.body')}
            </Text>

            <Flex gap={3} wrap="wrap">
              <Button size="lg" colorPalette="brand" onClick={onRetry}>
                <RotateCcw size={20} />
                {t('common.retry')}
              </Button>
              <Button size="lg" variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw size={20} />
                {t('crash.reload')}
              </Button>
            </Flex>

            {/* Collapsed, muted, and last. It is here because the owner will
                read it to us over the phone, so it must exist — but a shop
                floor does not need a stack trace shouted at it. */}
            <Collapsible.Root>
              <Collapsible.Trigger asChild>
                <Button size="sm" variant="ghost" color="fg.muted">
                  {t('crash.details')}
                  <ChevronDown size={16} />
                </Button>
              </Collapsible.Trigger>
              <Collapsible.Content>
                <Text fontSize="sm" color="fg.muted" mt={2}>
                  {t('crash.hint')}
                </Text>
                <Box
                  as="pre"
                  dir="ltr"
                  mt={2}
                  p={3}
                  borderRadius="lg"
                  bg="bg.muted"
                  color="fg.muted"
                  fontFamily="mono"
                  fontSize="xs"
                  whiteSpace="pre-wrap"
                  maxH="12rem"
                  overflow="auto"
                >
                  {stack ? `${detail}\n${stack}` : detail}
                </Box>
              </Collapsible.Content>
            </Collapsible.Root>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Flex>
  )
}
