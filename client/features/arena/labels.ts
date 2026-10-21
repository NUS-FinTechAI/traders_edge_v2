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

export const STRATEGIES: { id: StrategyId; label: string }[] = [
  { id: 'trend', label: 'Ride the trend' },
  { id: 'dip', label: 'Buy the dip' },
  { id: 'breakout', label: 'Catch the breakout' },
  { id: 'news', label: 'Trade the news' },
  { id: 'hold', label: 'Hold steady' },
  { id: 'cautious', label: 'Play it safe' },
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
