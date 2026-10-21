import { useState } from 'react'
import s from '../visuals.module.css'
import { PriceGrid } from '../shared/Chart.tsx'
import { walk } from '../shared/data.ts'
import { crossovers, macd } from '../shared/indicators.ts'
import { extent, linear, linePath, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { Figure, Legend, Note, Segmented, Stat, Svg } from '../shared/ui.tsx'

type Step = 'line' | 'signal' | 'hist'

const CLOSES = walk(5, 140, 50, (d) => 0.007 * Math.sin(d / 7), 0.008)
const FIRST = 50
const ALL = macd(CLOSES, 12, 26, 9)
const cut = <T,>(series: readonly T[]) => series.slice(FIRST)
const PRICES = cut(CLOSES)
const LINE = cut(ALL.macd)
const SIGNAL = cut(ALL.signal)
const HIST = cut(ALL.hist)
const CROSSES = crossovers(LINE, SIGNAL)

const TEXT: Record<Step, string> = {
  line: 'MACD = 12-day EMA − 26-day EMA. Above zero, the fast average is above the slow one.',
  signal:
    'Signal = 9-day EMA of the MACD. ▲ marks MACD crossing above the signal (bullish), ▼ crossing below (bearish).',
  hist: 'Histogram = MACD − signal. Bars shrink toward zero before a crossover. All three are calculated from past prices, so they lag.',
}

export default function Macd() {
  const [step, setStep] = useState<Step>('line')
  const showSignal = step !== 'line'
  const showHist = step === 'hist'
  const ups = CROSSES.filter((c) => c.dir === 'up').length

  return (
    <Figure
      caption="Build MACD (12, 26, 9) one piece at a time."
      readout={
        <>
          {showSignal && (
            <Stat
              label="Crossovers"
              value={`▲ ${ups} bullish · ▼ ${CROSSES.length - ups} bearish`}
            />
          )}
          <Note>{TEXT[step]}</Note>
        </>
      }
      controls={
        <Segmented
          label="MACD part"
          value={step}
          onChange={setStep}
          options={[
            { id: 'line', label: '1 · MACD line' },
            { id: 'signal', label: '2 · + Signal' },
            { id: 'hist', label: '3 · + Histogram' },
          ]}
        />
      }
    >
      {(width) => {
        const priceH = 110
        const top = priceH + 34
        const paneH = 110
        const height = top + paneH + 6
        const x0 = 4
        const x1 = width - 56
        const x = linear([0, PRICES.length - 1], [x0, x1])
        const pDomain = extent(PRICES, 0.08)
        const py = linear(pDomain, [priceH, 8])
        const mDomain = extent([...LINE, ...SIGNAL, ...HIST], 0.12)
        const my = linear(mDomain, [top + paneH, top])
        const barW = Math.max(1.5, ((x1 - x0) / PRICES.length) * 0.6)
        return (
          <Svg
            width={width}
            height={height}
            label={`Price with MACD pane${showSignal ? `, signal line and ${CROSSES.length} crossovers` : ''}${showHist ? ' and histogram' : ''}.`}
          >
            <PriceGrid
              y={py}
              values={ticks(...pDomain, 3)}
              x0={x0}
              x1={x1}
              format={(v) => `$${v}`}
            />
            <path
              d={linePath(PRICES, x, py)}
              style={{ fill: 'none', stroke: C.text, strokeWidth: 1.75 }}
            />
            <Legend
              y={top - 10}
              items={[
                { text: 'MACD', color: C.info },
                ...(showSignal
                  ? [{ text: 'Signal', color: C.gold, dash: true }]
                  : []),
              ]}
            />
            <line
              x1={x0}
              x2={x1}
              y1={my(0)}
              y2={my(0)}
              style={{ stroke: C.borderStrong }}
            />
            <text x={x1 + 6} y={my(0) + 4} className={s.small}>
              0
            </text>
            {showHist &&
              HIST.map((v, i) =>
                v === null ? null : (
                  <rect
                    key={i}
                    x={x(i) - barW / 2}
                    y={Math.min(my(v), my(0))}
                    width={barW}
                    height={Math.abs(my(v) - my(0))}
                    style={{ fill: v >= 0 ? C.gain : C.loss, opacity: 0.55 }}
                  />
                ),
              )}
            <path
              d={linePath(LINE, x, my)}
              style={{ fill: 'none', stroke: C.info, strokeWidth: 2 }}
            />
            {showSignal && (
              <path
                d={linePath(SIGNAL, x, my)}
                style={{ fill: 'none', stroke: C.gold, strokeWidth: 2 }}
                strokeDasharray="5 3"
              />
            )}
            {showSignal &&
              CROSSES.map((c) => {
                const v = LINE[c.index] as number
                const up = c.dir === 'up'
                return (
                  <g key={c.index}>
                    <line
                      x1={x(c.index)}
                      x2={x(c.index)}
                      y1={8}
                      y2={priceH}
                      style={{ stroke: up ? C.gain : C.loss, opacity: 0.5 }}
                      strokeDasharray="2 3"
                    />
                    <text
                      x={x(c.index)}
                      y={up ? my(v) + 16 : my(v) - 8}
                      textAnchor="middle"
                      className={`${s.strong} ${s.halo}`}
                      style={{ fill: up ? C.gain : C.loss }}
                    >
                      {up ? '▲' : '▼'}
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
