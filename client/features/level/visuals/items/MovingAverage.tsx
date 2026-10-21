import { useState } from 'react'
import { formatMoney } from '../../../../ui/format.ts'
import { PriceGrid } from '../shared/Chart.tsx'
import { walk } from '../shared/data.ts'
import { ema, sma } from '../shared/indicators.ts'
import { extent, linear, linePath, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import {
  Figure,
  Legend,
  Note,
  Range,
  Stat,
  Svg,
  Toggle,
} from '../shared/ui.tsx'

const CLOSES = walk(7, 130, 40, (d) => 0.004 * Math.sin(d / 14) + 0.001, 0.011)
const SHOW = 80
const FIRST = CLOSES.length - SHOW

export default function MovingAverage() {
  const [period, setPeriod] = useState(20)
  const [showSma, setShowSma] = useState(true)
  const [showEma, setShowEma] = useState(true)
  const smaLine = sma(CLOSES, period).slice(FIRST)
  const emaLine = ema(CLOSES, period).slice(FIRST)
  const prices = CLOSES.slice(FIRST)
  const last = prices[SHOW - 1]
  const lastSma = smaLine[SHOW - 1] as number
  const lastEma = emaLine[SHOW - 1] as number
  const shown = [showSma && lastSma, showEma && lastEma].filter(
    (v): v is number => typeof v === 'number',
  )
  const above = shown.length > 0 && shown.every((v) => last > v)
  const below = shown.length > 0 && shown.every((v) => last < v)

  return (
    <Figure
      caption="A moving average smooths price. The EMA weights recent days more, so it turns sooner than the SMA; both lag."
      readout={
        <>
          <Stat label="Last close" value={formatMoney(last)} />
          {showSma && (
            <Stat
              label={`SMA ${period}`}
              value={formatMoney(lastSma)}
              color={C.info}
            />
          )}
          {showEma && (
            <Stat
              label={`EMA ${period}`}
              value={formatMoney(lastEma)}
              color={C.gold}
            />
          )}
          <Note>
            {shown.length === 0
              ? 'Turn on an average to compare it with price.'
              : above
                ? '▲ Price is above the average: as a trend filter, that reads as an uptrend.'
                : below
                  ? '▼ Price is below the average: as a trend filter, that reads as a downtrend.'
                  : 'Price sits between the averages: no clear signal.'}{' '}
            Longer periods are smoother but slower.
          </Note>
        </>
      }
      controls={
        <>
          <Toggle pressed={showSma} onChange={setShowSma}>
            SMA
          </Toggle>
          <Toggle pressed={showEma} onChange={setShowEma}>
            EMA
          </Toggle>
          <Range
            label="Period (days)"
            min={5}
            max={50}
            step={1}
            value={period}
            display={period}
            valueText={`${period} days`}
            onChange={setPeriod}
          />
        </>
      }
    >
      {(width) => {
        const height = 210
        const x0 = 4
        const x1 = width - 56
        const domain = extent(prices, 0.08)
        const y = linear(domain, [height - 10, 30])
        const x = linear([0, SHOW - 1], [x0, x1])
        const labels = [
          showSma && { text: `SMA ${period}`, value: lastSma, color: C.info },
          showEma && { text: `EMA ${period}`, value: lastEma, color: C.gold },
        ].filter((l) => l !== false)
        return (
          <Svg
            width={width}
            height={height}
            label={`Price over ${SHOW} days with ${[showSma && `SMA ${period}`, showEma && `EMA ${period}`].filter(Boolean).join(' and ') || 'no averages'}.`}
          >
            <PriceGrid
              y={y}
              values={ticks(...domain, 4)}
              x0={x0}
              x1={x1}
              format={(v) => `$${v}`}
            />
            <path
              d={linePath(prices, x, y)}
              style={{ fill: 'none', stroke: C.muted, strokeWidth: 1.5 }}
            />
            {showSma && (
              <path
                d={linePath(smaLine, x, y)}
                style={{ fill: 'none', stroke: C.info, strokeWidth: 2.5 }}
              />
            )}
            {showEma && (
              <path
                d={linePath(emaLine, x, y)}
                style={{ fill: 'none', stroke: C.gold, strokeWidth: 2.5 }}
                strokeDasharray="7 4"
              />
            )}
            <Legend
              items={[
                { text: 'Price', color: C.muted },
                ...labels.map((l) => ({
                  text: l.text,
                  color: l.color,
                  dash: l.color === C.gold,
                })),
              ]}
            />
          </Svg>
        )
      }}
    </Figure>
  )
}
