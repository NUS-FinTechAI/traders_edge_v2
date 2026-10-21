import { useState } from 'react'
import { formatMoney, formatSignedMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { Candles, DayAxis, PriceGrid } from '../shared/Chart.tsx'
import { bands, linear, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { fillOnFall, type Candle } from '../shared/trading.ts'
import { DragLine, Figure, Note, Stat, Svg } from '../shared/ui.tsx'

const ENTRY = 50
const SHARES = 100
const GAP_DAY = 6
const PATH: Candle[] = [
  { o: 49.6, h: 50.3, l: 49.4, c: 50.0 },
  { o: 50.1, h: 50.6, l: 49.5, c: 49.7 },
  { o: 49.7, h: 49.9, l: 48.6, c: 48.9 },
  { o: 48.8, h: 49.1, l: 47.7, c: 48.0 },
  { o: 48.1, h: 48.3, l: 46.6, c: 47.0 },
  { o: 47.0, h: 47.3, l: 45.8, c: 46.0 },
  { o: 40.0, h: 41.0, l: 39.2, c: 39.8 },
  { o: 39.8, h: 40.4, l: 38.9, c: 39.3 },
  { o: 39.4, h: 40.6, l: 39.0, c: 40.2 },
]
const LOWEST = Math.min(...PATH.slice(1).map((c) => c.l))

export default function StopLoss() {
  const [stop, setStop] = useState(45)
  const fill = fillOnFall(PATH, stop, 1)
  const planned = (stop - ENTRY) * SHARES
  const actual = fill ? (fill.price - ENTRY) * SHARES : null
  const gapped = fill !== null && fill.price < stop

  let message: string
  if (!fill)
    message = `Not triggered: the lowest price, ${formatMoney(LOWEST)}, stayed above your stop. The loss is still open.`
  else if (gapped)
    message = `Gap-through: bad news overnight and the stock opened at ${formatMoney(fill.price)}, below your stop. You sold there, ${formatMoney(stop - fill.price)} a share worse than planned. A stop is not a guaranteed price.`
  else
    message = `Stopped out on day ${fill.day + 1} at ${formatMoney(fill.price)}, as planned.`

  return (
    <Figure
      caption={`You bought ${SHARES} shares at ${formatMoney(ENTRY)}. Drag the sell stop below your entry and see where you would get out.`}
      readout={
        <>
          <Stat
            label="Risk if stopped"
            value={`▼ ${formatSignedMoney(planned)}`}
            color={C.loss}
          />
          <Stat
            label="Actual exit"
            value={
              fill
                ? `day ${fill.day + 1} at ${formatMoney(fill.price)} (${formatSignedMoney(actual ?? 0)})`
                : 'not triggered'
            }
            color={gapped ? C.loss : undefined}
          />
          <Note>{message}</Note>
        </>
      }
    >
      {(width) => {
        const height = 220
        const x0 = 4
        const x1 = width - 56
        const y = linear([37.5, 51.5], [height - 22, 10])
        const band = bands(PATH.length, x0, x1)
        const gx0 = band.x(GAP_DAY - 1) + band.body / 2
        const gx1 = band.x(GAP_DAY) - band.body / 2
        const prevClose = PATH[GAP_DAY - 1].c
        const gapOpen = PATH[GAP_DAY].o
        return (
          <Svg
            width={width}
            height={height}
            group
            label={`Price falls from ${formatMoney(ENTRY)} to close at ${formatMoney(prevClose)} on day ${GAP_DAY}, then opens at ${formatMoney(gapOpen)} after overnight news.`}
          >
            <PriceGrid y={y} values={ticks(37.5, 51.5, 4)} x0={x0} x1={x1} />
            <rect
              x={gx0}
              y={y(prevClose)}
              width={gx1 - gx0}
              height={y(gapOpen) - y(prevClose)}
              style={{ fill: C.lossSoft }}
            />
            <text
              x={(gx0 + gx1) / 2}
              y={y(gapOpen) + 16}
              textAnchor="middle"
              className={`${s.small} ${s.word}`}
            >
              gap
            </text>
            <line
              x1={x0}
              x2={x1}
              y1={y(ENTRY)}
              y2={y(ENTRY)}
              style={{ stroke: C.text, strokeWidth: 1.5 }}
            />
            <text
              x={x1 - 2}
              y={y(ENTRY) - 6}
              textAnchor="end"
              className={`${s.small} ${s.strong} ${s.halo}`}
            >
              Entry {formatMoney(ENTRY)}
            </text>
            <Candles
              data={PATH}
              x={band.x}
              y={y}
              width={band.body}
              dim={(i) => fill !== null && i > fill.day}
            />
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
              label="Sell stop price"
              tag={`Stop ${formatMoney(stop)}`}
              value={stop}
              min={38}
              max={49.5}
              step={0.1}
              y={y}
              x0={x0}
              x1={x1}
              color={C.loss}
              valueText={`${formatMoney(stop)}. ${fill ? `Exits day ${fill.day + 1} at ${formatMoney(fill.price)}` : 'Not triggered'}`}
              onChange={setStop}
            />
            <DayAxis x={band.x} y={height - 6} days={PATH.map((_, i) => i)} />
          </Svg>
        )
      }}
    </Figure>
  )
}
