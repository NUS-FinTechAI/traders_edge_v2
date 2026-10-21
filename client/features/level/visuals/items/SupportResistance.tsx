import { useState } from 'react'
import { formatMoney } from '../../../../ui/format.ts'
import { Candles, PriceGrid } from '../shared/Chart.tsx'
import { candlesFromCloses, throughPoints } from '../shared/data.ts'
import { bands, linear, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import type { Candle } from '../shared/trading.ts'
import { DragLine, Figure, Note, Stat, Svg } from '../shared/ui.tsx'

const TOL = 0.25
const TOPS: [number, number][] = [
  [3, 54.05],
  [11, 53.95],
  [24, 54.1],
]
const BOTTOMS: [number, number][] = [
  [7, 47.95],
  [17, 48.05],
  [28, 48.0],
]

const DATA: Candle[] = (() => {
  const closes = throughPoints(
    [
      [0, 50.6],
      [3, 53.6],
      [7, 48.4],
      [11, 53.6],
      [14, 50.2],
      [17, 48.4],
      [21, 52.4],
      [24, 53.6],
      [28, 48.4],
      [31, 50.8],
    ],
    23,
    0.003,
  )
  const candles = candlesFromCloses(closes, 31).map((c) => ({
    ...c,
    h: Math.max(Math.min(c.h, 53.7), c.o, c.c),
    l: Math.min(Math.max(c.l, 48.3), c.o, c.c),
  }))
  for (const [day, high] of TOPS) candles[day].h = high
  for (const [day, low] of BOTTOMS) candles[day].l = low
  return candles
})()

/** Touch episodes: runs of consecutive days whose extreme sits in the zone. */
function touches(level: number, side: 'support' | 'resistance') {
  const hits: number[] = []
  let inRun = false
  DATA.forEach((candle, day) => {
    const extreme = side === 'support' ? candle.l : candle.h
    const hit = Math.abs(extreme - level) <= TOL
    if (hit && !inRun) hits.push(day)
    else if (hit) {
      const prev = hits[hits.length - 1]
      const better =
        side === 'support' ? candle.l < DATA[prev].l : candle.h > DATA[prev].h
      if (better) hits[hits.length - 1] = day
    }
    inRun = hit
  })
  return hits
}

const breaks = (level: number, side: 'support' | 'resistance') =>
  DATA.filter((c) => (side === 'support' ? c.c < level : c.c > level)).length

export default function SupportResistance() {
  const [support, setSupport] = useState(47)
  const [resistance, setResistance] = useState(55)
  const sHits = touches(support, 'support')
  const rHits = touches(resistance, 'resistance')
  const sBreaks = breaks(support, 'support')
  const rBreaks = breaks(resistance, 'resistance')
  const found = sHits.length >= 3 && rHits.length >= 3 && !sBreaks && !rBreaks

  const describe = (n: number, b: number, word: string) =>
    `${n} touch${n === 1 ? '' : 'es'}${b ? `, ${b} close${b === 1 ? '' : 's'} ${word}` : ''}`

  return (
    <Figure
      caption="Drag each line to the price where falls kept stopping (support) and rises kept stalling (resistance)."
      readout={
        <>
          <Stat
            label={`Support ${formatMoney(support)}`}
            value={describe(sHits.length, sBreaks, 'below')}
          />
          <Stat
            label={`Resistance ${formatMoney(resistance)}`}
            value={describe(rHits.length, rBreaks, 'above')}
          />
          <Note>
            {found
              ? '✓ Found them. Treat each level as a zone, not an exact line.'
              : 'A touch is a day whose low (or high) comes within $0.25 of the line.'}
          </Note>
        </>
      }
    >
      {(width) => {
        const height = 220
        const x0 = 4
        const x1 = width - 56
        const y = linear([46, 56], [height - 8, 8])
        const band = bands(DATA.length, x0, x1)
        const zone = (level: number, color: string) => (
          <rect
            x={x0}
            y={y(level + TOL)}
            width={x1 - x0}
            height={y(level - TOL) - y(level + TOL)}
            style={{ fill: color, opacity: 0.6 }}
          />
        )
        return (
          <Svg
            width={width}
            height={height}
            group
            label="Range-bound candle chart with draggable support and resistance lines"
          >
            <PriceGrid y={y} values={ticks(46, 56, 5)} x0={x0} x1={x1} />
            {zone(support, C.gainSoft)}
            {zone(resistance, C.lossSoft)}
            <Candles data={DATA} x={band.x} y={y} width={band.body} />
            {sHits.map((day) => (
              <circle
                key={`s${day}`}
                cx={band.x(day)}
                cy={y(DATA[day].l) + 6}
                r={4}
                style={{ fill: C.gold, stroke: C.bg, strokeWidth: 1.5 }}
              />
            ))}
            {rHits.map((day) => (
              <circle
                key={`r${day}`}
                cx={band.x(day)}
                cy={y(DATA[day].h) - 6}
                r={4}
                style={{ fill: C.gold, stroke: C.bg, strokeWidth: 1.5 }}
              />
            ))}
            <DragLine
              label="Resistance level"
              tag={`Resistance ${formatMoney(resistance)}`}
              value={resistance}
              min={50}
              max={56}
              step={0.05}
              y={y}
              x0={x0}
              x1={x1}
              color={C.loss}
              tagSide="above"
              valueText={`${formatMoney(resistance)}, ${rHits.length} touches`}
              onChange={(v) => setResistance(Math.max(v, support + 1))}
            />
            <DragLine
              label="Support level"
              tag={`Support ${formatMoney(support)}`}
              value={support}
              min={46}
              max={52}
              step={0.05}
              y={y}
              x0={x0}
              x1={x1}
              tagX={Math.max(x0 + 150, x1 - 130)}
              color={C.gain}
              tagSide="below"
              valueText={`${formatMoney(support)}, ${sHits.length} touches`}
              onChange={(v) => setSupport(Math.min(v, resistance - 1))}
            />
          </Svg>
        )
      }}
    </Figure>
  )
}
