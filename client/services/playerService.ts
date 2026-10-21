import httpService from './httpService.ts'
import type { components } from '../api/api-types.ts'

type Schemas = components['schemas']

export type Wallet = Schemas['Wallet']

export type Streak = Schemas['Streak']

export type Player = Schemas['Player']

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

export type Activity = Schemas['Activity']

export type CollectionItem = Schemas['CollectionItem']

export interface Badge {
  id: string
  name: string
  description: string
  earned: boolean
  earned_at: string | null
  progress: string | null
}

export type Collection = Schemas['Collection']

export type ShopItem = Schemas['ShopItem']

export type LeaderboardEntry = Schemas['RankingEntry']

export type Leaderboard = Schemas['Leaderboard']

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
