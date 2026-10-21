import { formatMoney } from '../../../ui/format.ts'
import styles from './Results.module.css'

interface SparklineProps {
  points: { t: number; value: number }[]
  baseline: number
}

const W = 600
const H = 120
const PAD = 6

/** Total account value over the match, with the starting cash as a dashed baseline. */
export default function Sparkline({ points, baseline }: SparklineProps) {
  if (points.length < 2) return null
  const values = [...points.map((p) => p.value), baseline]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const y = (v: number) => PAD + ((max - v) / span) * (H - PAD * 2)
  const path = points
    .map(
      (p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
    )
    .join('')
  const area = `${path}L${x(points.length - 1)},${H}L${x(0)},${H}Z`
  const end = points[points.length - 1].value
  const up = end >= baseline
  return (
    <svg
      className={`${styles.spark} ${up ? styles.sparkUp : styles.sparkDown}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Your total value went from ${formatMoney(baseline)} to ${formatMoney(end)}`}
    >
      <path className={styles.sparkArea} d={area} />
      <line
        className={styles.sparkBase}
        x1={0}
        x2={W}
        y1={y(baseline)}
        y2={y(baseline)}
      />
      <path
        className={styles.sparkLine}
        d={path}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
