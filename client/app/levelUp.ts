interface LevelProfile {
  id: string
  level: number
}

export interface LevelUpState {
  id: string | null
  level: number
  celebration: number | null
}

/** A new identity establishes a baseline; only earned increases open the modal. */
export function observeLevel(
  previous: LevelUpState,
  player: LevelProfile | null,
): LevelUpState {
  if (previous.id !== (player?.id ?? null)) {
    return {
      id: player?.id ?? null,
      level: player?.level ?? 0,
      celebration: null,
    }
  }
  if (player && player.level > previous.level) {
    return { id: player.id, level: player.level, celebration: player.level }
  }
  return previous
}
