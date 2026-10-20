import { createContext, useContext } from 'react'
import type { Player } from '../services/playerService.ts'

export interface PlayerContextValue {
  player: Player | null
  refreshPlayer: () => Promise<void>
}

export const PlayerContext = createContext<PlayerContextValue>({
  player: null,
  refreshPlayer: async () => {},
})

export function usePlayer(): PlayerContextValue {
  return useContext(PlayerContext)
}
