import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'
export type Notify = (message: string, kind?: ToastKind) => void

export const ToastContext = createContext<Notify | null>(null)

export function useToast(): Notify {
  const notify = useContext(ToastContext)
  if (!notify) throw new Error('useToast requires ToastProvider')
  return notify
}
