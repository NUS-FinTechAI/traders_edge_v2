import type { Mission } from '../../services/gameService.ts'

interface MissionNotice {
  message: string
  normal: boolean
  bonus: boolean
}

/** Tracks server-confirmed completions without replaying them on load or polls. */
export class MissionNotifications {
  private initialized = false
  private completed = new Set<string>()

  update(missions: Mission[], trading: boolean): MissionNotice | null {
    const fresh = missions.filter(
      (mission) =>
        mission.done &&
        mission.state === 'done' &&
        !this.completed.has(mission.id),
    )
    for (const mission of fresh) this.completed.add(mission.id)
    const announce = this.initialized && trading
    this.initialized = true
    if (!announce || !fresh.length) return null
    const bonus = fresh.filter((mission) => mission.tier === 'bonus').length
    const icons = { normal: bonus < fresh.length, bonus: bonus > 0 }
    if (fresh.length === 1) {
      const mission = fresh[0]!
      return {
        ...icons,
        message: `${mission.tier === 'bonus' ? 'Bonus mission' : 'Mission'} complete: ${mission.text}`,
      }
    }
    return {
      ...icons,
      message: `${fresh.length} missions complete: ${fresh.length - bonus} normal, ${bonus} bonus.`,
    }
  }
}
