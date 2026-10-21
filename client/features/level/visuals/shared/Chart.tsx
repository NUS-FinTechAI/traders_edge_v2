import { formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import type { Scale } from './scale.ts'
import { C } from './theme.ts'
import type { Candle } from './trading.ts'

/** Candles: up days are hollow, down days are filled, so shape carries direction. */
export function Candles({
  data,
  x,
  y,
  width,
  dim,
}: {
  data: readonly Candle[]
  x: (index: number) => number
  y: Scale
  width: number
  dim?: (index: number) => boolean
}) {
  const bw = Math.max(3, width)
  return (
    <g>
      {data.map((candle, i) => {
        const up = candle.c >= candle.o
        const color = up ? C.gain : C.loss
        const top = y(Math.max(candle.o, candle.c))
        const height = Math.max(1, y(Math.min(candle.o, candle.c)) - top)
        const cx = x(i)
        return (
          <g key={i} opacity={dim?.(i) ? 0.3 : 1}>
            <line
              x1={cx}
              x2={cx}
              y1={y(candle.h)}
              y2={top}
              style={{ stroke: color, strokeWidth: 1.25 }}
            />
            <line
              x1={cx}
              x2={cx}
              y1={top + height}
              y2={y(candle.l)}
              style={{ stroke: color, strokeWidth: 1.25 }}
            />
            <rect
              x={cx - bw / 2}
              y={top}
              width={bw}
              height={height}
              rx={1}
              style={{
                fill: up ? C.bg : color,
                stroke: color,
                strokeWidth: 1.25,
              }}
            />
          </g>
        )
      })}
    </g>
  )
}

/** Horizontal grid lines with price labels on the right. */
export function PriceGrid({
  y,
  values,
  x0,
  x1,
  format = (value) => formatMoney(value),
}: {
  y: Scale
  values: readonly number[]
  x0: number
  x1: number
  format?: (value: number) => string
}) {
  return (
    <g aria-hidden="true">
      {values.map((value) => (
        <g key={value}>
          <line
            x1={x0}
            x2={x1}
            y1={y(value)}
            y2={y(value)}
            style={{ stroke: C.border, strokeWidth: 1 }}
          />
          <text x={x1 + 6} y={y(value) + 4} className={s.small}>
            {format(value)}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Day labels along the bottom of a chart. */
export function DayAxis({
  x,
  y,
  days,
  label = (day) => `D${day + 1}`,
}: {
  x: (index: number) => number
  y: number
  days: readonly number[]
  label?: (day: number) => string
}) {
  return (
    <g aria-hidden="true">
      {days.map((day) => (
        <text
          key={day}
          x={x(day)}
          y={y}
          textAnchor="middle"
          className={s.small}
          style={{ fill: C.dim }}
        >
          {label(day)}
        </text>
      ))}
    </g>
  )
}
