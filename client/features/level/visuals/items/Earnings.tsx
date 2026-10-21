import { useState } from 'react'
import { formatMoney, formatSignedPct } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { Candles } from '../shared/Chart.tsx'
import { candlesFromCloses } from '../shared/data.ts'
import { bands, extent, linear } from '../shared/scale.ts'
import { arrow, C, signColor } from '../shared/theme.ts'
import type { Candle } from '../shared/trading.ts'
import { Figure, Note, Segmented, Stat, Svg } from '../shared/ui.tsx'

type Result = 'beat' | 'miss'
type Guidance = 'raised' | 'cut'

const EXPECTED = 1.2
const ACTUAL: Record<Result, number> = { beat: 1.32, miss: 1.08 }
const BEFORE = [40.2, 39.9, 40.4, 40.1, 40.0]
const REPORT_DAY = BEFORE.length

/** Illustrative reactions: [gap %, then % moves on the following days]. */
const REACTION: Record<
  `${Result}-${Guidance}`,
  { gap: number; drift: number[]; note: string }
> = {
  'beat-raised': {
    gap: 7,
    drift: [0.8, 0.6, -0.3, 0.7],
    note: 'Better results and a better outlook: a gap up, then the price kept drifting higher.',
  },
  'beat-cut': {
    gap: -8,
    drift: [-0.6, 0.3, -0.8, -0.2],
    note: 'Beat on EPS, but the lower outlook mattered more: prices look forward.',
  },
  'miss-raised': {
    gap: 2,
    drift: [-0.4, 0.5, 0.2, -0.2],
    note: 'A weak quarter offset by a stronger outlook: a small, uncertain reaction.',
  },
  'miss-cut': {
    gap: -12,
    drift: [-1.2, -0.5, 0.4, -0.6],
    note: 'Worse results and a worse outlook: a large gap down.',
  },
}

function path(result: Result, guidance: Guidance): Candle[] {
  const { gap, drift } = REACTION[`${result}-${guidance}`]
  const closes = [...BEFORE]
  const open = BEFORE[REPORT_DAY - 1] * (1 + gap / 100)
  let last = open * (1 + drift[0] / 200)
  closes.push(Math.round(last * 100) / 100)
  for (const d of drift.slice(1)) {
    last *= 1 + d / 100
    closes.push(Math.round(last * 100) / 100)
  }
  const candles = candlesFromCloses(closes, 41)
  const day = candles[REPORT_DAY]
  const o = Math.round(open * 100) / 100
  candles[REPORT_DAY] = {
    ...day,
    o,
    h: Math.round((Math.max(o, day.c) + 0.35) * 100) / 100,
    l: Math.round((Math.min(o, day.c) - 0.3) * 100) / 100,
  }
  return candles
}

