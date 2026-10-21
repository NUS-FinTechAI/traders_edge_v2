import type {
  BotTier,
  GameMode,
  StrategyId,
  Tone,
} from '../../services/gameService.ts'

export const MODE_LABEL: Record<GameMode, string> = {
  level: 'Lesson practice',
  boss: 'Boss',
  daily: 'Daily',
  practice: 'Practice',
  private: 'Multiplayer',
  ranked: 'Multiplayer',
}

export const TIER_LABEL: Record<BotTier, string> = {
  rookie: 'Rookie',
  pro: 'Pro',
  elite: 'Elite',
}

export const STRATEGIES: { id: StrategyId; label: string; hint: string }[] = [
  { id: 'trend', label: 'Ride the trend', hint: 'Buy what keeps rising' },
  { id: 'dip', label: 'Buy the dip', hint: 'Buy after a drop' },
  {
    id: 'breakout',
    label: 'Catch the breakout',
    hint: 'Buy when price breaks a level',
  },
  { id: 'news', label: 'Trade the news', hint: 'Act on headlines' },
  { id: 'hold', label: 'Hold steady', hint: 'Buy early, trade little' },
  { id: 'cautious', label: 'Play it safe', hint: 'Small positions, tight stops' },
]

const BOSS_LABEL: Record<string, string> = {
  preview: 'Preview battle',
  gate: 'Gate boss',
  final: 'Chapter boss',
}

export function modeLabel(mode: string, boss?: string | null): string {
  if (mode === 'boss' && boss) return BOSS_LABEL[boss] ?? 'Boss'
  return MODE_LABEL[mode as GameMode] ?? 'Match'
}

export const MAX_LOSS = [5, 10, 20] as const

export function strategyLabel(id: string): string {
  return STRATEGIES.find((s) => s.id === id)?.label ?? id
}

export const TONE_LABEL: Record<Tone, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
}
