import type { Player } from '../services/playerService.ts'
import { formatCount } from '../ui/format.ts'

/** A zero next-level requirement is the server's maximum-level marker. */
export function levelProgress(
  player: Pick<Player, 'xp_into_level' | 'xp_for_next_level'>,
) {
  const atMaxLevel = player.xp_for_next_level === 0
  const fraction = atMaxLevel
    ? 1
    : Math.min(1, Math.max(0, player.xp_into_level / player.xp_for_next_level))
  return {
    atMaxLevel,
    fraction,
    text: atMaxLevel
      ? 'MAX LEVEL'
      : `${formatCount(player.xp_into_level)} / ${formatCount(player.xp_for_next_level)} XP · ${Math.round(fraction * 100)}%`,
  }
}
