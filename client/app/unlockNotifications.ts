import type {
  Player,
  UnlockKey,
  UnlockNotice,
} from '../services/playerService.ts'

export function mergeUnlockKeys(
  previous: UnlockKey[],
  added: UnlockKey[],
): UnlockKey[] {
  const unique = new Map(
    previous.map((item) => [
      JSON.stringify([item.category, item.item_id]),
      item,
    ]),
  )
  for (const item of added)
    unique.set(JSON.stringify([item.category, item.item_id]), item)
  return [...unique.values()]
}

export function withoutSeenUnlocks<T extends Pick<Player, 'unread_unlocks'>>(
  player: T,
  seen: UnlockKey[],
): T {
  return {
    ...player,
    unread_unlocks: (player.unread_unlocks ?? []).filter(
      (item) =>
        !seen.some(
          (key) =>
            key.category === item.category && key.item_id === item.item_id,
        ),
    ),
  }
}

/** Category and group selectors can be reused by any future unlock destination. */
export function unreadUnlocks(
  player: Pick<Player, 'unread_unlocks'> | null,
  category?: string,
  group?: string,
): UnlockNotice[] {
  return (player?.unread_unlocks ?? []).filter(
    (item) =>
      (!category || item.category === category) &&
      (!group || item.group === group),
  )
}
