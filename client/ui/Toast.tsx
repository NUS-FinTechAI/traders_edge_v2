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

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: number) => void
}) {
  // Each toast keeps its own timer, so a new toast never extends an old one.
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), DURATION)
    return () => clearTimeout(timer)
  }, [item.id, onDismiss])
  return (
    <div
      className={[
        styles.toast,
        styles[`toast${item.kind[0].toUpperCase()}${item.kind.slice(1)}`],
      ].join(' ')}
    >
      <Icon name={item.kind === 'success' ? 'check' : 'info'} />
      <p>{item.message}</p>
      <Button
        variant="ghost"
        size="sm"
        icon="close"
        aria-label="Dismiss"
        onClick={() => onDismiss(item.id)}
      />
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const notify = useCallback<Notify>((message, kind = 'info') => {
    setItems((current) => [
      ...current.slice(-2),
      { id: Date.now() + Math.random(), message, kind },
    ])
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  // Two persistent live regions: each message is announced once, errors
  // assertively and everything else politely.
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className={styles.toastRegion}>
        <div aria-live="assertive" className={styles.toastStack}>
          {items
            .filter((item) => item.kind === 'error')
            .map((item) => (
              <Toast key={item.id} item={item} onDismiss={dismiss} />
            ))}
        </div>
        <div aria-live="polite" className={styles.toastStack}>
          {items
            .filter((item) => item.kind !== 'error')
            .map((item) => (
              <Toast key={item.id} item={item} onDismiss={dismiss} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}
