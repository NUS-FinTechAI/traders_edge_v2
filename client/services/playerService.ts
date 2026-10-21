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

export interface PlayerUpdate {
  display_name?: string
  avatar_id?: string
  title_id?: string
  leaderboard_opt_in?: boolean
}

export interface DailyLoginClaim {
  day: number
  doubloons: number
  xp: number
  already_claimed: boolean
  player: Player
}

export interface StreakDay {
  date: string
  claimed: boolean
  xp: number
  doubloons: number
}

export interface Activity {
  days: { date: string; count: number }[]
  streak_days: number
  /** The current 7-day login cycle. */
  week: StreakDay[]
}

export interface CollectionItem {
  id: string
  name: string
  owned: boolean
  equipped: boolean
  how: string
}

export interface Badge {
  id: string
  name: string
  description: string
  earned: boolean
  earned_at: string | null
  progress: string | null
}

export interface Collection {
  badges: Badge[]
  avatars: CollectionItem[]
  titles: CollectionItem[]
  stats: {
    levels_done: number
    stars: number
    bosses_won: number
    quizzes_passed: number
    matches_played: number
    best_profit: number | null
  }
}

export interface ShopItem {
  id: string
  kind: 'avatar' | 'title' | 'theme'
  name: string
  description: string
  currency: 'stocks' | 'gems'
  price: number
  owned: boolean
  weekly: boolean
}

export interface LeaderboardEntry {
  rank: number
  name: string
  avatar_id: string
  level: number
  value: number
  tier?: string
  is_me: boolean
}

export interface Leaderboard {
  entries: LeaderboardEntry[]
  me: { rank: number | null; value: number }
}

export function getMe(signal?: AbortSignal): Promise<Player> {
  return httpService.request<Player>('/api/me', { signal })
}

export function updateMe(changes: PlayerUpdate): Promise<Player> {
  return httpService.request<Player>('/api/me', {
    method: 'PATCH',
    body: changes,
  })
}

export function claimDailyLogin(): Promise<DailyLoginClaim> {
  return httpService.request<DailyLoginClaim>('/api/me/daily-login', {
    method: 'POST',
    body: {},
  })
}

export function getActivity(signal?: AbortSignal): Promise<Activity> {
  return httpService.request<Activity>('/api/me/activity', { signal })
}

export function getCollection(signal?: AbortSignal): Promise<Collection> {
  return httpService.request<Collection>('/api/me/collection', { signal })
}

export function getShop(signal?: AbortSignal): Promise<{ items: ShopItem[] }> {
  return httpService.request<{ items: ShopItem[] }>('/api/shop', { signal })
}

export function purchase(
  itemId: string,
): Promise<{ item_id: string; player: Player }> {
  return httpService.request<{ item_id: string; player: Player }>(
    '/api/shop/purchase',
    { method: 'POST', body: { item_id: itemId } },
  )
}

export function getLeaderboard(
  board: 'xp' | 'ranked',
  signal?: AbortSignal,
): Promise<Leaderboard> {
  return httpService.request<Leaderboard>(`/api/leaderboards/${board}`, {
    signal,
  })
}
