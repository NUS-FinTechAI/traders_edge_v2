import { useState } from 'react'
import { formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { linear } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { Figure, Note, Range, Stat, Svg } from '../shared/ui.tsx'

const MID = 50
const LEVELS = [
  { name: 'Very thin', spread: 0.5, orders: 2 },
  { name: 'Thin', spread: 0.3, orders: 3 },
  { name: 'Normal', spread: 0.1, orders: 5 },
  { name: 'Busy', spread: 0.04, orders: 8 },
  { name: 'Very busy', spread: 0.02, orders: 12 },
]
const SHARES = 100

export default function BidAskSpread() {
  const [index, setIndex] = useState(2)
  const level = LEVELS[index]
  const bid = MID - level.spread / 2
  const ask = MID + level.spread / 2
  const spreadPct = (level.spread / MID) * 100
  const roundTrip = level.spread * SHARES

  return (
    <Figure
      caption="Buyers pay the ask; sellers get the bid. Busy stocks have tight spreads; thinly traded ones have wide spreads."
      readout={
        <>
          <Stat label="Bid" value={formatMoney(bid)} />
          <Stat label="Ask" value={formatMoney(ask)} />
          <Stat label="Mid ◆" value={formatMoney(MID)} />
          <Stat
            label="Spread"
            value={`${formatMoney(level.spread)} (${spreadPct.toFixed(2)}%)`}
          />
          <Note>
            Buy {SHARES} at {formatMoney(ask)} and sell straight back at{' '}
            {formatMoney(bid)}: you lose{' '}
            <strong style={{ color: 'var(--loss)' }}>
              ▼ −{formatMoney(roundTrip)}
            </strong>{' '}
            before the price moves at all.
          </Note>
        </>
      }
      controls={
        <Range
          label="Liquidity"
          min={0}
          max={LEVELS.length - 1}
          step={1}
          value={index}
          display={level.name}
          valueText={`${level.name}: spread ${formatMoney(level.spread)}`}
          onChange={setIndex}
        />
      }
    >
      {(width) => {
        const height = 160
        const x = linear([MID - 0.32, MID + 0.32], [12, width - 12])
        const axisY = 72
        const dots = (side: 'bid' | 'ask') =>
          Array.from({ length: level.orders }, (_, i) => {
            const row = i % 3
            const col = Math.floor(i / 3)
            const start = side === 'bid' ? x(bid) : x(ask)
            const dx = (col * 14 + 8) * (side === 'bid' ? -1 : 1)
            return (
              <circle
                key={`${side}${i}`}
                cx={start + dx}
                cy={axisY + 40 + row * 12}
                r={4}
                style={{
                  fill: side === 'bid' ? C.gain : C.loss,
                  opacity: 0.75,
                }}
              />
            )
          })
        return (
          <Svg
            width={width}
            height={height}
            label={`Bid ${formatMoney(bid)}, ask ${formatMoney(ask)}, mid ${formatMoney(MID)}, spread ${formatMoney(level.spread)}.`}
          >
            <line
              x1={12}
              x2={width - 12}
              y1={axisY}
              y2={axisY}
              style={{ stroke: C.borderStrong, strokeWidth: 1.5 }}
            />
            {[-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3].map((d) => (
              <g key={d} aria-hidden="true">
                <line
                  x1={x(MID + d)}
                  x2={x(MID + d)}
                  y1={axisY - 4}
                  y2={axisY + 4}
                  style={{ stroke: C.borderStrong }}
                />
                {d !== 0 && Math.abs(d) !== 0.1 && (
                  <text
                    x={x(MID + d)}
                    y={height - 4}
                    textAnchor="middle"
                    className={s.small}
                    style={{ fill: C.dim }}
                  >
                    {formatMoney(MID + d)}
                  </text>
                )}
              </g>
            ))}
            <rect
              x={x(bid)}
              y={axisY - 7}
              width={Math.max(1, x(ask) - x(bid))}
              height={14}
              style={{ fill: C.goldSoft, stroke: C.gold }}
            />
            <path
              d={`M${x(bid)},${axisY - 30}v-6H${x(ask)}v6`}
              style={{ fill: 'none', stroke: C.gold, strokeWidth: 1.5 }}
            />
            <text
              x={x(MID)}
              y={axisY - 44}
              textAnchor="middle"
              className={s.strong}
              style={{ fill: C.gold }}
            >
              Spread {formatMoney(level.spread)}
            </text>
            <text
              x={x(bid) - 8}
              y={axisY - 14}
              textAnchor="end"
              className={s.strong}
            >
              Bid {formatMoney(bid)}
            </text>
            <text
              x={x(bid) - 8}
              y={axisY + 20}
              textAnchor="end"
              className={`${s.small} ${s.word}`}
            >
              you sell here
            </text>
            <text x={x(ask) + 8} y={axisY - 14} className={s.strong}>
              Ask {formatMoney(ask)}
            </text>
            <text
              x={x(ask) + 8}
              y={axisY + 20}
              className={`${s.small} ${s.word}`}
            >
              you buy here
            </text>
            <path
              d={`M${x(MID)},${axisY - 5}l4,5l-4,5l-4,-5z`}
              style={{ fill: C.text }}
            />
            {dots('bid')}
            {dots('ask')}
          </Svg>
        )
      }}
    </Figure>
  )
}
