import type { Player, UnlockNotice } from '../services/playerService.ts'

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
