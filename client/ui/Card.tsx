import type { HTMLAttributes } from 'react'
import styles from './ui.module.css'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li'
  raised?: boolean
  interactive?: boolean
}

export default function Card({
  as: Tag = 'div',
  raised,
  interactive,
  className,
  ...props
}: CardProps) {
  return (
    <Tag
      className={[
        styles.card,
        raised && styles.cardRaised,
        interactive && styles.cardInteractive,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
