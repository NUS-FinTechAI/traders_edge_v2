import { useState } from 'react'
import { formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { Candles, DayAxis, PriceGrid } from '../shared/Chart.tsx'
import { bands, linear, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { fillOnFall, type Candle } from '../shared/trading.ts'
import { DragLine, Figure, Note, Stat, Svg } from '../shared/ui.tsx'

const PATH: Candle[] = [
  { o: 50.2, h: 50.5, l: 49.8, c: 50.0 },
  { o: 50.3, h: 50.6, l: 49.5, c: 49.7 },
  { o: 49.6, h: 49.8, l: 48.9, c: 49.1 },
  { o: 49.0, h: 49.3, l: 48.5, c: 48.7 },
  { o: 48.7, h: 49.0, l: 48.2, c: 48.6 },
  { o: 48.7, h: 49.6, l: 48.5, c: 49.4 },
  { o: 49.5, h: 50.5, l: 49.3, c: 50.3 },
  { o: 50.3, h: 51.4, l: 50.1, c: 51.2 },
  { o: 51.2, h: 52.2, l: 51.0, c: 52.0 },
  { o: 52.1, h: 53.3, l: 51.9, c: 53.1 },
  { o: 53.1, h: 54.2, l: 52.8, c: 54.0 },
  { o: 54.0, h: 55.0, l: 53.7, c: 54.8 },
]
const MARKET = PATH[1].o
const LOWEST = Math.min(...PATH.slice(1).map((c) => c.l))
const LAST = PATH[PATH.length - 1].c

export default function LimitVsMarket() {
  const [limit, setLimit] = useState(48.5)
  const fill = fillOnFall(PATH, limit, 1)

  let message: string
  if (!fill)
    message = `No fill. The lowest price was ${formatMoney(LOWEST)}, then the stock rallied to ${formatMoney(LAST)} without you.`
  else if (limit >= MARKET)
    message = `Your limit is above the next open, so it fills at the better opening price, ${formatMoney(fill.price)}, like a market order.`
  else
    message = `Limit filled on day ${fill.day + 1} at ${formatMoney(fill.price)}: ${formatMoney(MARKET - fill.price)} a share cheaper than the market order.`

  return (
    <Figure
      caption="Both orders are placed after the close on day 1. Drag the buy limit to see if, and when, it fills."
      readout={
        <>
          <Stat label="Market buy" value={`day 2 at ${formatMoney(MARKET)}`} />
          <Stat
            label={`Buy limit ${formatMoney(limit)}`}
            value={
              fill
                ? `day ${fill.day + 1} at ${formatMoney(fill.price)}`
                : '✗ no fill'
            }
            color={fill ? C.gold : C.loss}
          />
          <Note>{message}</Note>
        </>
      }
    >
      {(width) => {
        const height = 210
        const x0 = 4
        const x1 = width - 56
        const y = linear([45.5, 55.5], [height - 22, 10])
        const band = bands(PATH.length, x0, x1)
        const mx = band.x(1)
        return (
          <Svg
            width={width}
            height={height}
            group
            label="Twelve daily candles: price dips to $48.20 on day 5, then rallies to $54.80."
          >
            <PriceGrid y={y} values={ticks(45.5, 55.5, 4)} x0={x0} x1={x1} />
            <Candles data={PATH} x={band.x} y={y} width={band.body} />
            <path
              d={`M${mx},${y(MARKET) - 7}l7,7l-7,7l-7,-7z`}
              style={{ fill: C.info, stroke: C.bg, strokeWidth: 1.5 }}
            />
            <text
              x={mx}
              y={y(MARKET) - 12}
              textAnchor="middle"
              className={`${s.small} ${s.strong} ${s.halo}`}
              style={{ fill: C.info }}
            >
              market
            </text>
            {fill && (
              <g>
                <circle
                  cx={band.x(fill.day)}
                  cy={y(fill.price)}
                  r={9}
                  style={{ fill: 'none', stroke: C.gold, strokeWidth: 2 }}
                />
                <circle
                  cx={band.x(fill.day)}
                  cy={y(fill.price)}
                  r={3.5}
                  style={{ fill: C.gold }}
                />
              </g>
            )}
            <DragLine
              label="Buy limit price"
              tag={`Buy limit ${formatMoney(limit)}`}
              value={limit}
              min={46}
              max={52}
              step={0.05}
              y={y}
              x0={x0}
              x1={x1}
              tagX={Math.max(x0 + 2, x1 - 150)}
              color={C.gold}
              valueText={`${formatMoney(limit)}: ${fill ? `fills day ${fill.day + 1} at ${formatMoney(fill.price)}` : 'no fill'}`}
              onChange={setLimit}
            />
            <DayAxis x={band.x} y={height - 6} days={[0, 2, 4, 6, 8, 10]} />
          </Svg>
        )
      }}
    </Figure>
  )
}
