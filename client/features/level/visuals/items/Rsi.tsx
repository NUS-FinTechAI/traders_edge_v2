import { useState } from 'react'
import { formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { PriceGrid } from '../shared/Chart.tsx'
import { walk } from '../shared/data.ts'
import { longestRunAtOrAbove, rsi } from '../shared/indicators.ts'
import { extent, linear, linePath, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { Figure, Note, Segmented, Stat, Svg } from '../shared/ui.tsx'

type Mode = 'range' | 'trend'

const PERIOD = 14
const SERIES: Record<Mode, number[]> = {
  range: walk(
    3,
    60,
    30,
    (d) => 0.015 * Math.cos((2 * Math.PI * d) / 18),
    0.004,
  ),
  trend: walk(3, 60, 40, (d) => (d < 18 ? 0 : d < 38 ? 0.013 : -0.003), 0.008),
}
const RSI: Record<Mode, (number | null)[]> = {
  range: rsi(SERIES.range, PERIOD),
  trend: rsi(SERIES.trend, PERIOD),
}

export default function Rsi() {
  const [mode, setMode] = useState<Mode>('trend')
  const prices = SERIES[mode]
  const values = RSI[mode]
  const run = longestRunAtOrAbove(values, 70)
  const defined = values.filter((v): v is number => v !== null)
  const low = Math.min(...defined)
  const high = Math.max(...defined)
  const runEnd = run.start + run.length - 1

  return (
    <Figure
      caption="RSI (14 days, Wilder smoothing) runs from 0 to 100. Above 70 is called overbought, below 30 oversold."
      readout={
        mode === 'trend' ? (
          <>
            <Stat
              label="RSI ≥ 70"
              value={`${run.length} days in a row`}
              color={C.gold}
            />
            <Stat
              label="Price meanwhile"
              value={`${formatMoney(prices[run.start])} → ${formatMoney(Math.max(...prices.slice(run.start, runEnd + 1)))}`}
            />
            <Note>
              In a strong trend RSI can stay overbought for weeks. Selling at
              the first reading above 70 would have missed most of the move.
            </Note>
          </>
        ) : (
          <>
            <Stat
              label="RSI range"
              value={`${low.toFixed(0)} – ${high.toFixed(0)}`}
            />
            <Note>
              In a sideways range, RSI near 30 lined up with the lows and near
              70 with the highs. The same tool behaves differently in a trend.
            </Note>
          </>
        )
      }
      controls={
        <Segmented
          label="Market example"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'trend', label: 'Strong trend' },
            { id: 'range', label: 'Sideways range' },
          ]}
        />
      }
    >
      {(width) => {
        const priceH = 120
        const rsiTop = priceH + 22
        const rsiH = 100
        const height = rsiTop + rsiH + 6
        const x0 = 4
        const x1 = width - 56
        const first = PERIOD
        const x = linear([first, prices.length - 1], [x0, x1])
        const domain = extent(prices.slice(first), 0.08)
        const y = linear(domain, [priceH, 8])
        const ry = linear([0, 100], [rsiTop + rsiH, rsiTop])
        const shown = (series: readonly (number | null)[]) =>
          series.map((v, i) => (i < first ? null : v))
        return (
          <Svg
            width={width}
            height={height}
            label={
              mode === 'trend'
                ? `Price in a strong uptrend with RSI at or above 70 for ${run.length} days in a row.`
                : `Price in a sideways range with RSI between ${low.toFixed(0)} and ${high.toFixed(0)}.`
            }
          >
            <PriceGrid
              y={y}
              values={ticks(...domain, 3)}
              x0={x0}
              x1={x1}
              format={(v) => `$${v}`}
            />
            {mode === 'trend' && run.length > 0 && (
              <rect
                x={x(run.start)}
                y={8}
                width={x(runEnd) - x(run.start)}
                height={rsiTop + rsiH - 8}
                style={{ fill: C.goldSoft, opacity: 0.6 }}
              />
            )}
            <path
              d={linePath(shown(prices), x, y)}
              style={{ fill: 'none', stroke: C.text, strokeWidth: 1.75 }}
            />
            <rect
              x={x0}
              y={ry(100)}
              width={x1 - x0}
              height={ry(70) - ry(100)}
              style={{ fill: C.lossSoft, opacity: 0.7 }}
            />
            <rect
              x={x0}
              y={ry(30)}
              width={x1 - x0}
              height={ry(0) - ry(30)}
              style={{ fill: C.gainSoft, opacity: 0.7 }}
            />
            {[30, 50, 70].map((v) => (
              <g key={v}>
                <line
                  x1={x0}
                  x2={x1}
                  y1={ry(v)}
                  y2={ry(v)}
                  style={{ stroke: v === 50 ? C.border : C.borderStrong }}
                  strokeDasharray={v === 50 ? '2 4' : '5 3'}
                />
                <text x={x1 + 6} y={ry(v) + 4} className={s.small}>
                  {v}
                </text>
              </g>
            ))}
            <text
              x={x0 + 4}
              y={ry(100) + 12}
              className={`${s.small} ${s.word}`}
            >
              overbought
            </text>
            <text x={x0 + 4} y={ry(0) - 4} className={`${s.small} ${s.word}`}>
              oversold
            </text>
            <path
              d={linePath(values, x, ry)}
              style={{ fill: 'none', stroke: C.gem, strokeWidth: 2 }}
            />
            <text x={x1 + 6} y={rsiTop - 6} className={`${s.small} ${s.word}`}>
              RSI
            </text>
            {mode === 'trend' && run.length > 0 && (
              <text
                x={(x(run.start) + x(runEnd)) / 2}
                y={rsiTop - 6}
                textAnchor="middle"
                className={`${s.small} ${s.strong} ${s.halo}`}
                style={{ fill: C.gold }}
              >
                RSI ≥ 70 for {run.length} days
              </text>
            )}
          </Svg>
        )
      }}
    </Figure>
  )
}
