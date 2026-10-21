import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Button from './Button.tsx'
import Icon from './Icon.tsx'
import styles from './ui.module.css'
import { ToastContext, type Notify, type ToastKind } from './toastContext.ts'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

const DURATION = 4500

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const notify = useCallback<Notify>((message, kind = 'info') => {
    setItems((current) => [
      ...current.slice(-2),
      { id: Date.now() + Math.random(), message, kind },
    ])
  }, [])

  useEffect(() => {
    if (!items.length) return
    const timer = setTimeout(
      () => setItems((current) => current.slice(1)),
      DURATION,
    )
    return () => clearTimeout(timer)
  }, [items])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className={styles.toastRegion} aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={[
              styles.toast,
              styles[`toast${item.kind[0].toUpperCase()}${item.kind.slice(1)}`],
            ].join(' ')}
            role={item.kind === 'error' ? 'alert' : 'status'}
          >
            <Icon name={item.kind === 'success' ? 'check' : 'info'} />
            <p>{item.message}</p>
            <Button
              variant="ghost"
              size="sm"
              icon="close"
              aria-label="Dismiss"
              onClick={() =>
                setItems((current) =>
                  current.filter(({ id }) => id !== item.id),
                )
              }
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
