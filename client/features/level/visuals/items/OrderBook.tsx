import { useState } from 'react'
import Button from '../../../../ui/Button.tsx'
import { formatCount, formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { C } from '../shared/theme.ts'
import { marketBuy, type BookLevel } from '../shared/trading.ts'
import { Figure, Note, Range, Stat, Svg } from '../shared/ui.tsx'

const ASKS: BookLevel[] = [
  { price: 50.05, size: 100 },
  { price: 50.1, size: 200 },
  { price: 50.15, size: 300 },
  { price: 50.2, size: 400 },
  { price: 50.25, size: 500 },
]
const BIDS: BookLevel[] = [
  { price: 49.95, size: 150 },
  { price: 49.9, size: 250 },
  { price: 49.85, size: 300 },
  { price: 49.8, size: 400 },
  { price: 49.75, size: 500 },
]
const MAX_SIZE = 500
const TOTAL_ASKS = ASKS.reduce((t, l) => t + l.size, 0)

/** Cents when exact, otherwise a tenth of a cent so averages stay honest. */
const price = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
    ? formatMoney(value)
    : `$${value.toFixed(3)}`

export default function OrderBook() {
  const [quantity, setQuantity] = useState(250)
  const [placed, setPlaced] = useState(false)
  const fill = marketBuy(ASKS, quantity)
  const best = ASKS[0].price
  const slip = fill.average - best
  const used = (level: BookLevel) =>
    placed ? (fill.fills.find((f) => f.price === level.price)?.size ?? 0) : 0

  return (
    <Figure
      caption="The order book lists waiting limit orders: asks (sellers) above, bids (buyers) below. A market buy takes the cheapest asks first."
      readout={
        placed ? (
          <>
            <Stat label="Filled" value={`${formatCount(fill.filled)} shares`} />
            <Stat label="Average" value={price(fill.average)} />
            <Stat
              label="Slippage"
              value={`+${price(slip)}/share (+${formatMoney(slip * fill.filled)})`}
              color={slip > 0 ? C.loss : undefined}
            />
            <Note>
              {fill.fills
                .map((f) => `${formatCount(f.size)} @ ${formatMoney(f.price)}`)
                .join(' + ')}
              . You expected {formatMoney(best)}; the extra levels (gold) cost
              more.
            </Note>
          </>
        ) : (
          <>
            <Stat label="Best ask" value={formatMoney(best)} />
            <Stat label="Shares there" value={formatCount(ASKS[0].size)} />
            <Note>
              Choose an order size, then place a market buy to see where it
              fills.
            </Note>
          </>
        )
      }
      controls={
        <>
          <Range
            label="Market buy size"
            min={50}
            max={TOTAL_ASKS}
            step={50}
            value={quantity}
            display={`${formatCount(quantity)} shares`}
            onChange={(v) => {
              setQuantity(v)
              setPlaced(false)
            }}
          />
          <Button
            variant={placed ? 'secondary' : 'buy'}
            icon={placed ? 'refresh' : undefined}
            onClick={() => setPlaced(!placed)}
          >
            {placed ? 'Reset book' : 'Place market buy'}
          </Button>
        </>
      }
    >
      {(width) => {
        const rowH = 26
        const head = 22
        const height = head + rowH * 11 + 4
        const mid = width / 2
        const priceW = 64
        const barMax = mid - priceW / 2 - 8
        const barW = (size: number) => (barMax * size) / MAX_SIZE
        const row = (i: number) => head + i * rowH
        const asks = [...ASKS].reverse()
        return (
          <Svg
            width={width}
            height={height}
            label={`Order book. Asks: ${ASKS.map((l) => `${l.size} at ${formatMoney(l.price)}`).join(', ')}. Bids: ${BIDS.map((l) => `${l.size} at ${formatMoney(l.price)}`).join(', ')}.`}
          >
            <text
              x={mid - priceW / 2 - 6}
              y={14}
              textAnchor="end"
              className={`${s.small} ${s.word}`}
            >
              Bids (buyers)
            </text>
            <text
              x={mid}
              y={14}
              textAnchor="middle"
              className={`${s.small} ${s.word}`}
            >
              Price
            </text>
            <text
              x={mid + priceW / 2 + 6}
              y={14}
              className={`${s.small} ${s.word}`}
            >
              Asks (sellers)
            </text>
            {asks.map((level, i) => {
              const y = row(i)
              const taken = used(level)
              const left = level.size - taken
              const bx = mid + priceW / 2 + 4
              return (
                <g key={level.price}>
                  <rect
                    x={bx}
                    y={y + 3}
                    width={barW(left)}
                    height={rowH - 6}
                    rx={3}
                    style={{ fill: C.lossSoft, stroke: C.loss, strokeWidth: 1 }}
                  />
                  {taken > 0 && (
                    <rect
                      x={bx + barW(left)}
                      y={y + 3}
                      width={barW(taken)}
                      height={rowH - 6}
                      rx={3}
                      style={{
                        fill: C.goldSoft,
                        stroke: C.gold,
                        strokeWidth: 1.5,
                      }}
                    />
                  )}
                  <text
                    x={mid}
                    y={y + 17}
                    textAnchor="middle"
                    className={s.strong}
                  >
                    {formatMoney(level.price)}
                  </text>
                  <text
                    x={bx + 6}
                    y={y + 17}
                    className={`${s.strong} ${s.halo}`}
                  >
                    {taken > 0
                      ? left > 0
                        ? `${left} left`
                        : 'all bought'
                      : level.size}
                  </text>
                </g>
              )
            })}
            <text
              x={mid}
              y={row(5) + 17}
              textAnchor="middle"
              className={`${s.small} ${s.word}`}
              style={{ fill: C.gold }}
            >
              spread {formatMoney(ASKS[0].price - BIDS[0].price)}
            </text>
            {BIDS.map((level, i) => {
              const y = row(i + 6)
              const w = barW(level.size)
              const bx = mid - priceW / 2 - 4 - w
              return (
                <g key={level.price}>
                  <rect
                    x={bx}
                    y={y + 3}
                    width={w}
                    height={rowH - 6}
                    rx={3}
                    style={{ fill: C.gainSoft, stroke: C.gain, strokeWidth: 1 }}
                  />
                  <text
                    x={mid}
                    y={y + 17}
                    textAnchor="middle"
                    className={s.strong}
                  >
                    {formatMoney(level.price)}
                  </text>
                  <text
                    x={mid - priceW / 2 - 10}
                    y={y + 17}
                    textAnchor="end"
                    className={s.strong}
                  >
                    {level.size}
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
