import { useState } from 'react'
import { formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { Candles, PriceGrid } from '../shared/Chart.tsx'
import { candlesFromCloses, seeded, throughPoints } from '../shared/data.ts'
import { bands, extent, linear, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import type { Candle } from '../shared/trading.ts'
import { Figure, Note, Segmented, Stat, Svg } from '../shared/ui.tsx'

type Mode = 'real' | 'fake'

const RESISTANCE = 52
const BREAKOUT = 24
const RANGE = throughPoints(
  [
    [0, 50.2],
    [4, 51.6],
    [8, 49.4],
    [12, 51.5],
    [16, 49.6],
    [20, 51.7],
    [23, 51.2],
  ],
  5,
  0.003,
)
const AFTER: Record<Mode, number[]> = {
  real: [53.4, 53.9, 54.6, 54.3, 55.1],
  fake: [52.2, 51.5, 50.8, 50.4, 49.9],
}
const VOLUME_MULT: Record<Mode, number[]> = {
  real: [2.2, 1.7, 1.4, 1.2, 1.3],
  fake: [0.8, 1.0, 1.1, 0.9, 1.0],
}

const baseVolume = (() => {
  const rand = seeded(9)
  return RANGE.map(() => Math.round(100_000 * (0.75 + 0.5 * rand())))
})()
const AVG =
  baseVolume.slice(BREAKOUT - 20, BREAKOUT).reduce((a, b) => a + b, 0) / 20

function build(mode: Mode): Candle[] {
  const candles = candlesFromCloses([...RANGE, ...AFTER[mode]], 12)
  return candles.map((c, day) => {
    const v =
      day < BREAKOUT
        ? baseVolume[day]
        : Math.round(AVG * VOLUME_MULT[mode][day - BREAKOUT])
    if (day < BREAKOUT)
      return { ...c, h: Math.max(Math.min(c.h, 51.9), c.o, c.c), v }
    if (mode === 'fake' && day === BREAKOUT) return { ...c, h: 52.8, v }
    return { ...c, v }
  })
}

const DATA: Record<Mode, Candle[]> = {
  real: build('real'),
  fake: build('fake'),
}

export default function VolumeBars() {
  const [mode, setMode] = useState<Mode>('real')
  const data = DATA[mode]
  const mult = VOLUME_MULT[mode][0]
  const real = mode === 'real'

  return (
    <Figure
      caption="Volume shows how many shares traded. A breakout on heavy volume is more convincing than one on light volume."
      readout={
        <>
          <Stat
            label="Breakout-day volume"
            value={`${mult.toFixed(1)}× the 20-day average`}
            color={real ? C.gain : C.loss}
          />
          <Stat label="Close" value={formatMoney(data[BREAKOUT].c)} />
          <Note>
            {real
              ? 'Wide participation: price closed above $52 and kept rising.'
              : 'Weak volume: price poked above $52, then fell back into the range (a bull trap).'}
          </Note>
        </>
      }
      controls={
        <Segmented
          label="Breakout example"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'real', label: 'High-volume breakout' },
            { id: 'fake', label: 'Low-volume fake-out' },
          ]}
        />
      }
    >
      {(width) => {
        const priceH = 150
        const volTop = priceH + 16
        const volH = 64
        const height = volTop + volH + 4
        const x0 = 4
        const x1 = width - 56
        const domain = extent(
          [...DATA.real, ...DATA.fake].flatMap((d) => [d.h, d.l]),
          0.06,
        )
        const y = linear(domain, [priceH, 8])
        const maxV = AVG * 2.4
        const vy = linear([0, maxV], [volTop + volH, volTop])
        const band = bands(data.length, x0, x1)
        return (
          <Svg
            width={width}
            height={height}
            label={`Price chart with volume bars. Resistance at $52. Breakout day volume ${mult.toFixed(1)} times the 20-day average; ${real ? 'price kept rising' : 'price fell back into the range'}.`}
          >
            <PriceGrid y={y} values={ticks(...domain, 4)} x0={x0} x1={x1} />
            <line
              x1={x0}
              x2={x1}
              y1={y(RESISTANCE)}
              y2={y(RESISTANCE)}
              style={{ stroke: C.gold, strokeWidth: 1.5 }}
              strokeDasharray="6 4"
            />
            <text
              x={x0 + 2}
              y={y(RESISTANCE) - 6}
              className={`${s.small} ${s.word}`}
            >
              Resistance $52
            </text>
            <Candles data={data} x={band.x} y={y} width={band.body} />
            <text x={x0 + 2} y={volTop + 10} className={`${s.small} ${s.word}`}>
              Volume
            </text>
            {data.map((c, day) => {
              const top = vy(c.v ?? 0)
              const breakout = day === BREAKOUT
              return (
                <rect
                  key={day}
                  x={band.x(day) - band.body / 2}
                  y={top}
                  width={Math.max(3, band.body)}
                  height={volTop + volH - top}
                  style={{
                    fill: breakout ? C.gold : c.c >= c.o ? C.gain : C.loss,
                    opacity: breakout ? 1 : 0.45,
                  }}
                />
              )
            })}
            <line
              x1={x0}
              x2={x1}
              y1={vy(AVG)}
              y2={vy(AVG)}
              style={{ stroke: C.text, strokeWidth: 1 }}
              strokeDasharray="3 3"
            />
            <text x={x1 + 6} y={vy(AVG) + 4} className={s.small}>
              avg
            </text>
            <text
              x={band.x(BREAKOUT)}
              y={vy(data[BREAKOUT].v ?? 0) - 4}
              textAnchor="middle"
              className={`${s.small} ${s.strong}`}
              style={{ fill: C.gold }}
            >
              {mult.toFixed(1)}×
            </text>
          </Svg>
        )
      }}
    </Figure>
  )
}
