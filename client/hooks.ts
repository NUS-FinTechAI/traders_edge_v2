import { useEffect, useState } from 'react'
import { api } from './api'
export function useResource<T>(path: string) {
  const [version, setVersion] = useState(0)
  const [response, setResponse] = useState<{
    path: string
    version: number
    data: T | null
    error: string
  } | null>(null)
  useEffect(() => {
    let current = true
    api<T>(path)
      .then((data) => {
        if (current) setResponse({ path, version, data, error: '' })
      })
      .catch((reason) => {
        if (current)
          setResponse({ path, version, data: null, error: reason.message })
      })
    return () => {
      current = false
    }
  }, [path, version])
  const ready = response?.path === path && response.version === version
  return {
    data: ready ? response.data : null,
    error: ready ? response.error : '',
    loading: !ready,
    reload: () => setVersion((v) => v + 1),
  }
}
export const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
