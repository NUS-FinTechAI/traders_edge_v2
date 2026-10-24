import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import Button, { ButtonLink } from './Button.tsx'
import Icon from './Icon.tsx'
import styles from './ui.module.css'
import {
  ToastContext,
  type CelebrationToast,
  type Notify,
  type ToastKind,
  type Toasts,
} from './toastContext.ts'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
  celebration?: CelebrationToast
}

const DURATION = 4500
const CELEBRATION_DURATION = 5000
const MAX_VISIBLE = 5

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: number) => void
}) {
  // Each toast keeps its own timer, so a new toast never extends an old one.
  useEffect(() => {
    const timer = setTimeout(
      () => onDismiss(item.id),
      item.celebration ? CELEBRATION_DURATION : DURATION,
    )
    return () => clearTimeout(timer)
  }, [item.id, item.celebration, onDismiss])
  const { celebration } = item
  if (celebration) {
    return (
      <div className={`${styles.toast} ${styles.toastCelebrate}`}>
        <span className={styles.toastArt}>{celebration.art}</span>
        <div className={styles.toastBody}>
          <p className={styles.toastHeading}>{celebration.heading}</p>
          <p>
            <strong>{celebration.name}</strong>
          </p>
          {celebration.action && (
            <ButtonLink
              variant="ghost"
              size="sm"
              to={celebration.action.to}
              onClick={() => onDismiss(item.id)}
            >
              {celebration.action.label}
            </ButtonLink>
          )}
        </div>
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
      ...current.slice(1 - MAX_VISIBLE),
      { id: Date.now() + Math.random(), message, kind },
    ])
  }, [])

  const celebrate = useCallback<Toasts['celebrate']>((celebration) => {
    setItems((current) =>
      current.some((item) => item.celebration?.key === celebration.key)
        ? current
        : [
            ...current.slice(1 - MAX_VISIBLE),
            {
              id: Date.now() + Math.random(),
              message: celebration.name,
              kind: 'success',
              celebration,
            },
          ],
    )
  }, [])

  const value = useMemo(() => ({ notify, celebrate }), [notify, celebrate])

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  // Two persistent live regions: each message is announced once, errors
  // assertively and everything else politely.
  return (
    <ToastContext.Provider value={value}>
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
