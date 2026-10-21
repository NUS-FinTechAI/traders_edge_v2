import { useState } from 'react'
import {
  formatMoney,
  formatSignedMoney,
  formatSignedPct,
} from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { arrow, C, signColor } from '../shared/theme.ts'
import { portfolioAfterCrash } from '../shared/trading.ts'
import { Figure, Note, Segmented, Stat, Svg, Toggle } from '../shared/ui.tsx'

const TOTAL = 10_000
const CRASH = 40
const TICKERS = ['NMBC', 'ORCF', 'KSTL', 'LUMB', 'TDLP']

export default function Diversification() {
  const [count, setCount] = useState<'1' | '5'>('1')
  const [crash, setCrash] = useState(false)
  const holdings = Number(count)
  const value = crash ? portfolioAfterCrash(TOTAL, holdings, CRASH) : TOTAL
  const change = value - TOTAL
  const changePct = (change / TOTAL) * 100

  return (
    <Figure
      caption={`$10,000 in one stock or split across five. Then Nimbus Cloud (NMBC) falls ${CRASH}% on bad news.`}
      readout={
        <>
          <Stat label="Portfolio" value={formatMoney(value, true)} />
          <Stat
            label="Change"
            value={`${arrow(change)} ${formatSignedMoney(change, true)} (${formatSignedPct(changePct)})`}
            color={signColor(change)}
          />
          <Note>
            {crash
              ? holdings === 1
                ? 'All your money was in the company that fell.'
                : 'The other four holdings cushioned the hit.'
              : 'Spreading out reduces single-company risk. It does not protect you when the whole market falls.'}
          </Note>
        </>
      }
      controls={
        <>
          <Segmented
            label="Number of holdings"
            value={count}
            onChange={setCount}
            options={[
              { id: '1', label: '1 stock' },
              { id: '5', label: '5 stocks' },
            ]}
          />
          <Toggle pressed={crash} onChange={setCrash}>
            NMBC crash −{CRASH}%
          </Toggle>
        </>
      }
    >
      {(width) => {
        const height = 112
        const x0 = 0
        const full = width
        const each = full / holdings
        const top = 24
        const h = 64
        return (
          <Svg
            width={width}
            height={height}
            label={`${holdings} holding${holdings > 1 ? 's' : ''} of ${formatMoney(TOTAL / holdings, true)} each. ${crash ? `NMBC down ${CRASH}%. ` : ''}Portfolio ${formatMoney(value, true)}.`}
          >
            <text x={x0} y={14} className={`${s.small} ${s.word}`}>
              Each block is one holding, sized by the money in it
            </text>
            {Array.from({ length: holdings }, (_, i) => {
              const bx = x0 + i * each
              const hit = crash && i === 0
              const lost = hit ? (each - 4) * (CRASH / 100) : 0
              return (
                <g key={i}>
                  <rect
                    x={bx + 2}
                    y={top}
                    width={each - 4 - lost}
                    height={h}
                    rx={6}
                    style={{
                      fill: hit ? C.lossSoft : C.surface3,
                      stroke: hit ? C.loss : C.borderStrong,
                      strokeWidth: 1.5,
                    }}
                  />
                  {hit && (
                    <rect
                      x={bx + 2 + each - 4 - lost}
                      y={top}
                      width={lost}
                      height={h}
                      rx={6}
                      style={{ fill: 'none', stroke: C.loss }}
                      strokeDasharray="4 3"
                    />
                  )}
                  <text x={bx + 10} y={top + 24} className={s.strong}>
                    {TICKERS[i]}
                  </text>
                  <text x={bx + 10} y={top + 44} className={s.small}>
                    {formatMoney(
                      hit
                        ? (TOTAL / holdings) * (1 - CRASH / 100)
                        : TOTAL / holdings,
                      true,
                    )}
                  </text>
                  {hit && (
                    <text
                      x={bx + 4}
                      y={top + h + 16}
                      className={`${s.small} ${s.strong}`}
                      style={{ fill: C.loss }}
                    >
                      ▼ −{CRASH}%
                    </text>
                  )}
                </g>
              )
            })}
          </Svg>
        )
      }}
    </Figure>
  )
}
