import { useCallback, useState, type ReactNode } from 'react'
import useAuth from '../hooks/useAuth.ts'
import { getMe, type Player } from '../services/playerService.ts'
import { errorText } from '../ui/useResource.ts'
import { PlayerContext } from './PlayerContext.ts'
import LevelUpModal from './LevelUpModal.tsx'

/** A profile fetched here, tied to the auth profile it replaced. */
interface Fetched {
  base: Player | null
  player: Player
}

/**
 * Keeps the signed-in player's HUD data (level, wallet, streak) current. The
 * profile verified at sign-in (GET /api/me) is shown at once; refreshes after
 * rewards replace it, and a failed refresh keeps the last good profile and
 * reports the error.
 */
export default function PlayerProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const [fetched, setFetched] = useState<Fetched | null>(null)
  const [error, setError] = useState<string | null>(null)
  const signedIn = status === 'signed-in'

  const refreshPlayer = useCallback(async () => {
    try {
      const player = await getMe()
      setFetched({ base: user, player })
      setError(null)
    } catch (caught) {
      setError(errorText(caught))
    }
  }, [user])

  // A newer sign-in profile (another refresh) supersedes an older fetch.
  const player = !signedIn
    ? null
    : fetched && fetched.base === user
      ? fetched.player
      : user

  return (
    <PlayerContext.Provider
      value={{ player, error: signedIn ? error : null, refreshPlayer }}
    >
      {children}
      <LevelUpModal player={player} />
    </PlayerContext.Provider>
  )
}
