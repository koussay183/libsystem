import { useCallback, useState } from 'react'

/**
 * useState that survives leaving the page and coming back, for this tab only.
 *
 * For list filters and sort orders: the owner who narrowed the stock to
 * "Cahiers / stock bas", opened a sale and came back expects to find his list
 * as he left it, not reset to everything. sessionStorage rather than
 * localStorage on purpose — tomorrow morning the lists start clean, so a
 * forgotten filter can never pass for "my articles are gone".
 *
 * Every access is guarded: private mode and kiosk profiles throw on storage,
 * and a filter that cannot be remembered must still work.
 */
const PREFIX = 'ui.'

export function readSession<T>(key: string, fallback: T, valid?: (v: unknown) => boolean): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    // A value of the wrong shape (left by an older version of the app) is
    // ignored rather than trusted.
    if (typeof value !== typeof fallback) return fallback
    if (valid && !valid(value)) return fallback
    return value as T
  } catch {
    return fallback
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage refused — the value still holds until the page is left */
  }
}

/**
 * `valid` narrows what is accepted back, e.g. `(v) => SORTS.includes(v)` for a
 * select whose options may have changed since the value was stored.
 */
export function useSessionState<T>(
  key: string,
  initial: T,
  valid?: (v: unknown) => boolean,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => readSession(key, initial, valid))
  const set = useCallback(
    (next: T) => {
      setValue(next)
      writeSession(key, next)
    },
    [key],
  )
  return [value, set]
}

/** Shorthand for `valid`: the stored value must be one of these. */
export const oneOf =
  (options: readonly unknown[]) =>
  (v: unknown): boolean =>
    options.includes(v)
