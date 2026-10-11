import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import { HttpError } from './httpService.ts'

export type AdventureChapter = components['schemas']['AdventureChapter']
export type ModuleMap = components['schemas']['ModuleMap']
export type LevelProgress = components['schemas']['LevelProgress']
export type LevelBriefing = components['schemas']['LevelBriefing']
export type BossAvailability = components['schemas']['BossAvailability']
export type PublicAdventureChapter =
  components['schemas']['PublicAdventureChapter']

export function loadAdventure(signal: AbortSignal) {
  return api.call(apiEndpoints.getAdventure, { signal })
}

export async function loadChapter(moduleId: string, signal: AbortSignal) {
  const [overview, map] = await Promise.all([
    loadAdventure(signal),
    api.call(apiEndpoints.getModuleMap, {
      path: { module_id: moduleId },
      signal,
    }),
  ])
  const chapter = overview.chapters.find((item) => item.module_id === moduleId)
  if (!chapter) throw new HttpError('Chapter not found', 'http', 404)
  return { chapter, map, chapters: overview.chapters }
}

export function loadLevel(levelId: string, signal: AbortSignal) {
  return api.call(apiEndpoints.getLevel, {
    path: { level_id: levelId },
    signal,
  })
}

export function adventureError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401)
      return 'Your session has expired. Sign in again to see your progress.'
    if (error.status === 403)
      return 'This content is not available to your profile.'
    if (error.status === 404) return 'This chapter or level could not be found.'
    if (error.status === 503)
      return 'Learning content is awaiting publication review. Please try again later.'
  }
  return 'Your progress could not be loaded. Check your connection and try again.'
}

export function levelLockReason(
  map: ModuleMap,
  level: LevelProgress,
): string | null {
  if (level.unlocked) return null
  if (!map.unlocked)
    return 'Unlock this chapter through earlier chapter checks or its entry boss.'
  if (map.diagnostic.required && !map.diagnostic.completed)
    return 'Complete the introductory assessment first. Incorrect answers do not block learning.'
  const index = map.levels.findIndex((item) => item.id === level.id)
  const previous = map.levels
    .slice(0, index)
    .filter((item) => !item.standard_star)
  return previous.length
    ? `Complete the required missions in ${previous.map((item) => item.title).join(', ')} first.`
    : 'This level is currently locked. Refresh the chapter to check its prerequisites.'
}

export function bossStatus(boss: BossAvailability, passed: boolean): string {
  if (passed) return 'Defeated'
  if (boss.active_attempt_ids.length) return 'Attempt in progress'
  if (boss.available) return 'Available'
  switch (boss.reason) {
    case 'introductory_diagnostic':
      return 'Introductory assessment instead'
    case 'chapter_locked':
      return 'Unlock this chapter first'
    case 'required_levels_incomplete':
      return 'Complete all required levels first'
    case 'diagnostic_incomplete':
      return 'Complete the introductory assessment first'
    case 'active_challenge_limit':
      return 'Three challenges already in progress'
    default:
      return 'Not available'
  }
}

export function loadPublicAdventure(signal: AbortSignal) {
  return api.call(apiEndpoints.getPublicAdventure, { signal })
}
