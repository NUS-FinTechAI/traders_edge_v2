import type { GameResult } from '../../services/gameService.ts'

export interface RewardToast {
  /** One key per reward and game, so the same reward never toasts twice. */
  key: string
  kind: string
  id: string
  name: string
  image: string | null
  heading: string
}

export interface SeenStore {
  read: () => string[]
  write: (keys: string[]) => void
}

const HEADINGS: Record<string, string> = {
  badge: 'New badge unlocked',
  title: 'New title unlocked',
  avatar: 'New avatar unlocked',
  theme: 'New theme unlocked',
}

const REMEMBERED = 100
const STORAGE_KEY = 'te.rewardToasts'

export function rewardHeading(kind: string): string {
  return HEADINGS[kind] ?? 'New reward unlocked'
}

/** Cosmetic rewards from one finished game, each keyed by game and reward. */
export function rewardToasts(
  gameId: string,
  rewards: Pick<GameResult['rewards'], 'badges' | 'items'>,
): RewardToast[] {
  const items = rewards.items.map((item) => ({
    kind: item.kind,
    id: item.id,
    name: item.name,
    image: item.image ?? null,
  }))
  const badges = rewards.badges.map((badge) => ({
    kind: 'badge',
    id: badge.id,
    name: badge.name,
    image: null,
  }))
  return [...items, ...badges].map((reward) => ({
    ...reward,
    key: `${gameId}:${reward.kind}:${reward.id}`,
    heading: rewardHeading(reward.kind),
  }))
}

/** The toasts not yet shown, recording them so a reload stays quiet. */
export function takeUnseen(
  toasts: RewardToast[],
  store: SeenStore,
): RewardToast[] {
  const seen = new Set(store.read())
  const fresh = toasts.filter((toast) => !seen.has(toast.key))
  if (fresh.length) {
    store.write(
      [...seen, ...fresh.map((toast) => toast.key)].slice(-REMEMBERED),
    )
  }
  return fresh
}

/** Remembers shown rewards across reloads; works without storage. */
export const browserSeenStore: SeenStore = {
  read() {
    try {
      const parsed: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? '[]',
      )
      return Array.isArray(parsed)
        ? parsed.filter((key): key is string => typeof key === 'string')
        : []
    } catch {
      return []
    }
  },
  write(keys) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
    } catch {
      // Storage is unavailable; the toast may repeat after a reload.
    }
  },
}
