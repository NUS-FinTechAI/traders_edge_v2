import { useState } from 'react'
import { formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { PriceGrid } from '../shared/Chart.tsx'
import { linear, ticks } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { breakevenWinRate, rMultiple } from '../shared/trading.ts'
import { DragLine, Figure, Note, Stat, Svg } from '../shared/ui.tsx'

const MIN = 43
const MAX = 59
const GAP = 1

export default function RiskReward() {
  const [stop, setStop] = useState(48)
  const [entry, setEntry] = useState(50)
  const [target, setTarget] = useState(54)
  const risk = entry - stop
  const reward = target - entry
  const r = rMultiple(entry, stop, target)
  const breakeven = breakevenWinRate(r) * 100

  return (
    <Figure
      caption="Drag the target, entry and stop. R is reward ÷ risk; a higher R needs fewer winners to break even."
      readout={
        <>
          <Stat label="Risk" value={`▼ ${formatMoney(risk)}`} color={C.loss} />
          <Stat
            label="Reward"
            value={`▲ ${formatMoney(reward)}`}
            color={C.gain}
          />
          <Stat label="R" value={`${r.toFixed(1)}R`} color={C.gold} />
          <Stat label="Breakeven win rate" value={`${breakeven.toFixed(1)}%`} />
          <Note>
            1 ÷ (1 + {r.toFixed(2)}) = {breakeven.toFixed(1)}%: win more often
            than that (before fees) and this plan makes money over many trades.
            {r < 1
              ? ' Below 1R, each win earns less than each loss costs.'
              : ''}
          </Note>
        </>
      }
    >
      {(width) => {
        const plotH = 230
        const height = plotH + 52
        const x0 = 4
        const x1 = width - 56
        const y = linear([MIN, MAX], [plotH - 6, 8])
        const zone = (from: number, to: number, fill: string, text: string) => {
          const top = y(Math.max(from, to))
          const h = Math.abs(y(from) - y(to))
          return (
            <g>
              <rect
                x={x0}
                y={top}
                width={x1 - x0}
                height={h}
                style={{ fill }}
              />
              {h > 30 && (
                <text
                  x={x1 - 8}
                  y={top + h / 2 + 4}
                  textAnchor="end"
                  className={`${s.word} ${s.strong}`}
                >
                  {text}
                </text>
              )}
            </g>
          )
        }
        const bx = linear([0, 100], [x0, width - 8])
        const barY = plotH + 22
        return (
          <Svg
            width={width}
            height={height}
            group
            label={`Trade plan: entry ${formatMoney(entry)}, stop ${formatMoney(stop)}, target ${formatMoney(target)}; ${r.toFixed(1)}R, breakeven win rate ${breakeven.toFixed(1)}%.`}
          >
            <PriceGrid y={y} values={ticks(MIN, MAX, 4)} x0={x0} x1={x1} />
            {zone(entry, target, C.gainSoft, `Reward ${r.toFixed(1)}R`)}
            {zone(stop, entry, C.lossSoft, 'Risk 1R')}
            <DragLine
              label="Target price"
              tag={`Target ${formatMoney(target)}`}
              value={target}
              min={MIN}
              max={MAX}
              step={0.1}
              y={y}
              x0={x0}
              x1={x1}
              color={C.gain}
              tagSide="above"
              valueText={`${formatMoney(target)}, reward ${formatMoney(reward)}`}
              onChange={(v) => setTarget(Math.max(v, entry + GAP))}
            />
            <DragLine
              label="Stop price"
              tag={`Stop ${formatMoney(stop)}`}
              value={stop}
              min={MIN}
              max={MAX}
              step={0.1}
              y={y}
              x0={x0}
              x1={x1}
              color={C.loss}
              tagSide="below"
              valueText={`${formatMoney(stop)}, risk ${formatMoney(risk)}`}
              onChange={(v) => setStop(Math.min(v, entry - GAP))}
            />
            <DragLine
              label="Entry price"
              tag={`Entry ${formatMoney(entry)}`}
              value={entry}
              min={MIN}
              max={MAX}
              step={0.1}
              y={y}
              x0={x0}
              x1={x1}
              tagX={x0 + Math.min(140, (x1 - x0) * 0.42)}
              color={C.gold}
              valueText={`${formatMoney(entry)}, ${r.toFixed(1)}R`}
              onChange={(v) =>
                setEntry(Math.min(Math.max(v, stop + GAP), target - GAP))
              }
            />
            <text x={x0} y={barY - 6} className={`${s.small} ${s.word}`}>
              Breakeven win rate
            </text>
            <rect
              x={bx(0)}
              y={barY}
              width={bx(100) - bx(0)}
              height={10}
              rx={3}
              style={{ fill: C.surface2, stroke: C.border }}
            />
            <rect
              x={bx(0)}
              y={barY}
              width={bx(breakeven) - bx(0)}
              height={10}
              rx={3}
              style={{ fill: C.gold }}
            />
            <text
              x={Math.min(bx(breakeven) + 6, width - 50)}
              y={barY + 24}
              className={s.strong}
            >
              {breakeven.toFixed(1)}%
            </text>
          </Svg>
        )
      }}
    </Figure>
  )
}
