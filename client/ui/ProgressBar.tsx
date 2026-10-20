import styles from './ui.module.css'

interface ProgressBarProps {
  value: number
  max: number
  label: string
  tone?: 'primary' | 'gold' | 'gem'
  valueText?: string
  className?: string
}

export default function ProgressBar({
  value,
  max,
  label,
  tone = 'primary',
  valueText,
  className,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      className={[
        styles.progress,
        tone === 'gold' && styles.progressGold,
        tone === 'gem' && styles.progressGem,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText ?? `${value} of ${max}`}
    >
      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
    </div>
  )
}
