import { useState } from 'react'
import Button from '../../../../ui/Button.tsx'
import { formatMoney, formatSignedMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { linear, linePath } from '../shared/scale.ts'
import { arrow, C, signColor } from '../shared/theme.ts'
import { Figure, Note, Stat, Svg } from '../shared/ui.tsx'

const START = 50
const STEP = 0.25
const MAX = 9
const WINDOW = 14

const priceFor = (buyers: number, sellers: number) =>
  START + STEP * (buyers - sellers)

function people(
  count: number,
  side: 'B' | 'S',
  x0: number,
  x1: number,
  y: number,
) {
  const span = x1 - x0
  const gap = Math.min(24, span / MAX)
  const r = Math.min(10, gap / 2 - 1)
  return Array.from({ length: count }, (_, i) => {
    const cx = side === 'B' ? x0 + gap * (i + 0.5) : x1 - gap * (i + 0.5)
    const color = side === 'B' ? C.gain : C.loss
    return (
      <g key={i}>
        <circle
          cx={cx}
          cy={y}
          r={r}
          style={{
            fill: side === 'B' ? C.gainSoft : C.lossSoft,
            stroke: color,
          }}
        />
        <text
          x={cx}
          y={y + 4}
          textAnchor="middle"
          className={`${s.small} ${s.strong}`}
          style={{ fill: color }}
        >
          {side}
        </text>
      </g>
    )
  })
}

export default function SupplyDemand() {
  const [buyers, setBuyers] = useState(3)
  const [sellers, setSellers] = useState(3)
  const [history, setHistory] = useState<number[]>([START])
  const price = priceFor(buyers, sellers)
  const change = price - START
  const buyShare = buyers / (buyers + sellers)

  function add(side: 'buyer' | 'seller') {
    const b = buyers + (side === 'buyer' ? 1 : 0)
    const n = sellers + (side === 'seller' ? 1 : 0)
    setBuyers(b)
    setSellers(n)
    setHistory((h) => [...h, priceFor(b, n)].slice(-WINDOW))
  }

  function reset() {
    setBuyers(3)
    setSellers(3)
    setHistory([START])
  }

  const message =
    buyers > sellers
      ? 'More buyers than sellers: buyers must offer more to get shares, so the price rises.'
      : buyers < sellers
        ? 'More sellers than buyers: sellers must accept less to find a buyer, so the price falls.'
        : 'Balanced: neither side has to give way, so the price holds.'

  return (
    <Figure
      caption="Add buyers or sellers and watch which side has to give way on price."
      readout={
        <>
          <Stat label="Price" value={formatMoney(price)} />
          <Stat
            label="Change"
            value={`${arrow(change)} ${formatSignedMoney(change)}`}
            color={signColor(change)}
          />
          <Note>{message}</Note>
        </>
      }
      controls={
        <>
          <Button
            variant="buy"
            icon="plus"
            disabled={buyers >= MAX}
            onClick={() => add('buyer')}
          >
            Add buyer
          </Button>
          <Button
            variant="sell"
            icon="plus"
            disabled={sellers >= MAX}
            onClick={() => add('seller')}
          >
            Add seller
          </Button>
          <Button variant="ghost" icon="refresh" onClick={reset}>
            Reset
          </Button>
        </>
      }
    >
      {(width) => {
        const height = 220
        const x0 = 8
        const x1 = width - 62
        const y = linear([START - 2.5, START + 2.5], [104, 14])
        const x = linear([0, WINDOW - 1], [x0, x1])
        const last = history.length - 1
        const meterY = 186
        const mid = (x0 + width - 8) / 2
        const split = x0 + (width - 16) * buyShare
        return (
          <Svg
            width={width}
            height={height}
            label={`${buyers} buyers and ${sellers} sellers. Price ${formatMoney(price)}, ${formatSignedMoney(change)} from the start.`}
          >
            {[START - 2, START, START + 2].map((v) => (
              <g key={v} aria-hidden="true">
                <line
                  x1={x0}
                  x2={x1}
                  y1={y(v)}
                  y2={y(v)}
                  style={{ stroke: C.border }}
                  strokeDasharray={v === START ? undefined : '2 4'}
                />
                <text x={x1 + 6} y={y(v) + 4} className={s.small}>
                  {formatMoney(v)}
                </text>
              </g>
            ))}
            <path
              d={linePath(history, x, y)}
              style={{ fill: 'none', stroke: C.gold, strokeWidth: 2 }}
            />
            <circle
              className={s.ease}
              cx={x(last)}
              cy={y(price)}
              r={5}
              style={{ fill: C.gold, stroke: C.bg, strokeWidth: 2 }}
            />
            <text
              x={x(last)}
              y={y(price) - 10}
              textAnchor={last > WINDOW / 2 ? 'end' : 'start'}
              className={s.strong}
            >
              {arrow(change)} {formatMoney(price)}
            </text>
            <text x={x0} y={134} className={`${s.small} ${s.word}`}>
              Buyers {buyers}
            </text>
            <text
              x={width - 8}
              y={134}
              textAnchor="end"
              className={`${s.small} ${s.word}`}
            >
              Sellers {sellers}
            </text>
            {people(buyers, 'B', x0, mid - 4, 154)}
            {people(sellers, 'S', mid + 4, width - 8, 154)}
            <rect
              className={s.ease}
              x={x0}
              y={meterY}
              width={split - x0}
              height={12}
              rx={3}
              style={{ fill: C.gain }}
            />
            <rect
              className={s.ease}
              x={split}
              y={meterY}
              width={width - 8 - split}
              height={12}
              rx={3}
              style={{ fill: C.loss }}
            />
            <line
              x1={mid}
              x2={mid}
              y1={meterY - 4}
              y2={meterY + 16}
              style={{ stroke: C.text, strokeWidth: 2 }}
            />
            <text x={x0} y={meterY + 26} className={`${s.small} ${s.word}`}>
              Buy pressure {Math.round(buyShare * 100)}%
            </text>
            <text
              x={width - 8}
              y={meterY + 26}
              textAnchor="end"
              className={`${s.small} ${s.word}`}
            >
              Sell pressure {Math.round((1 - buyShare) * 100)}%
            </text>
          </Svg>
        )
      }}
    </Figure>
  )
}
