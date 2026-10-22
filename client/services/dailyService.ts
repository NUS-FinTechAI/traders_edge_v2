import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'

type Schemas = components['schemas']

export type Opponent = Schemas['Opponent']

export type Daily = Schemas['Daily']

export type PracticeScenario = Schemas['PracticeScenario']

export type BossEntry = Schemas['BossEntry']

export function getDaily(signal?: AbortSignal): Promise<Daily> {
  return api.call(apiEndpoints.getDaily, { signal })
}

/** Spend Gems to skip the daily cooldown. */
export function refreshDaily(): Promise<Daily> {
  return api.call(apiEndpoints.refreshDaily, {})
}

export function getPractice(
  signal?: AbortSignal,
): Promise<{ scenarios: PracticeScenario[] }> {
  return api.call(apiEndpoints.getPracticeScenarios, { signal })
}

export function getBosses(
  signal?: AbortSignal,
): Promise<{ bosses: BossEntry[] }> {
  return api.call(apiEndpoints.getBosses, { signal })
}

/** True while a loss cooldown is still running at `now`. */
export function onCooldown(daily: Daily, now = Date.now()): boolean {
  return (
    !!daily.cooldown_until && new Date(daily.cooldown_until).getTime() > now
  )
}
