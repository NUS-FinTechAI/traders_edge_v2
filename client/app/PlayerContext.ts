import { createContext, useContext } from 'react'
import type { Player, UnlockKey } from '../services/playerService.ts'

export interface PlayerContextValue {
  player: Player | null
  /** Why the last refresh failed; the previous profile stays in `player`. */
  error: string | null
  refreshPlayer: () => Promise<void>
  markUnlocksSeen: (unlocks: UnlockKey[]) => Promise<void>
  previewUnlocksSeen: (unlocks: UnlockKey[], seen?: boolean) => void
}

export const PlayerContext = createContext<PlayerContextValue>({
  player: null,
  error: null,
  refreshPlayer: async () => {},
  markUnlocksSeen: async () => {},
  previewUnlocksSeen: () => {},
})

export function usePlayer(): PlayerContextValue {
  return useContext(PlayerContext)
}
