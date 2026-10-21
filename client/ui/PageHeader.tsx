import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon.tsx'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  eyebrow?: string
  subtitle?: ReactNode
  back?: { to: string; label: string }
  actions?: ReactNode
}

export default function PageHeader({
  title,
  eyebrow,
  subtitle,
  back,
  actions,
}: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {back && (
        <Link to={back.to} className={styles.back}>
          <Icon name="chevron-left" size={18} />
          {back.label}
        </Link>
      )}
      <div className={styles.row}>
        <div className={styles.titles}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  )
}
