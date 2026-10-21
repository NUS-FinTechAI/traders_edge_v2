import type { HTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from './Icon.tsx'
import {
  formatCount,
  formatSignedMoney,
  formatSignedPct,
  tone,
} from './format.ts'
import styles from './ui.module.css'

type ChipTone =
  'neutral' | 'gold' | 'gem' | 'cash' | 'flame' | 'gain' | 'loss' | 'info'

const toneClass: Record<ChipTone, string | undefined> = {
  neutral: undefined,
  gold: styles.chipGold,
  gem: styles.chipGem,
  cash: styles.chipCash,
  flame: styles.chipFlame,
  gain: styles.chipGain,
  loss: styles.chipLoss,
  info: styles.chipInfo,
}

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone
  icon?: IconName
  children: ReactNode
}

export default function Chip({
  tone = 'neutral',
  icon,
  children,
  className,
  ...props
}: ChipProps) {
  return (
    <span
      className={[styles.chip, toneClass[tone], className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </span>
  )
}

export type Currency = 'doubloons' | 'gems' | 'xp'

const currency: Record<
  Currency,
  { icon: IconName; tone: ChipTone; label: string }
> = {
  doubloons: { icon: 'coin', tone: 'gold', label: 'Doubloons' },
  gems: { icon: 'gem', tone: 'gem', label: 'Gems' },
  xp: { icon: 'bolt', tone: 'info', label: 'XP' },
}

/** Game currency amount with a distinct icon, colour and accessible name. */
export function CurrencyChip({
  kind,
  amount,
  signed,
}: {
  kind: Currency
  amount: number
  signed?: boolean
}) {
  const { icon, tone, label } = currency[kind]
  const value = `${signed && amount > 0 ? '+' : ''}${formatCount(amount)}`
  return (
    <Chip tone={tone} icon={icon} role="img" aria-label={`${value} ${label}`}>
      <span className="num" aria-hidden="true">
        {value}
      </span>
      {kind === 'xp' && <span aria-hidden="true">XP</span>}
    </Chip>
  )
}

/** Profit or loss with sign, arrow and colour, never colour alone. */
export function Delta({
  value,
  pct,
  whole,
}: {
  value?: number
  pct?: number
  whole?: boolean
}) {
  const basis = value ?? pct ?? 0
  const state = tone(basis)
  return (
    <span className={`num ${state === 'flat' ? 'muted' : state}`}>
      {state === 'gain' ? '▲ ' : state === 'loss' ? '▼ ' : ''}
      {value !== undefined && formatSignedMoney(value, whole)}
      {value !== undefined && pct !== undefined && ' '}
      {pct !== undefined &&
        (value !== undefined
          ? `(${formatSignedPct(pct)})`
          : formatSignedPct(pct))}
    </span>
  )
}
