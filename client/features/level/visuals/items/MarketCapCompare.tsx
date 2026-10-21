import { useState } from 'react'
import Button from '../../../../ui/Button.tsx'
import { formatCount, formatMoney } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { C } from '../shared/theme.ts'
import { Figure, Note, Stat, Svg } from '../shared/ui.tsx'

const COMPANIES = [
  { id: 'orchard', name: 'Orchard Foods', price: 320, shares: 2_500_000 },
  { id: 'kestrel', name: 'Kestrel Air', price: 24, shares: 75_000_000 },
] as const

type Id = (typeof COMPANIES)[number]['id']

const cap = (c: (typeof COMPANIES)[number]) => c.price * c.shares
const capText = (value: number) =>
  value >= 1e9
    ? `$${(value / 1e9).toFixed(2)}B`
    : `$${Math.round(value / 1e6)}M`
const sharesText = (value: number) => `${formatCount(value / 1e6)}M`

export default function MarketCapCompare() {
  const [guess, setGuess] = useState<Id | null>(null)
  const revealed = guess !== null
  const bigger = COMPANIES.reduce((a, b) => (cap(a) >= cap(b) ? a : b))
  const maxValue = Math.max(
    ...COMPANIES.map((c) => (revealed ? cap(c) : c.price)),
  )

  return (
    <Figure
      caption={
        revealed
          ? 'Market cap = share price × number of shares.'
          : 'Which company is bigger? Look at the share prices, then guess.'
      }
      readout={
        revealed ? (
          <>
            <Stat
              label="Your guess"
              value={guess === bigger.id ? '✓ Right' : '✗ Not quite'}
              color={guess === bigger.id ? C.gain : C.loss}
            />
            <Note>
              {bigger.name} is bigger: {capText(cap(bigger))} vs{' '}
              {capText(Math.min(...COMPANIES.map(cap)))}. A high share price
              does not mean a big company.
            </Note>
          </>
        ) : (
          <Note>Showing share prices only.</Note>
        )
      }
      controls={
        revealed ? (
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => setGuess(null)}
          >
            Show share prices again
          </Button>
        ) : (
          COMPANIES.map((company) => (
            <Button
              key={company.id}
              variant="secondary"
              onClick={() => setGuess(company.id)}
            >
              {company.name} is bigger
            </Button>
          ))
        )
      }
    >
      {(width) => {
        const labelW = 108
        const x0 = labelW
        const x1 = width - 8
        const rowH = 62
        const height = 28 + rowH * COMPANIES.length
        return (
          <Svg
            width={width}
            height={height}
            label={COMPANIES.map((c) =>
              revealed
                ? `${c.name}: ${formatMoney(c.price, true)} × ${sharesText(c.shares)} shares = ${capText(cap(c))}`
                : `${c.name}: share price ${formatMoney(c.price, true)}`,
            ).join('. ')}
          >
            <text x={0} y={14} className={`${s.word} ${s.strong}`}>
              {revealed ? 'Market cap' : 'Share price'}
            </text>
            {COMPANIES.map((company, i) => {
              const value = revealed ? cap(company) : company.price
              const barW = Math.max(4, ((x1 - x0) * value) / maxValue)
              const y = 28 + i * rowH
              const isBig = revealed && company.id === bigger.id
              return (
                <g key={company.id}>
                  <text x={0} y={y + 20} className={`${s.word} ${s.strong}`}>
                    {company.name}
                  </text>
                  <text x={0} y={y + 38} className={s.small}>
                    {revealed
                      ? `${formatMoney(company.price, true)} × ${sharesText(company.shares)}`
                      : `${sharesText(company.shares)} shares`}
                  </text>
                  <rect
                    className={s.ease}
                    x={x0}
                    y={y + 6}
                    width={barW}
                    height={34}
                    rx={4}
                    style={{
                      fill: isBig ? C.gold : revealed ? C.surface3 : C.info,
                      stroke: revealed ? C.borderStrong : 'none',
                    }}
                  />
                  <text
                    x={barW > 90 ? x0 + barW - 8 : x0 + barW + 6}
                    y={y + 28}
                    textAnchor={barW > 90 ? 'end' : 'start'}
                    className={s.strong}
                    style={{ fill: barW > 90 && !revealed ? C.bg : undefined }}
                  >
                    {revealed ? capText(value) : formatMoney(value, true)}
                    {isBig ? ' ★' : ''}
                  </text>
                </g>
              )
            })}
          </Svg>
        )
      }}
    </Figure>
  )
}
