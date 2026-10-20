import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import authService from '../../services/authService.ts'
import { ChallengeController } from '../../controllers/challengeController.ts'

export default function useChallengeSession(owner: string, attemptId?: string) {
  const [controller] = useState(
    () =>
      new ChallengeController({
        ownerId: owner,
        getOwnerId: () => authService.getUser()?.id ?? null,
        storage: sessionStorage,
      }),
  )
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  const lifecycle = useRef({ generation: 0 })
  useEffect(() => {
    const lease = lifecycle.current
    const generation = ++lease.generation
    void controller.recover(attemptId).catch(() => {})
    return () => {
      // StrictMode remounts the same controller before this microtask runs.
      queueMicrotask(() => {
        if (lease.generation === generation) controller.dispose()
      })
    }
  }, [controller, attemptId])
  return {
    controller,
    state,
    busy: ['loading', 'submitting'].includes(state.phase),
  }
}
