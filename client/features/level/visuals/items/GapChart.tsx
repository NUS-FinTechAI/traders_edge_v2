import { useState } from 'react'
import {
  formatMoney,
  formatSignedMoney,
  formatSignedPct,
} from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { Candles, DayAxis, PriceGrid } from '../shared/Chart.tsx'
import { mirror } from '../shared/data.ts'
import { bands, extent, linear, ticks } from '../shared/scale.ts'
import { arrow, C, signColor } from '../shared/theme.ts'
import type { Candle } from '../shared/trading.ts'
import { Figure, Note, Segmented, Stat, Svg } from '../shared/ui.tsx'

const UP: Candle[] = [
  { o: 49.6, h: 50.3, l: 49.3, c: 50.0 },
  { o: 50.0, h: 50.6, l: 49.7, c: 50.4 },
  { o: 50.4, h: 50.7, l: 49.8, c: 49.9 },
  { o: 49.9, h: 50.5, l: 49.6, c: 50.3 },
  { o: 50.3, h: 50.9, l: 50.1, c: 50.6 },
  { o: 50.6, h: 50.8, l: 49.9, c: 50.0 },
  { o: 53.2, h: 54.1, l: 52.9, c: 53.8 },
  { o: 53.8, h: 54.6, l: 53.4, c: 54.3 },
  { o: 54.3, h: 54.5, l: 53.5, c: 53.7 },
  { o: 53.7, h: 54.8, l: 53.6, c: 54.6 },
]
const DOWN = mirror(UP, 50)
const GAP_DAY = 6

export default function GapChart() {
  const [dir, setDir] = useState<'up' | 'down'>('up')
  const data = dir === 'up' ? UP : DOWN
  const close = data[GAP_DAY - 1].c
  const open = data[GAP_DAY].o
  const gap = open - close
  const gapPct = (gap / close) * 100
  const gapText = `${arrow(gap)} ${formatSignedMoney(gap)} (${formatSignedPct(gapPct)})`

  return (
    <Figure
      caption="One candle is one trading day. News overnight can make the next open jump away from the last close."
      readout={
        <>
          <Stat label="Last close" value={formatMoney(close)} />
          <Stat label="Next open" value={formatMoney(open)} />
          <Stat label="Gap" value={gapText} color={signColor(gap)} />
          <Note>
            Orders placed overnight fill at the open, not at yesterday's close.
          </Note>
        </>
      }
      controls={
        <Segmented
          label="Gap direction"
          value={dir}
          onChange={setDir}
          options={[
            { id: 'up', label: '▲ Gap up' },
            { id: 'down', label: '▼ Gap down' },
          ]}
        />
      }
    >
      {(width) => {
        const height = 200
        const x0 = 6
        const x1 = width - 56
        const domain = extent(
          data.flatMap((d) => [d.h, d.l]),
          0.12,
        )
        const y = linear(domain, [height - 26, 12])
        const band = bands(data.length, x0, x1)
        const gx0 = band.x(GAP_DAY - 1) + band.body / 2
        const gx1 = band.x(GAP_DAY) - band.body / 2
        const top = Math.min(y(close), y(open))
        const bottom = Math.max(y(close), y(open))
        const labelY = (top + bottom) / 2 - 4
        const labelX = gx0 - 8
        return (
          <Svg
            width={width}
            height={height}
            label={`Ten daily candles. Day ${GAP_DAY} closes at ${formatMoney(close)}; day ${GAP_DAY + 1} opens at ${formatMoney(open)}, a gap of ${formatSignedPct(gapPct)}.`}
          >
            <PriceGrid y={y} values={ticks(...domain, 4)} x0={x0} x1={x1} />
            <rect
              x={gx0}
              y={top}
              width={gx1 - gx0}
              height={bottom - top}
              style={{ fill: C.goldSoft }}
            />
            {[close, open].map((v) => (
              <line
                key={v}
                x1={band.x(GAP_DAY - 1)}
                x2={band.x(GAP_DAY)}
                y1={y(v)}
                y2={y(v)}
                style={{ stroke: C.gold, strokeWidth: 1.5 }}
                strokeDasharray="4 3"
              />
            ))}
            <Candles data={data} x={band.x} y={y} width={band.body} />
            <text
              x={labelX}
              y={labelY}
              textAnchor="end"
              className={s.strong}
              style={{ fill: C.gold }}
            >
              Gap {formatSignedPct(gapPct)}
            </text>
            <text
              x={labelX}
              y={labelY + 15}
              textAnchor="end"
              className={`${s.small} ${s.word}`}
            >
              overnight news
            </text>
            <DayAxis x={band.x} y={height - 6} days={[0, 2, 4, 6, 8]} />
          </Svg>
        )
      }}
    </Figure>
  )
}
