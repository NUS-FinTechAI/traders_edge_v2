import { useState } from 'react'
import s from '../visuals.module.css'
import { Candles, PriceGrid } from '../shared/Chart.tsx'
import { bands, extent, linear, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import type { Candle } from '../shared/trading.ts'
import { Figure, Note, Segmented, Stat, Svg } from '../shared/ui.tsx'

type Id = 'doji' | 'hammer' | 'star' | 'engulfing'

interface Pattern {
  label: string
  candles: Candle[]
  marked: number[]
  meaning: string
  detail: string
}

const PATTERNS: Record<Id, Pattern> = {
  doji: {
    label: 'Doji',
    candles: [
      { o: 28.0, h: 28.7, l: 27.8, c: 28.5 },
      { o: 28.5, h: 29.2, l: 28.3, c: 29.0 },
      { o: 29.0, h: 29.6, l: 28.8, c: 29.4 },
      { o: 29.4, h: 30.1, l: 29.2, c: 29.9 },
      { o: 29.9, h: 30.4, l: 29.6, c: 30.0 },
      { o: 30.0, h: 30.9, l: 29.2, c: 30.02 },
      { o: 30.0, h: 30.3, l: 29.3, c: 29.5 },
    ],
    marked: [5],
    meaning:
      'Open and close almost equal: buyers and sellers ended the day balanced. A sign of indecision.',
    detail: 'O 30.00 · C 30.02 · body 0.02',
  },
  hammer: {
    label: 'Hammer',
    candles: [
      { o: 44.6, h: 44.9, l: 43.6, c: 43.9 },
      { o: 43.9, h: 44.1, l: 42.8, c: 43.0 },
      { o: 43.0, h: 43.3, l: 41.9, c: 42.1 },
      { o: 42.1, h: 42.4, l: 41.1, c: 41.3 },
      { o: 41.3, h: 41.5, l: 40.2, c: 40.5 },
      { o: 40.5, h: 40.7, l: 39.5, c: 39.7 },
      { o: 39.7, h: 40.1, l: 38.0, c: 40.0 },
      { o: 40.0, h: 41.1, l: 39.9, c: 40.9 },
    ],
    marked: [6],
    meaning:
      'After a decline, sellers pushed price down but buyers pushed it back up. A possible bullish reversal; wait for confirmation.',
    detail: 'Lower wick 1.70 vs body 0.30, near the top',
  },
  star: {
    label: 'Shooting star',
    candles: [
      { o: 55.6, h: 56.3, l: 55.4, c: 56.1 },
      { o: 56.1, h: 57.0, l: 55.9, c: 56.8 },
      { o: 56.8, h: 57.6, l: 56.5, c: 57.4 },
      { o: 57.4, h: 58.5, l: 57.2, c: 58.3 },
      { o: 58.3, h: 59.3, l: 58.1, c: 59.0 },
      { o: 59.0, h: 60.5, l: 58.8, c: 60.3 },
      { o: 60.4, h: 62.4, l: 60.1, c: 60.2 },
      { o: 60.1, h: 60.3, l: 59.0, c: 59.2 },
    ],
    marked: [6],
    meaning:
      'At the top of an uptrend, buyers pushed up but sellers pushed it back down. A possible bearish reversal.',
    detail: 'Upper wick 2.00 vs body 0.20, near the bottom',
  },
  engulfing: {
    label: 'Bullish engulfing',
    candles: [
      { o: 55.4, h: 55.6, l: 54.3, c: 54.5 },
      { o: 54.5, h: 54.8, l: 53.4, c: 53.6 },
      { o: 53.6, h: 53.9, l: 52.4, c: 52.7 },
      { o: 52.7, h: 52.9, l: 51.8, c: 52.0 },
      { o: 52.0, h: 52.3, l: 49.8, c: 50.0 },
      { o: 49.8, h: 52.9, l: 49.6, c: 52.6 },
      { o: 52.6, h: 53.4, l: 52.3, c: 53.1 },
    ],
    marked: [4, 5],
    meaning:
      'After a downtrend, a green body completely covers the previous red body. Buyers took over; still a clue, not a promise.',
    detail: 'Red 52.00 → 50.00, then green 49.80 → 52.60',
  },
}

const ORDER: Id[] = ['doji', 'hammer', 'star', 'engulfing']

export default function CandlePatterns() {
  const [id, setId] = useState<Id>('hammer')
  const pattern = PATTERNS[id]

  return (
    <Figure
      caption="Four common candle patterns. Where a pattern appears matters as much as its shape."
      readout={
        <>
          <Stat label={pattern.label} value={pattern.detail} color={C.gold} />
          <Note>{pattern.meaning}</Note>
        </>
      }
      controls={
        <Segmented
          label="Pattern"
          value={id}
          onChange={setId}
          options={ORDER.map((key) => ({
            id: key,
            label: PATTERNS[key].label,
          }))}
        />
      }
    >
      {(width) => {
        const height = 200
        const x0 = 6
        const x1 = width - 56
        const data = pattern.candles
        const domain = extent(
          data.flatMap((d) => [d.h, d.l]),
          0.08,
        )
        const y = linear(domain, [height - 10, 26])
        const band = bands(data.length, x0, x1)
        const first = pattern.marked[0]
        const last = pattern.marked[pattern.marked.length - 1]
        const marked = data.slice(first, last + 1)
        const boxTop = y(Math.max(...marked.map((d) => d.h))) - 6
        const boxBottom = y(Math.min(...marked.map((d) => d.l))) + 6
        const bx0 = band.x(first) - band.step / 2 + 2
        const bx1 = band.x(last) + band.step / 2 - 2
        return (
          <Svg
            width={width}
            height={height}
            label={`${pattern.label} example. ${pattern.detail}. ${pattern.meaning}`}
          >
            <PriceGrid y={y} values={ticks(...domain, 3)} x0={x0} x1={x1} />
            <rect
              x={bx0}
              y={boxTop}
              width={bx1 - bx0}
              height={boxBottom - boxTop}
              rx={6}
              style={{ fill: 'none', stroke: C.gold, strokeWidth: 1.5 }}
              strokeDasharray="4 3"
            />
            <Candles
              data={data}
              x={band.x}
              y={y}
              width={band.body}
              dim={(i) => i > last}
            />
            <text
              x={(bx0 + bx1) / 2}
              y={boxTop - 6}
              textAnchor="middle"
              className={`${s.word} ${s.strong}`}
              style={{ fill: C.gold }}
            >
              {pattern.label}
            </text>
          </Svg>
        )
      }}
    </Figure>
  )
}
