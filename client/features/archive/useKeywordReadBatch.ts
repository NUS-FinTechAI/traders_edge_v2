import { useCallback, useEffect, useRef } from 'react'
import { usePlayer } from '../../app/PlayerContext.ts'
import type { UnlockKey } from '../../services/playerService.ts'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'

const MAX_BATCH = 100

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
        for (let index = 0; index < keys.length; index += MAX_BATCH)
          await acknowledge(keys.slice(index, index + MAX_BATCH))
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
