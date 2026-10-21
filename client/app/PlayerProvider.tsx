import { useCallback, useEffect, useState, type ReactNode } from 'react'
import useAuth from '../hooks/useAuth.ts'
import { getMe, type Player } from '../services/playerService.ts'
import { PlayerContext } from './PlayerContext.ts'

/** Keeps the signed-in player's HUD data (level, wallet, streak) current. */
export default function PlayerProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const [player, setPlayer] = useState<Player | null>(null)
  const signedIn = status === 'signed-in'

  const refreshPlayer = useCallback(async () => {
    try {
      setPlayer(await getMe())
    } catch {
      setPlayer(null)
    }
  }, [])

  useEffect(() => {
    if (!signedIn) return
    const controller = new AbortController()
    getMe(controller.signal).then(setPlayer, () => {})
    return () => controller.abort()
  }, [signedIn, user?.id])

  return (
    <PlayerContext.Provider
      value={{ player: signedIn ? player : null, refreshPlayer }}
    >
      {children}
    </PlayerContext.Provider>
  )
}
