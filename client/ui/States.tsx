import type { ReactNode } from 'react'
import Button from './Button.tsx'
import Icon, { type IconName } from './Icon.tsx'
import styles from './ui.module.css'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status">
      <div className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

interface StateProps {
  icon?: IconName
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({
  icon = 'compass',
  title,
  children,
  action,
}: StateProps) {
  return (
    <div className={styles.state}>
      <span className={styles.stateIcon}>
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  action,
}: {
  title?: string
  message: string
  onRetry?: () => void
  /** A way out when retrying cannot help, such as a link elsewhere. */
  action?: ReactNode
}) {
  return (
    <div className={styles.state} role="alert">
      <span className={styles.stateIcon}>
        <Icon name="info" size={28} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
      {action}
    </div>
  )
}

/** Compact error shown above data that is still on screen. */
export function InlineError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <p className={styles.inlineError} role="alert">
      <Icon name="info" size={16} />
      <span>{message}</span>
      {onRetry && (
        <Button variant="ghost" size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </p>
  )
}

export function SectionHeader({
  title,
  eyebrow,
  action,
}: {
  title: string
  eyebrow?: string
  action?: ReactNode
}) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}
