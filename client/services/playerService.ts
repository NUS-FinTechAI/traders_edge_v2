import httpService from './httpService.ts'

export interface Wallet {
  doubloons: number
  doubloons_week_ends_at: string
  gems: number
}

export interface Streak {
  days: number
  claimed_today: boolean
  /** Position in the current 7-day reward cycle, 1–7. */
  cycle_day: number
}

export interface Player {
  id: string
  display_name: string
  avatar_id: string
  title: string
  level: number
  rank_name: string
  xp: number
  xp_into_level: number
  xp_for_next_level: number
  wallet: Wallet
  streak: Streak
  unlocks: { daily: boolean; ranked: boolean }
  leaderboard_opt_in: boolean
}

export function getMe(signal?: AbortSignal): Promise<Player> {
  return httpService.request<Player>('/api/me', { signal })
}
