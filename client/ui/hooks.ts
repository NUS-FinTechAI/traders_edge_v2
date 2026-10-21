import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

/** Call `callback` every `intervalMs` while `active`. */
export function usePolling(
  callback: () => void,
  intervalMs: number,
  active = true,
): void {
  const saved = useRef(callback)
  useEffect(() => {
    saved.current = callback
  })
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => saved.current(), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, active])
}

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Current time, refreshed every `intervalMs` (for elapsed and "next try" text). */
export function useNow(intervalMs = 1000, active = true): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!active) return () => {}
      const timer = setInterval(onChange, intervalMs)
      return () => clearInterval(timer)
    },
    [intervalMs, active],
  )
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  )
}
