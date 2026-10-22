import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'

type Schemas = components['schemas']

export type Wallet = Schemas['Wallet']

export type Streak = Schemas['Streak']

export type Player = Schemas['Player']

export interface PlayerUpdate {
  display_name?: string
  avatar_id?: string
  title_id?: string
  badge_id?: string | null
  leaderboard_opt_in?: boolean
}

export interface DailyLoginClaim {
  day: number
  doubloons: number
  xp: number
  already_claimed: boolean
  player: Player
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

export type LeaderboardType = 'ranked' | 'xp'

export function getMe(signal?: AbortSignal): Promise<Player> {
  return api.call(apiEndpoints.getMe, { signal })
}

export function updateMe(changes: PlayerUpdate): Promise<Player> {
  return api.call(apiEndpoints.updateMe, { body: changes })
}

export function claimDailyLogin(): Promise<DailyLoginClaim> {
  return api.call(apiEndpoints.claimDailyLogin, {})
}

export function getActivity(signal?: AbortSignal): Promise<Activity> {
  return api.call(apiEndpoints.getActivity, { signal })
}

export function getCollection(signal?: AbortSignal): Promise<Collection> {
  return api.call(apiEndpoints.getCollection, { signal })
}

export function getShop(signal?: AbortSignal): Promise<{ items: ShopItem[] }> {
  return api.call(apiEndpoints.getShop, { signal })
}

export function purchase(
  itemId: string,
): Promise<{ item_id: string; player: Player }> {
  return api.call(apiEndpoints.purchaseShopItem, { body: { item_id: itemId } })
}

export function getLeaderboard(
  board: LeaderboardType,
  signal?: AbortSignal,
): Promise<Leaderboard> {
  return api.call(
    board === 'xp'
      ? apiEndpoints.getXpLeaderboard
      : apiEndpoints.getRankedLeaderboard,
    { signal },
  )
}
