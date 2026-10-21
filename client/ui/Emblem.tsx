import { EmblemArt, type EmblemName } from './emblemArt.tsx'
import styles from './Emblem.module.css'

export type EmblemTone =
  'gold' | 'green' | 'gem' | 'info' | 'flame' | 'loss' | 'neutral'

interface EmblemProps {
  name: EmblemName
  tone?: EmblemTone
  size?: number
  shape?: 'square' | 'circle' | 'none'
  label?: string
  className?: string
}

/** Flat illustrated emblem for cards, map nodes and badges. */
export default function Emblem({
  name,
  tone = 'gold',
  size = 56,
  shape = 'square',
  label,
  className,
}: EmblemProps) {
  return (
    <span
      className={[styles.emblem, styles[tone], styles[shape], className]
        .filter(Boolean)
        .join(' ')}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">
        <EmblemArt name={name} />
      </svg>
    </span>
  )
}
