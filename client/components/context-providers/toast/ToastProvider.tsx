import { useCallback, useState, type ReactNode } from 'react'
import { ToastContext } from '../../../contexts/ToastContext.ts'
import './Toast.css'

export default function ToastProvider({ children }: { children: ReactNode }) {
  const TOAST_DURATION = 5000
  const [toast, setToast] = useState<{ message: string; id: number } | null>(
    null,
  )

  const showToast = useCallback((message: string) => {
    setToast((previous) => ({ message, id: (previous?.id ?? 0) + 1 }))

    const timer = setTimeout(() => setToast(null), TOAST_DURATION)
    return () => clearTimeout(timer)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-region" aria-live="assertive" aria-atomic="true">
        {toast && (
          <div className="error-toast" key={toast.id}>
            <p>{toast.message}</p>
            <button
              type="button"
              aria-label="Dismiss error notification"
              onClick={() => setToast(null)}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
