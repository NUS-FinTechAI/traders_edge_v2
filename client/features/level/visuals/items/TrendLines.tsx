import { useState } from 'react'
import s from '../visuals.module.css'
import { PriceGrid } from '../shared/Chart.tsx'
import { throughPoints } from '../shared/data.ts'
import { extent, linear, linePath, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { Figure, Note, Segmented, Stat, Svg } from '../shared/ui.tsx'

type Mode = 'up' | 'down' | 'side'

/** Alternating swing points: [day, price, 'H' | 'L']. */
const SWINGS: Record<Mode, [number, number, 'H' | 'L'][]> = {
  up: [
    [2, 46, 'L'],
    [6, 50, 'H'],
    [9, 49, 'L'],
    [13, 54, 'H'],
    [16, 53, 'L'],
    [20, 58, 'H'],
  ],
  down: [
    [2, 80, 'H'],
    [6, 74, 'L'],
    [9, 76, 'H'],
    [13, 69, 'L'],
    [16, 71, 'H'],
    [20, 65, 'L'],
  ],
  side: [
    [2, 48, 'L'],
    [6, 52, 'H'],
    [9, 48.3, 'L'],
    [13, 52.4, 'H'],
    [16, 47.9, 'L'],
    [20, 51.8, 'H'],
  ],
}
const ENDS: Record<Mode, [number, number]> = {
  up: [47.5, 56.6],
  down: [78, 66.4],
  side: [50, 50.4],
}
const LAST_DAY = 22

function series(mode: Mode) {
  const anchors: [number, number][] = [
    [0, ENDS[mode][0]],
    ...SWINGS[mode].map(([d, p]) => [d, p] as [number, number]),
    [LAST_DAY, ENDS[mode][1]],
  ]
  return throughPoints(anchors, 17, 0.0025)
}

const DATA: Record<Mode, number[]> = {
  up: series('up'),
  down: series('down'),
  side: series('side'),
}

/** HH/LH/HL/LL labels; a change under 1.5% reads as roughly equal (≈). */
function labels(mode: Mode) {
  const last: Record<'H' | 'L', number | null> = { H: null, L: null }
  return SWINGS[mode].map(([, price, kind]) => {
    const prev = last[kind]
    last[kind] = price
    if (prev === null) return kind
    if (Math.abs(price - prev) / prev < 0.015) return `≈${kind}`
    return `${price > prev ? 'H' : 'L'}${kind}`
  })
}

const SUMMARY: Record<Mode, string> = {
  up: 'Higher highs and higher lows: an uptrend. The trendline joins the rising lows.',
  down: 'Lower highs and lower lows: a downtrend. The trendline joins the falling highs.',
  side: 'Highs and lows stay roughly level: a range (sideways market), neither up nor down.',
}

export default function TrendLines() {
  const [mode, setMode] = useState<Mode>('up')
  const swings = SWINGS[mode]
  const tags = labels(mode)
  const highs = swings.filter((p) => p[2] === 'H').map((p) => p[1])
  const lows = swings.filter((p) => p[2] === 'L').map((p) => p[1])
  const data = DATA[mode]

  return (
    <Figure
      caption="Read the swing highs and swing lows to name the trend."
      readout={
        <>
          <Stat label="Highs" value={highs.join(' → ')} />
          <Stat label="Lows" value={lows.join(' → ')} />
          <Note>{SUMMARY[mode]}</Note>
        </>
      }
      controls={
        <Segmented
          label="Market type"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'up', label: '↗ Uptrend' },
            { id: 'down', label: '↘ Downtrend' },
            { id: 'side', label: '→ Sideways' },
          ]}
        />
      }
    >
      {(width) => {
        const height = 210
        const x0 = 8
        const x1 = width - 56
        const domain = extent(data, 0.16)
        const y = linear(domain, [height - 12, 14])
        const x = linear([0, LAST_DAY], [x0, x1])
        let line: [number, number, number, number] | null = null
        if (mode !== 'side') {
          const kind = mode === 'up' ? 'L' : 'H'
          const pts = swings.filter((p) => p[2] === kind)
          const [a, b] = [pts[0], pts[1]]
          const slope = (b[1] - a[1]) / (b[0] - a[0])
          line = [a[0], a[1], LAST_DAY, a[1] + slope * (LAST_DAY - a[0])]
        }
        const avg = (v: number[]) => v.reduce((t, n) => t + n, 0) / v.length
        return (
          <Svg
            width={width}
            height={height}
            label={`Price line. Swing highs ${highs.join(', ')}; swing lows ${lows.join(', ')}. ${SUMMARY[mode]}`}
          >
            <PriceGrid
              y={y}
              values={ticks(...domain, 4)}
              x0={x0}
              x1={x1}
              format={(v) => `$${v}`}
            />
            {line && (
              <line
                x1={x(line[0])}
                y1={y(line[1])}
                x2={x(line[2])}
                y2={y(line[3])}
                style={{ stroke: C.gold, strokeWidth: 2 }}
                strokeDasharray="7 4"
              />
            )}
            {mode === 'side' &&
              [avg(highs), avg(lows)].map((v) => (
                <line
                  key={v}
                  x1={x0}
                  x2={x1}
                  y1={y(v)}
                  y2={y(v)}
                  style={{ stroke: C.gold, strokeWidth: 2 }}
                  strokeDasharray="7 4"
                />
              ))}
            <path
              d={linePath(data, x, y)}
              style={{ fill: 'none', stroke: C.text, strokeWidth: 2 }}
            />
            {swings.map(([day, price, kind], i) => {
              const high = kind === 'H'
              return (
                <g key={day}>
                  <circle
                    cx={x(day)}
                    cy={y(price)}
                    r={5}
                    style={{
                      fill: C.info,
                      stroke: C.bg,
                      strokeWidth: 2,
                    }}
                  />
                  <text
                    x={x(day)}
                    y={high ? y(price) - 10 : y(price) + 19}
                    textAnchor="middle"
                    className={`${s.small} ${s.strong}`}
                  >
                    {tags[i]}
                  </text>
                </g>
              )
            })}
          </Svg>
        )
      }}
    </Figure>
  )
}
