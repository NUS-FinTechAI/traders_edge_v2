import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getGame,
  lastBarTick,
  mergeGameState,
  type GameState,
} from '../../services/gameService.ts'
import { errorText } from '../../ui/useResource.ts'
import { isEnded, isPaused } from './arenaLogic.ts'

const SLOW_POLL = 4000
const MIN_POLL = 250
const MAX_POLL = 1500

/** Delay before the next poll: just after the next expected tick while running. */
export function pollDelay(state: GameState): number | null {
  if (isEnded(state)) return null
  if (state.status === 'briefing' || isPaused(state)) return SLOW_POLL
  if (state.next_tick_at) {
    const wait = state.next_tick_at - state.server_time + 60
    return Math.min(MAX_POLL, Math.max(MIN_POLL, wait))
  }
  return 500
}

export interface GameConnection {
  state: GameState | null
  loadError: string | null
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
  const [reconnecting, setReconnecting] = useState(false)
  const stateRef = useRef<GameState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef = useRef<() => Promise<GameState | null>>(async () => null)
  const sequence = useRef(0)
  const applied = useRef(0)
  const alive = useRef(true)
  const stopped = useRef(false)

  const poll = useCallback(async (): Promise<GameState | null> => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (stopped.current) return stateRef.current
    const request = ++sequence.current
    let next: number | null = SLOW_POLL
    try {
      const incoming = await getGame(gameId, lastBarTick(stateRef.current))
      if (!alive.current || request < applied.current) return stateRef.current
      applied.current = request
      const merged = mergeGameState(stateRef.current, incoming)
      stateRef.current = merged
      setState(merged)
      setReconnecting(false)
      setLoadError(null)
      next = pollDelay(merged)
    } catch (error) {
      if (!alive.current) return null
      if (stateRef.current) setReconnecting(true)
      else setLoadError(errorText(error))
      next = stateRef.current ? 1500 : null
    }
    if (
      next !== null &&
      alive.current &&
      !stopped.current &&
      request === sequence.current &&
      !document.hidden
    ) {
      timer.current = setTimeout(() => void pollRef.current(), next)
    }
    return stateRef.current
  }, [gameId])

  useEffect(() => {
    pollRef.current = poll
  }, [poll])

  const accept = useCallback((incoming: GameState) => {
    applied.current = ++sequence.current
    const merged = mergeGameState(stateRef.current, incoming)
    stateRef.current = merged
    setState(merged)
    setReconnecting(false)
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const next = pollDelay(merged)
    if (next !== null && !stopped.current && !document.hidden) {
      timer.current = setTimeout(() => void pollRef.current(), next)
    }
    return merged
  }, [])

  const stop = useCallback(() => {
    stopped.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => {
    alive.current = true
    stopped.current = false
    stateRef.current = null
    void poll()
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

  return { state, loadError, reconnecting, refresh: poll, accept, stop }
}
