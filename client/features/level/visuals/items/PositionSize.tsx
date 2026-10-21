import { useState } from 'react'
import { formatCount, formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { C } from '../shared/theme.ts'
import { positionSize } from '../shared/trading.ts'
import { Figure, Note, Stat, Svg } from '../shared/ui.tsx'

type Key = 'account' | 'risk' | 'entry' | 'stop'

const FIELDS: { key: Key; label: string; step: string }[] = [
  { key: 'account', label: 'Account ($)', step: '100' },
  { key: 'risk', label: 'Risk per trade (%)', step: '0.25' },
  { key: 'entry', label: 'Entry price ($)', step: '0.1' },
  { key: 'stop', label: 'Stop price ($)', step: '0.1' },
]

export default function PositionSize() {
  const [values, setValues] = useState<Record<Key, string>>({
    account: '10000',
    risk: '1',
    entry: '50',
    stop: '48',
  })
  const n = (key: Key) => Number(values[key])
  const result = positionSize(n('account'), n('risk'), n('entry'), n('stop'))
  const account = n('account')

  let error = ''
  if (!(account > 0)) error = 'Enter an account size above $0.'
  else if (!(n('risk') > 0) || n('risk') > 100)
    error = 'Enter a risk between 0% and 100%.'
  else if (!(n('entry') > 0)) error = 'Enter an entry price above $0.'
  else if (!(n('stop') < n('entry')) || !(n('stop') >= 0))
    error = 'For a buy, the stop must be below the entry.'

  return (
    <Figure
      caption="Shares = (account × risk %) ÷ (entry − stop). Position size and risk are not the same thing."
      readout={
        result && !error ? (
          <>
            <Stat
              label="Shares"
              value={formatCount(result.shares)}
              color={C.gold}
            />
            <Stat label="Position" value={formatMoney(result.value, true)} />
            <Stat
              label="Risk if stopped"
              value={`▼ ${formatMoney(result.risk)}`}
              color={C.loss}
            />
            <Note>
              {result.cappedByCash
                ? `Capped by cash: you can only afford ${formatCount(result.shares)} shares, so you risk less than planned.`
                : `(${formatMoney(account, true)} × ${n('risk')}%) ÷ (${formatMoney(n('entry'))} − ${formatMoney(n('stop'))}) = ${formatMoney(result.riskBudget)} ÷ ${formatMoney(result.riskPerShare)} = ${formatCount(result.shares)} shares, rounded down.`}
            </Note>
          </>
        ) : (
          <Note>
            <span className={s.error}>⚠ {error}</span>
          </Note>
        )
      }
      controls={
        <div className={s.fields}>
          {FIELDS.map((field) => (
            <label key={field.key} className={s.field}>
              {field.label}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step={field.step}
                value={values[field.key]}
                onChange={(event) =>
                  setValues({ ...values, [field.key]: event.target.value })
                }
              />
            </label>
          ))}
        </div>
      }
    >
      {(width) => {
        const height = 132
        const x0 = 0
        const x1 = width
        const full = x1 - x0
        const ok = result && !error
        const valuePct = ok ? Math.min(1, result.value / account) : 0
        const riskPct = ok ? Math.min(1, result.risk / account) : 0
        const bar = (
          y: number,
          label: string,
          pct: number,
          color: string,
          soft: string,
          text: string,
        ) => (
          <g>
            <text x={x0} y={y - 6} className={s.word}>
              {label}
            </text>
            <rect
              x={x0}
              y={y}
              width={full}
              height={22}
              rx={4}
              style={{ fill: C.surface2, stroke: C.border }}
            />
            <rect
              x={x0}
              y={y}
              width={Math.max(pct > 0 ? 3 : 0, full * pct)}
              height={22}
              rx={4}
              style={{ fill: soft, stroke: color, strokeWidth: 1.5 }}
            />
            <text
              x={
                x0 + Math.max(full * pct, 3) + 6 > x1 - 150
                  ? x1 - 6
                  : x0 + Math.max(full * pct, 3) + 6
              }
              y={y + 15}
              textAnchor={
                x0 + Math.max(full * pct, 3) + 6 > x1 - 150 ? 'end' : 'start'
              }
              className={`${s.strong} ${s.halo}`}
            >
              {text}
            </text>
          </g>
        )
        return (
          <Svg
            width={width}
            height={height}
            label={
              ok
                ? `Position ${formatMoney(result.value, true)} is ${Math.round(valuePct * 100)}% of the account; money at risk ${formatMoney(result.risk)} is ${(riskPct * 100).toFixed(1)}%.`
                : 'Position size bars, waiting for valid inputs.'
            }
          >
            {bar(
              22,
              'Position value (share of account)',
              valuePct,
              C.info,
              C.infoSoft,
              ok
                ? `${formatMoney(result.value, true)} · ${Math.round(valuePct * 100)}%`
                : '—',
            )}
            {bar(
              84,
              'Money at risk if the stop is hit',
              riskPct,
              C.loss,
              C.lossSoft,
              ok
                ? `${formatMoney(result.risk)} · ${(riskPct * 100).toFixed(1)}%`
                : '—',
            )}
          </Svg>
        )
      }}
    </Figure>
  )
}
