import { useEffect, useState } from 'react'

type ReadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown }

export default function useAdventureRead<T>(
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [state, setState] = useState<ReadState<T>>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error })
      },
    )
    return () => controller.abort()
  }, [load])

  return { state }
}
