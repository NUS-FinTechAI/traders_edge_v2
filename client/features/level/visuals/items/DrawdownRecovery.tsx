import { useState } from 'react'
import { formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { linear, linePath } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { recoveryGainPct } from '../shared/trading.ts'
import { Figure, Note, Range, Stat, Svg } from '../shared/ui.tsx'

const START = 10_000
const MAX_LOSS = 80
const MAX_GAIN = 400
const CURVE = Array.from({ length: MAX_LOSS + 1 }, (_, i) => recoveryGainPct(i))

const pct = (value: number) =>
  `${value < 10 ? value.toFixed(1) : Math.round(value)}%`

export default function DrawdownRecovery() {
  const [loss, setLoss] = useState(50)
  const gain = recoveryGainPct(loss)
  const after = START * (1 - loss / 100)

  return (
    <Figure
      caption="Losses and recoveries are not symmetric: the deeper the fall, the bigger the gain needed just to get back."
      readout={
        <>
          <Stat label="Lose" value={`▼ −${loss}%`} color={C.loss} />
          <Stat label="Gain needed" value={`▲ +${pct(gain)}`} color={C.gain} />
          <Note>
            {formatMoney(START, true)} → {formatMoney(after, true)}. Getting
            back to {formatMoney(START, true)} needs{' '}
            {formatMoney(START - after, true)}, which is +{pct(gain)} of what is
            left. Gain = 1 ÷ (1 − loss) − 1.
          </Note>
        </>
      }
      controls={
        <Range
          label="Loss from the peak"
          min={5}
          max={MAX_LOSS}
          step={5}
          value={loss}
          display={`−${loss}%`}
          valueText={`Loss ${loss}%, gain needed ${pct(gain)}`}
          onChange={setLoss}
        />
      }
    >
      {(width) => {
        const height = 210
        const x0 = 42
        const x1 = width - 20
        const x = linear([0, MAX_LOSS], [x0, x1])
        const y = linear([0, MAX_GAIN], [height - 26, 10])
        const px = x(loss)
        const py = y(gain)
        return (
          <Svg
            width={width}
            height={height}
            label={`Curve of gain needed against loss. A ${loss}% loss needs a ${pct(gain)} gain to recover.`}
          >
            {[0, 100, 200, 300, 400].map((v) => (
              <g key={v} aria-hidden="true">
                <line
                  x1={x0}
                  x2={x1}
                  y1={y(v)}
                  y2={y(v)}
                  style={{ stroke: C.border }}
                />
                <text
                  x={x0 - 6}
                  y={y(v) + 4}
                  textAnchor="end"
                  className={s.small}
                >
                  +{v}%
                </text>
              </g>
            ))}
            {[0, 20, 40, 60, 80].map((v) => (
              <text
                key={v}
                x={x(v)}
                y={height - 8}
                textAnchor="middle"
                className={s.small}
                aria-hidden="true"
              >
                −{v}%
              </text>
            ))}
            <line
              x1={x(0)}
              y1={y(0)}
              x2={x(MAX_LOSS)}
              y2={y(MAX_LOSS)}
              style={{ stroke: C.muted, strokeWidth: 1.5 }}
              strokeDasharray="5 4"
            />
            <text
              x={x(MAX_LOSS)}
              y={y(MAX_LOSS) + 16}
              textAnchor="end"
              className={`${s.small} ${s.word}`}
            >
              if it were symmetric
            </text>
            <path
              d={linePath(CURVE, (i) => x(i), y)}
              style={{ fill: 'none', stroke: C.gold, strokeWidth: 2.5 }}
            />
            <line
              x1={px}
              x2={px}
              y1={y(0)}
              y2={py}
              style={{ stroke: C.gold }}
              strokeDasharray="2 3"
            />
            <circle
              cx={px}
              cy={py}
              r={6}
              style={{ fill: C.gold, stroke: C.bg, strokeWidth: 2 }}
            />
            <text
              x={px < x1 - 120 ? px + 10 : px - 10}
              y={py + (py < 30 ? 16 : -6)}
              textAnchor={px < x1 - 120 ? 'start' : 'end'}
              className={`${s.strong} ${s.halo}`}
            >
              −{loss}% → +{pct(gain)}
            </text>
          </Svg>
        )
      }}
    </Figure>
  )
}
