import { useCallback, useEffect, useRef } from 'react'
import { usePlayer } from '../../app/PlayerContext.ts'
import type { UnlockKey } from '../../services/playerService.ts'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'

/** Queue visible keywords and acknowledge them only when leaving the archive. */
export default function useKeywordReadBatch() {
  const { markUnlocksSeen } = usePlayer()
  const notify = useToast()
  const pending = useRef(new Map<string, UnlockKey>())
  const callbacks = useRef({ markUnlocksSeen, notify })

  useEffect(() => {
    callbacks.current = { markUnlocksSeen, notify }
  }, [markUnlocksSeen, notify])

  useEffect(() => {
    const queue = pending.current
    return () => {
      const keys = [...queue.values()]
      queue.clear()
      const { markUnlocksSeen: acknowledge, notify: showError } =
        callbacks.current

      async function flush() {
        await acknowledge(keys)
      }

      void flush().catch((caught: unknown) =>
        showError(errorText(caught), 'error'),
      )
    }
  }, [])

  const recordVisible = useCallback((id: string) => {
    pending.current.set(id, { category: 'archive', item_id: id })
  }, [])

  return recordVisible
}
