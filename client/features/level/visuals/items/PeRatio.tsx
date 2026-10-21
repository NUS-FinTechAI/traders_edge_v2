import { useState } from 'react'
import { formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { clamp, linear } from '../shared/scale.ts'
import { C } from '../shared/theme.ts'
import { Figure, Note, Range, Stat, Svg } from '../shared/ui.tsx'

const MAX_PE = 80
const REFERENCES = [
  { name: 'Orchard Foods', tag: 'value', price: 36, eps: 3 },
  { name: 'Nimbus Cloud', tag: 'growth', price: 90, eps: 1.5 },
]

export default function PeRatio() {
  const [price, setPrice] = useState(60)
  const [eps, setEps] = useState(3)
  const pe = price / eps
  const earningsYield = (eps / price) * 100

  return (
    <Figure
      caption="P/E = share price ÷ earnings per share: how many dollars investors pay for each $1 of yearly profit."
      readout={
        <>
          <Stat
            label="P/E"
            value={`${formatMoney(price, true)} ÷ ${formatMoney(eps)} = ${pe.toFixed(1)}`}
            color={C.gold}
          />
          <Stat label="Earnings yield" value={`${earningsYield.toFixed(1)}%`} />
          <Note>
            You pay {formatMoney(pe)} for each $1 of yearly profit. A high P/E
            means investors expect fast growth; it is not automatically
            "expensive", and a low P/E is not automatically a bargain.
          </Note>
        </>
      }
      controls={
        <>
          <Range
            label="Share price"
            min={10}
            max={150}
            step={1}
            value={price}
            display={formatMoney(price, true)}
            onChange={setPrice}
          />
          <Range
            label="EPS (yearly profit per share)"
            min={0.5}
            max={6}
            step={0.1}
            value={eps}
            display={formatMoney(eps)}
            onChange={setEps}
          />
        </>
      }
    >
      {(width) => {
        const height = 150
        const x0 = 10
        const x1 = width - 14
        const x = linear([0, MAX_PE], [x0, x1])
        const axisY = 78
        const px = x(clamp(pe, 0, MAX_PE))
        return (
          <Svg
            width={width}
            height={height}
            label={`P/E scale from 0 to ${MAX_PE}. Your stock: ${pe.toFixed(1)}. Orchard Foods (value) 12; Nimbus Cloud (growth) 60.`}
          >
            <rect
              x={x(0)}
              y={axisY - 10}
              width={x(15) - x(0)}
              height={20}
              style={{ fill: C.infoSoft }}
            />
            <rect
              x={x(30)}
              y={axisY - 10}
              width={x(MAX_PE) - x(30)}
              height={20}
              style={{ fill: C.gemSoft }}
            />
            <text x={x(0) + 4} y={axisY + 4} className={`${s.small} ${s.word}`}>
              value
            </text>
            <text
              x={x(MAX_PE) - 4}
              y={axisY + 4}
              textAnchor="end"
              className={`${s.small} ${s.word}`}
            >
              growth
            </text>
            <line
              x1={x0}
              x2={x1}
              y1={axisY + 10}
              y2={axisY + 10}
              style={{ stroke: C.borderStrong }}
            />
            {[0, 20, 40, 60, 80].map((v) => (
              <text
                key={v}
                x={x(v)}
                y={axisY + 26}
                textAnchor="middle"
                className={s.small}
                aria-hidden="true"
              >
                {v === MAX_PE ? '80+' : v}
              </text>
            ))}
            {REFERENCES.map((ref) => {
              const rx = x(ref.price / ref.eps)
              return (
                <g key={ref.name}>
                  <line
                    x1={rx}
                    x2={rx}
                    y1={axisY - 30}
                    y2={axisY - 10}
                    style={{ stroke: C.muted }}
                  />
                  <text
                    x={rx}
                    y={axisY - 48}
                    textAnchor="middle"
                    className={`${s.small} ${s.word}`}
                  >
                    {ref.name}
                  </text>
                  <text
                    x={rx}
                    y={axisY - 34}
                    textAnchor="middle"
                    className={s.small}
                  >
                    P/E {(ref.price / ref.eps).toFixed(0)}
                  </text>
                </g>
              )
            })}
            <path
              d={`M${px},${axisY + 32}l-7,12h14z`}
              style={{ fill: C.gold }}
            />
            <text
              x={clamp(px, x0 + 40, x1 - 40)}
              y={axisY + 60}
              textAnchor="middle"
              className={s.strong}
              style={{ fill: C.gold }}
            >
              Yours {pe > MAX_PE ? `${pe.toFixed(0)} ▶` : pe.toFixed(1)}
            </text>
          </Svg>
        )
      }}
    </Figure>
  )
}
