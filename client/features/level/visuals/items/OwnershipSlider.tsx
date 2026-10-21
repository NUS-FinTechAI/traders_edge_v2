import { useState } from 'react'
import { formatCount } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { C } from '../shared/theme.ts'
import { ownershipPct } from '../shared/trading.ts'
import { Figure, Note, Range, Stat, Svg } from '../shared/ui.tsx'

const TOTAL = 1_000_000
const STEPS = [
  1, 10, 100, 1_000, 5_000, 10_000, 50_000, 100_000, 250_000, 500_000, 510_000,
  1_000_000,
]

const pctText = (pct: number) => `${Number(pct.toPrecision(2))}%`

function slice(cx: number, cy: number, r: number, fraction: number) {
  const angle = Math.max(fraction, 0.004) * 2 * Math.PI
  const x = cx + r * Math.sin(angle)
  const y = cy - r * Math.cos(angle)
  const large = angle > Math.PI ? 1 : 0
  return `M${cx},${cy}L${cx},${cy - r}A${r},${r} 0 ${large} 1 ${x.toFixed(2)},${y.toFixed(2)}Z`
}

function note(shares: number, pct: number) {
  if (shares === TOTAL) return 'You own the whole company.'
  if (pct > 50)
    return 'More than half: your votes outweigh all other shareholders combined.'
  if (pct < 1)
    return `A tiny slice. You would need ${formatCount(TOTAL / 100)} shares to own 1%.`
  return 'Every share is an equal slice of the profits and the votes.'
}

export default function OwnershipSlider() {
  const [index, setIndex] = useState(2)
  const shares = STEPS[index]
  const pct = ownershipPct(shares, TOTAL)
  const tiny = pct < 1

  return (
    <Figure
      caption="Lumen Bikes is split into 1,000,000 shares. Move the slider to change how many you own."
      readout={
        <>
          <Stat label="You own" value={`${formatCount(shares)} shares`} />
          <Stat label="Ownership" value={pctText(pct)} color={C.gold} />
          <Note>{note(shares, pct)}</Note>
        </>
      }
      controls={
        <Range
          label="Shares owned"
          min={0}
          max={STEPS.length - 1}
          step={1}
          value={index}
          display={formatCount(shares)}
          valueText={`${formatCount(shares)} shares, ${pctText(pct)} of the company`}
          onChange={setIndex}
        />
      }
    >
      {(width) => {
        const height = 170
        const r = 66
        const cx = 16 + r
        const cy = height / 2
        const tx = cx + r + 28
        return (
          <Svg
            width={width}
            height={height}
            label={`Pie chart: ${formatCount(shares)} of 1,000,000 shares is ${pctText(pct)} of Lumen Bikes.`}
          >
            <circle
              cx={cx}
              cy={cy}
              r={r}
              style={{ fill: C.surface3, stroke: C.borderStrong }}
            />
            {shares === TOTAL ? (
              <circle cx={cx} cy={cy} r={r} style={{ fill: C.gold }} />
            ) : (
              <path
                d={slice(cx, cy, r, pct / 100)}
                style={{ fill: C.gold, stroke: C.bg, strokeWidth: 1 }}
              />
            )}
            {tiny && (
              <g aria-hidden="true">
                <line
                  x1={cx + 2}
                  y1={cy - r - 2}
                  x2={cx + 22}
                  y2={cy - r - 2}
                  style={{ stroke: C.gold }}
                />
                <text
                  x={cx + 26}
                  y={cy - r + 2}
                  className={`${s.small} ${s.word}`}
                >
                  your slice (too thin to see)
                </text>
              </g>
            )}
            <text
              x={tx}
              y={cy - 6}
              className={`${s.strong}`}
              style={{ fontSize: 28 }}
            >
              {pctText(pct)}
            </text>
            <text x={tx} y={cy + 18} className={s.word}>
              of Lumen Bikes
            </text>
            <text
              x={tx}
              y={cy + 38}
              className={`${s.small}`}
              style={{ fill: C.dim }}
            >
              {formatCount(shares)} ÷ 1,000,000
            </text>
          </Svg>
        )
      }}
    </Figure>
  )
}
