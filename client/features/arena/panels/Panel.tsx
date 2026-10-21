import type { ReactNode } from 'react'
import styles from './panels.module.css'

interface PanelProps {
  title: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  /** Hide the heading visually, e.g. inside a mobile tab that already names it. */
  bare?: boolean
}

export default function Panel({
  title,
  aside,
  children,
  className,
  bare,
}: PanelProps) {
  return (
    <section
      className={[styles.panel, bare && styles.bare, className]
        .filter(Boolean)
        .join(' ')}
      aria-label={title}
    >
      <header className={bare ? 'visually-hidden' : styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}
