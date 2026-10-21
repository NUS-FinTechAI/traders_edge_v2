import { useState } from 'react'
import { formatMoney, formatSignedMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { linear } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { Figure, Note, Segmented, Stat, Svg } from '../shared/ui.tsx'

type Part = 'open' | 'high' | 'low' | 'close' | 'body' | 'wicks'

const PARTS: { id: Part; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'high', label: 'High' },
  { id: 'low', label: 'Low' },
  { id: 'close', label: 'Close' },
  { id: 'body', label: 'Body' },
  { id: 'wicks', label: 'Wicks' },
]

const MEANING: Record<Part, string> = {
  open: 'Open: the price of the first trade of the day.',
  high: 'High: the highest price traded during the day.',
  low: 'Low: the lowest price traded during the day.',
  close: 'Close: the last trade of the day. Line charts and your score use it.',
  body: 'Body: the box from open to close. Hollow green closed above its open; filled red closed below.',
  wicks:
    'Wicks: how far price reached beyond the body before it was pushed back.',
}

const HIGH = 51.0
const LOW = 47.1

export default function CandleAnatomy() {
  const [kind, setKind] = useState<'bull' | 'bear'>('bull')
  const [part, setPart] = useState<Part>('body')
  const bull = kind === 'bull'
  const open = bull ? 48.2 : 50.4
  const close = bull ? 50.4 : 48.2
  const color = bull ? C.gain : C.loss
  const on = (p: Part) => part === p

  return (
    <Figure
      caption="One candle shows four prices for one day. Tap a part to see what it means."
      readout={
        <>
          <Stat
            label={bull ? '▲ Bullish' : '▼ Bearish'}
            value={`${formatSignedMoney(close - open)} open → close`}
            color={color}
          />
          <Note>{MEANING[part]}</Note>
        </>
      }
      controls={
        <>
          <Segmented
            label="Candle type"
            value={kind}
            onChange={setKind}
            options={[
              { id: 'bull', label: '▲ Bullish' },
              { id: 'bear', label: '▼ Bearish' },
            ]}
          />
          <Segmented
            label="Candle part"
            value={part}
            onChange={setPart}
            options={PARTS}
          />
        </>
      }
    >
      {(width) => {
        const height = 230
        const y = linear([46.6, 51.5], [height - 12, 12])
        const cx = Math.round(width * 0.46)
        const bw = 46
        const top = y(Math.max(open, close))
        const bottom = y(Math.min(open, close))
        const hi = (p: Part) => (on(p) ? C.gold : color)
        const priceLabels: { id: Part; value: number; text: string }[] = [
          { id: 'high', value: HIGH, text: 'High' },
          { id: 'open', value: open, text: 'Open' },
          { id: 'close', value: close, text: 'Close' },
          { id: 'low', value: LOW, text: 'Low' },
        ]
        const brackets: { id: Part; from: number; to: number; text: string }[] =
          [
            { id: 'wicks', from: y(HIGH), to: top, text: 'Upper wick' },
            { id: 'body', from: top, to: bottom, text: 'Body' },
            { id: 'wicks', from: bottom, to: y(LOW), text: 'Lower wick' },
          ]
        const leftX = cx - bw / 2 - 16
        return (
          <Svg
            width={width}
            height={height}
            label={`${bull ? 'Bullish' : 'Bearish'} candle: open ${formatMoney(open)}, high ${formatMoney(HIGH)}, low ${formatMoney(LOW)}, close ${formatMoney(close)}.`}
          >
            <line
              x1={cx}
              x2={cx}
              y1={y(HIGH)}
              y2={top}
              style={{ stroke: hi('wicks'), strokeWidth: on('wicks') ? 4 : 2 }}
            />
            <line
              x1={cx}
              x2={cx}
              y1={bottom}
              y2={y(LOW)}
              style={{ stroke: hi('wicks'), strokeWidth: on('wicks') ? 4 : 2 }}
            />
            <rect
              x={cx - bw / 2}
              y={top}
              width={bw}
              height={bottom - top}
              rx={3}
              style={{
                fill: bull ? (on('body') ? C.goldSoft : C.bg) : color,
                stroke: hi('body'),
                strokeWidth: on('body') ? 3 : 2,
              }}
            />
            {priceLabels.map((label) => {
              const py = y(label.value)
              const active = on(label.id)
              return (
                <g
                  key={label.id}
                  className={s.tap}
                  onClick={() => setPart(label.id)}
                >
                  <line
                    x1={
                      cx +
                      (label.id === 'high' || label.id === 'low'
                        ? 4
                        : bw / 2 + 2)
                    }
                    x2={cx + bw / 2 + 26}
                    y1={py}
                    y2={py}
                    style={{ stroke: active ? C.gold : C.borderStrong }}
                    strokeDasharray="3 3"
                  />
                  {active && (
                    <circle
                      cx={
                        cx +
                        (label.id === 'high' || label.id === 'low' ? 0 : bw / 2)
                      }
                      cy={py}
                      r={5}
                      style={{ fill: C.gold }}
                    />
                  )}
                  <text
                    x={cx + bw / 2 + 32}
                    y={py + 4}
                    className={active ? s.strong : undefined}
                    style={active ? { fill: C.gold } : undefined}
                  >
                    <tspan className={s.word}>{label.text}</tspan>{' '}
                    {formatMoney(label.value)}
                  </text>
                </g>
              )
            })}
            {brackets.map((b, i) => {
              const active = on(b.id)
              const mid = (b.from + b.to) / 2
              return (
                <g key={i} className={s.tap} onClick={() => setPart(b.id)}>
                  <path
                    d={`M${leftX + 6},${b.from + 1}H${leftX}V${b.to - 1}H${leftX + 6}`}
                    style={{
                      fill: 'none',
                      stroke: active ? C.gold : C.borderStrong,
                      strokeWidth: 1.5,
                    }}
                  />
                  <text
                    x={leftX - 6}
                    y={mid + 4}
                    textAnchor="end"
                    className={`${s.word} ${active ? s.strong : ''}`}
                    style={active ? { fill: C.gold } : undefined}
                  >
                    {b.text}
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