export default function Earnings() {
  const [result, setResult] = useState<Result>('beat')
  const [guidance, setGuidance] = useState<Guidance>('raised')
  const actual = ACTUAL[result]
  const surprise = ((actual - EXPECTED) / EXPECTED) * 100
  const reaction = REACTION[`${result}-${guidance}`]
  const data = path(result, guidance)

  return (
    <Figure
      caption="The market reacts to results versus what was expected, and to the outlook (guidance). Reactions here are illustrative."
      readout={
        <>
          <Stat
            label="EPS"
            value={`${formatMoney(actual)} vs ${formatMoney(EXPECTED)} expected: ${result === 'beat' ? '▲ beat' : '▼ miss'} ${formatSignedPct(surprise, 0)}`}
            color={signColor(surprise)}
          />
          <Stat
            label="Gap"
            value={`${arrow(reaction.gap)} ${formatSignedPct(reaction.gap)}`}
            color={signColor(reaction.gap)}
          />
          <Note>{reaction.note}</Note>
        </>
      }
      controls={
        <>
          <Segmented
            label="Earnings result"
            value={result}
            onChange={setResult}
            options={[
              { id: 'beat', label: '▲ Beat' },
              { id: 'miss', label: '▼ Miss' },
            ]}
          />
          <Segmented
            label="Guidance"
            value={guidance}
            onChange={setGuidance}
            options={[
              { id: 'raised', label: 'Guidance raised' },
              { id: 'cut', label: 'Guidance cut' },
            ]}
          />
        </>
      }
    >
      {(width) => {
        const height = 190
        const split = Math.round(width * 0.36)
        const base = height - 24
        const ey = linear([0, 1.5], [base, 24])
        const bw = Math.min(44, split / 4)
        const bars = [
          { label: 'Expected', value: EXPECTED, x: split * 0.28 },
          { label: 'Actual', value: actual, x: split * 0.7 },
        ]
        const cx0 = split + 16
        const cx1 = width - 6
        const domain = extent(
          data.flatMap((c) => [c.h, c.l]),
          0.1,
        )
        const y = linear(domain, [base, 24])
        const band = bands(data.length, cx0, cx1)
        const prev = data[REPORT_DAY - 1].c
        const open = data[REPORT_DAY].o
        const ax = band.x(REPORT_DAY) - band.step / 2
        return (
          <Svg
            width={width}
            height={height}
            label={`EPS ${formatMoney(actual)} against ${formatMoney(EXPECTED)} expected, guidance ${guidance}. The price gaps ${formatSignedPct(reaction.gap)} on the report.`}
          >
            <text x={0} y={12} className={`${s.small} ${s.word}`}>
              Earnings per share
            </text>
            <line
              x1={0}
              x2={split}
              y1={base}
              y2={base}
              style={{ stroke: C.borderStrong }}
            />
            {bars.map((bar) => (
              <g key={bar.label}>
                <rect
                  x={bar.x - bw / 2}
                  y={ey(bar.value)}
                  width={bw}
                  height={base - ey(bar.value)}
                  rx={4}
                  style={{
                    fill:
                      bar.label === 'Expected'
                        ? C.surface3
                        : result === 'beat'
                          ? C.gain
                          : C.loss,
                    stroke: bar.label === 'Expected' ? C.borderStrong : 'none',
                  }}
                />
                <text
                  x={bar.x}
                  y={ey(bar.value) - 6}
                  textAnchor="middle"
                  className={s.strong}
                >
                  {formatMoney(bar.value)}
                </text>
                <text
                  x={bar.x}
                  y={base + 16}
                  textAnchor="middle"
                  className={`${s.small} ${s.word}`}
                >
                  {bar.label}
                </text>
              </g>
            ))}
            <line
              x1={bars[0].x - bw / 2}
              x2={bars[1].x + bw / 2}
              y1={ey(EXPECTED)}
              y2={ey(EXPECTED)}
              style={{ stroke: C.muted }}
              strokeDasharray="3 3"
            />
            <text x={cx0} y={12} className={`${s.small} ${s.word}`}>
              Share price around the report
            </text>
            <line
              x1={ax}
              x2={ax}
              y1={20}
              y2={base}
              style={{ stroke: C.borderStrong }}
              strokeDasharray="2 3"
            />
            <text
              x={ax}
              y={base + 16}
              textAnchor="middle"
              className={`${s.small} ${s.word}`}
            >
              report
            </text>
            <rect
              x={band.x(REPORT_DAY - 1) + band.body / 2}
              y={Math.min(y(prev), y(open))}
              width={band.step - band.body}
              height={Math.abs(y(prev) - y(open))}
              style={{ fill: C.goldSoft }}
            />
            <Candles data={data} x={band.x} y={y} width={band.body} />
            <text
              x={ax - 6}
              y={y(open) + 4}
              textAnchor="end"
              className={`${s.strong} ${s.halo}`}
              style={{ fill: signColor(reaction.gap) }}
            >
              {arrow(reaction.gap)} {formatSignedPct(reaction.gap)} gap
            </text>
          </Svg>
        )
      }}
    </Figure>
  )
}
