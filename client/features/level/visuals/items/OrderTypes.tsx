import { useState } from 'react'
import type { OrderType as Kind } from '../../../../api/api-enums.ts'
import { formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { Candles, DayAxis, PriceGrid } from '../shared/Chart.tsx'
import { bands, linear, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { fillOnFall, type Candle, type Fill } from '../shared/trading.ts'
import { Figure, Note, Segmented, Stat, Svg } from '../shared/ui.tsx'

const PATH: Candle[] = [
  { o: 50.2, h: 50.6, l: 49.7, c: 50.0 },
  { o: 50.4, h: 50.8, l: 49.6, c: 49.8 },
  { o: 49.7, h: 49.9, l: 48.6, c: 48.9 },
  { o: 48.8, h: 49.0, l: 47.6, c: 47.9 },
  { o: 47.9, h: 48.3, l: 46.9, c: 47.2 },
  { o: 47.0, h: 47.4, l: 45.6, c: 45.9 },
  { o: 45.8, h: 46.0, l: 44.6, c: 44.9 },
  { o: 44.9, h: 45.3, l: 44.0, c: 44.4 },
]

const ORDERS: Record<
  Kind,
  { label: string; order: string; level?: number; rule: string; fill: Fill }
> = {
  market: {
    label: 'Market',
    order: 'Buy at market',
    rule: 'Fills at the next available price (here, the next open). Certain to fill; the price is not certain.',
    fill: { day: 1, price: PATH[1].o },
  },
  limit: {
    label: 'Limit',
    order: 'Buy limit $48.00',
    level: 48,
    rule: 'Waits until a day trades at $48.00 or lower. You get your price or better, but it may never fill.',
    fill: fillOnFall(PATH, 48, 1) as Fill,
  },
  stop: {
    label: 'Stop',
    order: 'Sell stop $45.00',
    level: 45,
    rule: 'A tripwire for shares you hold. It does nothing until price trades at $45.00 or lower, then becomes a market sell.',
    fill: fillOnFall(PATH, 45, 1) as Fill,
  },
}

export default function OrderTypes() {
  const [kind, setKind] = useState<Kind>('market')
  const order = ORDERS[kind]

  return (
    <Figure
      caption="Each order is placed after the close on day 1. Watch when each one fills on the same price path."
      readout={
        <>
          <Stat
            label={order.order}
            value={`fills day ${order.fill.day + 1} at ${formatMoney(order.fill.price)}`}
            color={C.gold}
          />
          <Note>{order.rule}</Note>
        </>
      }
      controls={
        <Segmented
          label="Order type"
          value={kind}
          onChange={setKind}
          options={(Object.keys(ORDERS) as Kind[]).map((id) => ({
            id,
            label: ORDERS[id].label,
          }))}
        />
      }
    >
      {(width) => {
        const height = 200
        const x0 = 4
        const x1 = width - 56
        const y = linear([43.5, 51.2], [height - 22, 10])
        const band = bands(PATH.length, x0, x1)
        const fx = band.x(order.fill.day)
        const fy = y(order.fill.price)
        const placedX = (band.x(0) + band.x(1)) / 2
        return (
          <Svg
            width={width}
            height={height}
            label={`${order.order}: fills on day ${order.fill.day + 1} at ${formatMoney(order.fill.price)}.`}
          >
            <PriceGrid y={y} values={ticks(43.5, 51.2, 4)} x0={x0} x1={x1} />
            <line
              x1={placedX}
              x2={placedX}
              y1={10}
              y2={height - 22}
              style={{ stroke: C.borderStrong }}
              strokeDasharray="2 3"
            />
            <text
              x={placedX + 4}
              y={height - 26}
              className={`${s.small} ${s.word}`}
            >
              order placed
            </text>
            {order.level !== undefined && (
              <g>
                <line
                  x1={placedX}
                  x2={x1}
                  y1={y(order.level)}
                  y2={y(order.level)}
                  style={{
                    stroke: kind === 'stop' ? C.loss : C.info,
                    strokeWidth: 2,
                  }}
                  strokeDasharray="6 4"
                />
                <text
                  x={x1 - 2}
                  y={y(order.level) - 6}
                  textAnchor="end"
                  className={`${s.small} ${s.strong} ${s.halo}`}
                >
                  {order.order}
                </text>
              </g>
            )}
            <Candles
              data={PATH}
              x={band.x}
              y={y}
              width={band.body}
              dim={(i) => i > order.fill.day}
            />
            <circle
              cx={fx}
              cy={fy}
              r={9}
              style={{ fill: 'none', stroke: C.gold, strokeWidth: 2 }}
            />
            <circle cx={fx} cy={fy} r={3.5} style={{ fill: C.gold }} />
            <text
              x={fx > x1 - 110 ? fx - 13 : fx + 13}
              y={fy + 4}
              textAnchor={fx > x1 - 110 ? 'end' : 'start'}
              className={`${s.strong} ${s.halo}`}
              style={{ fill: C.gold }}
            >
              filled {formatMoney(order.fill.price)}
            </text>
            <DayAxis x={band.x} y={height - 6} days={PATH.map((_, i) => i)} />
          </Svg>
        )
      }}
    </Figure>
  )
}
