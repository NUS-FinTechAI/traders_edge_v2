import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getGame,
  isNewer,
  lastBarTick,
  mergeGameState,
  type GameState,
} from '../../services/gameService.ts'
import { HttpError } from '../../services/httpService.ts'
import { errorText } from '../../ui/useResource.ts'
import { isEnded } from './arenaLogic.ts'
import { isRetryable, retryDelay } from './retry.ts'

const SLOW_POLL = 4000
const MIN_POLL = 250
const MAX_POLL = 1500

/** Delay before the next poll: just after the next expected tick while running. */
function pollDelay(state: GameState): number | null {
  if (isEnded(state)) return null
  if (state.status === 'briefing' || state.paused) return SLOW_POLL
  if (state.next_tick_at) {
    const wait = state.next_tick_at - state.server_time + 60
    return Math.min(MAX_POLL, Math.max(MIN_POLL, wait))
  }
  return 500
}

export interface GameFailure {
  message: string
  /** HTTP status of a refusal that retrying cannot fix, such as 403 or 404. */
  status: number | null
}

export interface GameConnection {
  state: GameState | null
  /** First load failed with a retryable error (network or server). */
  loadError: string | null
  /** The server refused the match outright; polling has stopped. */
  failure: GameFailure | null
  reconnecting: boolean
  /** Fetch now and reschedule; resolves with the merged state, or null on failure. */
  refresh: () => Promise<GameState | null>
  /** Merge a state returned by a command and reschedule the next poll. */
  accept: (incoming: GameState) => GameState
  /** Stop polling, e.g. once the result is on screen. */
  stop: () => void
}

/** Poll a match's public state, merging incremental `since` responses. */
export default function useGame(gameId: string): GameConnection {
  const [state, setState] = useState<GameState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [failure, setFailure] = useState<GameFailure | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const stateRef = useRef<GameState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef = useRef<() => Promise<GameState | null>>(async () => null)
  const sequence = useRef(0)
  const applied = useRef(0)
  const failures = useRef(0)
  const alive = useRef(true)
  const stopped = useRef(false)

  const schedule = useCallback((delay: number | null) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (delay === null || !alive.current || stopped.current) return
    if (document.hidden) return
    timer.current = setTimeout(() => void pollRef.current(), delay)
  }, [])

  const poll = useCallback(async (): Promise<GameState | null> => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (stopped.current) return stateRef.current
    const request = ++sequence.current
    let next: number | null
    try {
      const incoming = await getGame(gameId, lastBarTick(stateRef.current))
      if (!alive.current || request < applied.current) return stateRef.current
      failures.current = 0
      setReconnecting(false)
      setLoadError(null)
      if (isNewer(stateRef.current, incoming)) {
        applied.current = request
        const merged = mergeGameState(stateRef.current, incoming)
        stateRef.current = merged
        setState(merged)
      }
      next = stateRef.current ? pollDelay(stateRef.current) : SLOW_POLL
    } catch (error) {
      if (!alive.current) return null
      if (!isRetryable(error)) {
        stopped.current = true
        setReconnecting(false)
        setFailure({
          message: errorText(error),
          status: error instanceof HttpError ? error.status : null,
        })
        return null
      }
      failures.current += 1
      if (stateRef.current) setReconnecting(true)
      else setLoadError(errorText(error))
      next = retryDelay(failures.current)
    }
    if (request === sequence.current) schedule(next)
    return stateRef.current
  }, [gameId, schedule])

  useEffect(() => {
    pollRef.current = poll
  }, [poll])

  const accept = useCallback(
    (incoming: GameState) => {
      const current = stateRef.current
      if (!isNewer(current, incoming) && current) {
        // A slow reply would roll back a newer poll; fetch fresh state soon.
        schedule(MIN_POLL)
        return current
      }
      applied.current = ++sequence.current
      const merged = mergeGameState(current, incoming)
      stateRef.current = merged
      setState(merged)
      setReconnecting(false)
      schedule(pollDelay(merged))
      return merged
    },
    [schedule],
  )

  const stop = useCallback(() => {
    stopped.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const refresh = useCallback(() => {
    failures.current = 0
    return poll()
  }, [poll])

  useEffect(() => {
    alive.current = true
    stopped.current = false
    stateRef.current = null
    queueMicrotask(() => {
      if (alive.current) void poll()
    })
    function onVisibility() {
      if (document.hidden) {
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
      } else if (
        !stopped.current &&
        (!stateRef.current || !isEnded(stateRef.current))
      ) {
        void poll()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive.current = false
      if (timer.current) clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [poll])

  return { state, loadError, failure, reconnecting, refresh, accept, stop }
}
