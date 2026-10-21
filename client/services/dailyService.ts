import httpService from './httpService.ts'
import type { components } from '../api/api-types.ts'

type Schemas = components['schemas']

export type Opponent = Schemas['Opponent']

export type Daily = Schemas['Daily']

export type PracticeScenario = Schemas['PracticeScenario']

export type BossEntry = Schemas['BossEntry']

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
