import type { Mission } from '../../services/gameService.ts'

/** Tracks server-confirmed completions without replaying them on load or polls. */
export class MissionNotifications {
  private initialized = false
  private completed = new Set<string>()

  update(missions: Mission[], trading: boolean): string | null {
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
    if (fresh.length === 1) {
      const mission = fresh[0]!
      return `${mission.tier === 'bonus' ? 'Bonus mission' : 'Mission'} complete: ${mission.text}`
    }
    const bonus = fresh.filter((mission) => mission.tier === 'bonus').length
    return `${fresh.length} missions complete: ${fresh.length - bonus} normal, ${bonus} bonus.`
  }
}
