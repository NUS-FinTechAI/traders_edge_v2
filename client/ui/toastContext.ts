import { createContext, useContext, type ReactNode } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

/** A celebratory toast: art, a heading, a name and a link to view it. */
export interface CelebrationToast {
  /** A toast with a key already on screen is not shown twice. */
  key: string
  heading: string
  name: string
  art: ReactNode
  action?: { label: string; to: string }
}

export type Notify = (message: string, kind?: ToastKind) => void

export interface Toasts {
  notify: Notify
  celebrate: (toast: CelebrationToast) => void
}

export const ToastContext = createContext<Toasts | null>(null)

function useToasts(): Toasts {
  const toasts = useContext(ToastContext)
  if (!toasts) throw new Error('useToast requires ToastProvider')
  return toasts
}

export function useToast(): Notify {
  return useToasts().notify
}

export function useCelebrate(): Toasts['celebrate'] {
  return useToasts().celebrate
}
