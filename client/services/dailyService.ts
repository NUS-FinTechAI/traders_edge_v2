import httpService from './httpService.ts'
import type { NodeState } from './campaignService.ts'

export interface Opponent {
  bot_id: string
  name: string
  avatar: string
  tier: string
  style: string
}

export interface Daily {
  date: string
  unlocked: boolean
  locked_reason: string | null
  scenario: { id: string; title: string; briefing: string; ticks: number }
  opponent: Opponent
  won_today: boolean
  attempts_today: number
  cooldown_until: string | null
  refresh_cost_gems: number
  week: {
    doubloons: number
    target: number
    resets_at: string
    wins_this_week: number
  }
}

export interface PracticeScenario {
  id: string
  title: string
  briefing: string
  difficulty: number
  bots: { bot_id: string; name: string; avatar: string; tier: string }[]
}

export interface BossEntry {
  chapter_id: string
  kind: 'boss' | 'gate'
  scenario_id: string
  title: string
  state: NodeState
  won: boolean
}

export function getDaily(signal?: AbortSignal): Promise<Daily> {
  return httpService.request<Daily>('/api/daily', { signal })
}

/** Spend Gems to skip the daily cooldown. */
export function refreshDaily(): Promise<Daily> {
  return httpService.request<Daily>('/api/daily/refresh', {
    method: 'POST',
    body: {},
  })
}

export function getPractice(
  signal?: AbortSignal,
): Promise<{ scenarios: PracticeScenario[] }> {
  return httpService.request<{ scenarios: PracticeScenario[] }>(
    '/api/practice',
    { signal },
  )
}

export function getBosses(
  signal?: AbortSignal,
): Promise<{ bosses: BossEntry[] }> {
  return httpService.request<{ bosses: BossEntry[] }>('/api/bosses', {
    signal,
  })
}

/** True while a loss cooldown is still running at `now`. */
export function onCooldown(daily: Daily, now = Date.now()): boolean {
  return (
    !!daily.cooldown_until && new Date(daily.cooldown_until).getTime() > now
  )
}
