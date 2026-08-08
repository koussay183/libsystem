import { useEffect, useRef } from 'react'

/**
 * Returns a ref that is true while the component is mounted. Use it to avoid
 * acting (e.g. calling onClose) after an await when the component has since
 * unmounted — which otherwise could close a freshly-reopened modal.
 */
export function useAlive() {
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  return alive
}
