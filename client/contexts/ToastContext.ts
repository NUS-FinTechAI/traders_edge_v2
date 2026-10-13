import { createContext, useContext } from 'react'

export const ToastContext = createContext<((message: string) => void) | null>(
  null,
)

export function useToast() {
  const showToast = useContext(ToastContext)
  if (!showToast) throw new Error('useToast requires ToastProvider')
  return showToast
}
