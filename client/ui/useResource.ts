import { useCallback, useEffect, useRef, useState } from 'react'
import { HttpError } from '../services/httpService.ts'

export type Resource<T> =
  | { status: 'loading'; data?: T; reload: () => void }
  | { status: 'ready'; data: T; reload: () => void }
  | { status: 'error'; data?: T; error: string; reload: () => void }

export function errorText(error: unknown): string {
  if (error instanceof HttpError) return error.message
  return 'Unable to reach the game server. Check your connection and try again.'
}

interface Settled<T> {
  request: string
  data?: T
  error?: string
}

/** Load data on mount and whenever `key` changes; `reload` refetches in place. */
export default function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: unknown[] = [],
): Resource<T> {
  const loader = useRef(load)
  const [revision, setRevision] = useState(0)
  const [settled, setSettled] = useState<Settled<T>>({ request: '' })
  const request = JSON.stringify([revision, ...key])
  const reload = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    loader.current = load
  })

  useEffect(() => {
    const controller = new AbortController()
    loader.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ request, data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setSettled((current) => ({
            request,
            data: current.data,
            error: errorText(error),
          }))
      },
    )
    return () => controller.abort()
  }, [request])

  if (settled.request !== request)
    return { status: 'loading', data: settled.data, reload }
  if (settled.error !== undefined)
    return { status: 'error', data: settled.data, error: settled.error, reload }
  return { status: 'ready', data: settled.data as T, reload }
}
