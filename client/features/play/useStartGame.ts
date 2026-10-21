import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createGame, type CreateGame } from '../../services/campaignService.ts'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'

/** Create a match and open it in the arena; server refusals become toasts. */
export default function useStartGame() {
  const navigate = useNavigate()
  const notify = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function start(
    body: CreateGame,
    options: { key?: string; onError?: () => void } = {},
  ): Promise<void> {
    if (busy) return
    setBusy(options.key ?? body.mode)
    try {
      const { id } = await createGame(body)
      void navigate(`/game/${encodeURIComponent(id)}`)
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(null)
      options.onError?.()
    }
  }

  return { start, busy }
}
