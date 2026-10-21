import { useCallback, useEffect, useRef, useState } from 'react'
import { HttpError } from '../services/httpService.ts'

type Snapshot<T> =
  | { status: 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; data?: T; error: string }

export type Resource<T> = Snapshot<T> & { reload: () => void }

export function errorText(error: unknown): string {
  if (error instanceof HttpError) return error.message
  return 'Unable to reach the game server. Check your connection and try again.'
}

export interface Settled<T> {
  /** The key the data belongs to, without the reload revision. */
  key: string
  /** The key plus revision of the request that settled. */
  request: string
  data?: T
  error?: string
}

/**
 * What a resource shows for the current request. Data from a previous key is
 * never shown (a tab switch must not mislabel the old tab's rows); data for the
 * same key stays on screen while it reloads or after a failed reload.
 */
export function resourceSnapshot<T>(
  settled: Settled<T>,
  key: string,
  request: string,
): Snapshot<T> {
  const data = settled.key === key ? settled.data : undefined
  if (settled.request !== request) return { status: 'loading', data }
  if (settled.error !== undefined)
    return { status: 'error', data, error: settled.error }
  return { status: 'ready', data: data as T }
}

/** Load data on mount and whenever `key` changes; `reload` refetches in place. */
export default function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: unknown[] = [],
): Resource<T> {
  const loader = useRef(load)
  const [revision, setRevision] = useState(0)
  const [settled, setSettled] = useState<Settled<T>>({ key: '', request: '' })
  const keyText = JSON.stringify(key)
  const request = JSON.stringify([revision, keyText])
  const reload = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    loader.current = load
  })

  useEffect(() => {
    const controller = new AbortController()
    loader.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setSettled({ key: keyText, request, data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setSettled((current) => ({
            key: keyText,
            request,
            data: current.key === keyText ? current.data : undefined,
            error: errorText(error),
          }))
      },
    )
    return () => controller.abort()
  }, [request, keyText])

  return { ...resourceSnapshot(settled, keyText, request), reload }
}
