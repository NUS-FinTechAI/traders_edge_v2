import { useCallback, useMemo, useState, type ReactNode } from 'react'
import useAuth from '../hooks/useAuth.ts'
import {
  getMe,
  markUnlocksSeen as acknowledgeUnlocks,
  type Player,
  type UnlockKey,
} from '../services/playerService.ts'
import { errorText } from '../ui/useResource.ts'
import { PlayerContext } from './PlayerContext.ts'
import LevelUpModal from './LevelUpModal.tsx'
import { mergeUnlockKeys, withoutSeenUnlocks } from './unlockNotifications.ts'

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
  const [locallySeen, setLocallySeen] = useState<{
    profileId: string
    keys: UnlockKey[]
  } | null>(null)
  const signedIn = status === 'signed-in'
  const profileId = signedIn ? user?.id : undefined

  const previewUnlocksSeen = useCallback(
    (unlocks: UnlockKey[], seen = true) => {
      if (!profileId || !unlocks.length) return
      setLocallySeen((current) => {
        if (!seen && current?.profileId !== profileId) return current
        const previous = current?.profileId === profileId ? current.keys : []
        const keys = seen
          ? mergeUnlockKeys(previous, unlocks)
          : previous.filter(
              (key) =>
                !unlocks.some(
                  (item) =>
                    item.category === key.category &&
                    item.item_id === key.item_id,
                ),
            )
        return { profileId, keys }
      })
    },
    [profileId],
  )

  const refreshPlayer = useCallback(async () => {
    try {
      const player = await getMe()
      setFetched({ base: user, player })
      setError(null)
    } catch (caught) {
      setError(errorText(caught))
    }
  }, [user])

  const markUnlocksSeen = useCallback(
    async (unlocks: UnlockKey[]) => {
      if (!unlocks.length) return
      try {
        const player = await acknowledgeUnlocks(unlocks)
        setFetched({ base: user, player })
        setError(null)
      } finally {
        previewUnlocksSeen(unlocks, false)
      }
    },
    [user, previewUnlocksSeen],
  )

  // A newer sign-in profile (another refresh) supersedes an older fetch.
  const fetchedPlayer = !signedIn
    ? null
    : fetched && fetched.base === user
      ? fetched.player
      : user
  const player = useMemo(
    () =>
      fetchedPlayer &&
      locallySeen?.profileId === fetchedPlayer.id &&
      locallySeen.keys.length
        ? withoutSeenUnlocks(fetchedPlayer, locallySeen.keys)
        : fetchedPlayer,
    [fetchedPlayer, locallySeen],
  )

  return (
    <PlayerContext.Provider
      value={{
        player,
        error: signedIn ? error : null,
        refreshPlayer,
        markUnlocksSeen,
        previewUnlocksSeen,
      }}
    >
      {children}
      <LevelUpModal player={player} />
    </PlayerContext.Provider>
  )
}
