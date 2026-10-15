import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Flex, HStack, IconButton, Text } from '@chakra-ui/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * The page numbers worth showing: the first, the last, and the neighbours of
 * the current page. `null` is a gap ("…").
 *
 * Seven slots at most, whatever the page count, so the row never wraps on a
 * tablet — a pager that breaks onto two lines puts "Suivant" under "1".
 */
function pageSlots(page: number, count: number): (number | null)[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  if (page <= 4) return [1, 2, 3, 4, 5, null, count]
  if (page >= count - 3) return [1, null, count - 4, count - 3, count - 2, count - 1, count]
  return [1, null, page - 1, page, page + 1, null, count]
}

/** Arrows point the way the page turns, which in Arabic is the other way. */
function Arrow({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <Box _rtl={{ transform: 'rotate(180deg)' }} display="inline-flex">
      {dir === 'prev' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
    </Box>
  )
}

export interface PagerProps {
  /** 1-based. */
  page: number
  pageCount: number
  /** Index of the first row on the page, and one past the last. */
  start: number
  end: number
  total: number
  onChange: (page: number) => void
  /**
   * Brought back into view after a page change. The pager sits under the list,
   * so without this the owner turns the page and is left looking at the
   * bottom of it.
   */
  anchorRef?: RefObject<HTMLElement | null>
}

/**
 * Previous / numbers / next, and "26–50 sur 480".
 *
 * Big buttons and plain words rather than a row of tiny digits: the owner is
 * not a power user, and "Suivant" is a thing he can find without being told.
 * Says nothing at all when everything fits on one page.
 */
export function Pager({ page, pageCount, start, end, total, onChange, anchorRef }: PagerProps) {
  const { t } = useTranslation()
  if (pageCount <= 1) return null

  const go = (next: number) => {
    if (next < 1 || next > pageCount || next === page) return
    onChange(next)
    const el = anchorRef?.current
    if (el) {
      // Only when the top of the list has scrolled away — a short list that is
      // already on screen should not jump. 80 px clears the sticky header.
      const top = el.getBoundingClientRect().top
      if (top < 0) {
        // A smooth scroll is many frames of repaint; skip it where motion is reduced.
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: window.scrollY + top - 80, behavior: still ? 'auto' : 'smooth' })
      }
    }
  }

  return (
    <Flex
      align="center"
      justify="space-between"
      gap={3}
      wrap="wrap"
      mt={4}
      as="nav"
      aria-label={t('common.pagination')}
    >
      <Text color="fg.muted" fontSize="sm">
        {t('common.range', { from: start + 1, to: end, total })}
      </Text>

      <HStack gap={1}>
        <Button size="lg" variant="outline" disabled={page <= 1} onClick={() => go(page - 1)}>
          <Arrow dir="prev" />
          <Text as="span" display={{ base: 'none', sm: 'inline' }}>
            {t('common.prev')}
          </Text>
        </Button>

        {/* Numbers from a tablet up; on a phone, "3 / 12" says the same. */}
        <HStack gap={1} display={{ base: 'none', md: 'flex' }}>
          {pageSlots(page, pageCount).map((n, i) =>
            n === null ? (
              <Text key={`gap-${i}`} px={1} color="fg.muted" aria-hidden>
                …
              </Text>
            ) : (
              <IconButton
                key={n}
                size="lg"
                variant={n === page ? 'solid' : 'ghost'}
                colorPalette={n === page ? 'brand' : 'gray'}
                aria-label={t('common.pageN', { page: n })}
                aria-current={n === page ? 'page' : undefined}
                onClick={() => go(n)}
              >
                {n}
              </IconButton>
            ),
          )}
        </HStack>
        <Text display={{ base: 'block', md: 'none' }} px={2} fontWeight="semibold">
          {page} / {pageCount}
        </Text>

        <Button
          size="lg"
          variant="outline"
          disabled={page >= pageCount}
          onClick={() => go(page + 1)}
        >
          <Text as="span" display={{ base: 'none', sm: 'inline' }}>
            {t('common.next')}
          </Text>
          <Arrow dir="next" />
        </Button>
      </HStack>
    </Flex>
  )
}
