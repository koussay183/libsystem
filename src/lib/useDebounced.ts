import { useEffect, useState } from 'react'

/**
 * `value`, once it has stopped changing for `ms`.
 *
 * For searches that go to the SERVER, where useDeferredValue does not help:
 * every letter was a Firestore query over the shop line, billed and raced.
 * `immediate` lets a value through at once — clearing a box should not wait.
 */
export function useDebounced<T>(value: T, ms: number, immediate?: (value: T) => boolean): T {
  const [settled, setSettled] = useState(value)
  const now = immediate?.(value) ?? false
  useEffect(() => {
    if (now) {
      // Kept in step, so the next letter does not briefly bring back a stale term.
      setSettled(value)
      return
    }
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms, now])
  return now ? value : settled
}
