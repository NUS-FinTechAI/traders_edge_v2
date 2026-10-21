import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * Call `callback` about every `intervalMs` while `active`. A slow request is
 * never overlapped by the next one, and polling pauses while the tab is
 * hidden (with an immediate call when it becomes visible again).
 */
export function usePolling(
  callback: () => Promise<unknown> | void,
  intervalMs: number,
  active = true,
): void {
  const saved = useRef(callback)
  useEffect(() => {
    saved.current = callback
  })
  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let running = false
    let stopped = false

    function schedule() {
      if (timer) clearTimeout(timer)
      timer = stopped || document.hidden ? null : setTimeout(tick, intervalMs)
    }

    async function tick() {
      timer = null
      if (running || stopped || document.hidden) return
      running = true
      try {
        await saved.current()
      } catch {
        // Callers surface their own errors; keep polling.
      } finally {
        running = false
        schedule()
      }
    }

    function onVisibility() {
      if (document.hidden) {
        if (timer) clearTimeout(timer)
        timer = null
      } else if (!running) {
        void tick()
      }
    }

    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
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
