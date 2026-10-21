import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createGame, type CreateGame } from '../../services/campaignService.ts'
import { findBriefing, listGames } from '../../services/gameService.ts'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'

interface StartOptions {
  key?: string
  onError?: () => void
  /** The market this start will get, used to reopen an unstarted briefing. */
  scenarioId?: string | null
}

/**
 * Open a match in the arena: an unstarted briefing for the same market is
 * reopened instead of creating a duplicate; server refusals become toasts.
 */
export default function useStartGame() {
  const navigate = useNavigate()
  const notify = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function start(body: CreateGame, options: StartOptions = {}) {
    if (busy) return
    setBusy(options.key ?? body.mode)
    try {
      const { games } = await listGames().catch(() => ({ games: [] }))
      const existing =
        options.scenarioId !== undefined
          ? findBriefing(games, body.mode, options.scenarioId)
          : null
      const { id } = existing ?? (await createGame(body))
      void navigate(`/game/${encodeURIComponent(id)}`)
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(null)
      options.onError?.()
    }
  }

  return { start, busy }
}
