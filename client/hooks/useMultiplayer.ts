import { useEffect, useState, useSyncExternalStore } from 'react'
import { MultiplayerController } from '../controllers/multiplayerController.ts'
import authService from '../services/authService.ts'

export default function useMultiplayer(owner: string, lobbyId?: string) {
  const [controller] = useState(
    () =>
      new MultiplayerController({
        owner,
        getOwner: () => authService.getUser()?.id ?? null,
        storage: localStorage,
      }),
  )
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  )
  useEffect(() => {
    void controller.load(lobbyId).catch(() => {})
  }, [controller, lobbyId])
  return { controller, state }
}
