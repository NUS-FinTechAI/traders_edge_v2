import httpService from './httpService.ts'

export type NodeState = 'locked' | 'open' | 'done'

export interface Reward {
  kind: 'avatar' | 'title' | 'badge'
  id: string
  name: string
}

export interface ChapterCard {
  id: string
  number: number
  title: string
  region: string
  tagline: string
  icon: string
  /** `complete` means the chapter boss has been won. */
  state: 'locked' | 'open' | 'complete'
  unlocked_by: 'start' | 'boss' | 'gate' | null
  stars: number
  stars_total: number
  levels_done: number
  levels_total: number
  /** Offered while a chapter (2+) is locked. */
  gate: { scenario_id: string; won: boolean; attempts: number } | null
}

export interface Campaign {
  chapters: ChapterCard[]
  /** The "Continue" target. */
  next: { chapter_id: string; node_id: string; label: string } | null
}

export interface MapNode {
  id: string
  kind: 'preview' | 'level' | 'reward' | 'boss'
  title: string
  summary: string
  state: NodeState
  stars: { normal: boolean; special: boolean } | null
  objectives: string[]
  xp: number
  reward: Reward | null
  scenario_id: string | null
  best_profit: number | null
  attempts: number
  locked_reason: string | null
}

export interface ChapterMap {
  chapter: ChapterCard
  /** Path order: preview, levels (reward nodes follow their level), boss. */
  nodes: MapNode[]
}

export interface LessonCard {
  title: string
  body: string
  visual: string | null
}

export interface CheckQuestion {
  id: string
  kind: 'mc' | 'true_false'
  prompt: string
  options: { id: string; text: string }[]
}

export interface Level {
  id: string
  chapter_id: string
  number: number
  title: string
  summary: string
  objectives: string[]
  terms: { term: string; definition: string }[]
  cards: LessonCard[]
  check: CheckQuestion[]
  practice: {
    scenario_id: string
    title: string
    briefing: string
    missions: { tier: 'basic' | 'bonus'; text: string }[]
  }
  progress: {
    check_done: boolean
    check_best: number | null
    normal_star: boolean
    special_star: boolean
    plays: number
  }
}

export interface CheckAnswer {
  correct: boolean
  correct_option_id: string
  explanation: string
  first_try: boolean
}

export interface CheckComplete {
  first_try_correct: number
  total: number
  xp: number
  practice_unlocked: boolean
}

export interface ArchiveTerm {
  term: string
  definition: string
  chapter_id: string
  level_id: string
}

export function getCampaign(signal?: AbortSignal): Promise<Campaign> {
  return httpService.request<Campaign>('/api/campaign', { signal })
}

export function getChapterMap(
  chapterId: string,
  signal?: AbortSignal,
): Promise<ChapterMap> {
  return httpService.request<ChapterMap>(
    `/api/campaign/chapters/${encodeURIComponent(chapterId)}`,
    { signal },
  )
}

export function getLevel(
  levelId: string,
  signal?: AbortSignal,
): Promise<Level> {
  return httpService.request<Level>(
    `/api/campaign/levels/${encodeURIComponent(levelId)}`,
    { signal },
  )
}

export function checkAnswer(
  levelId: string,
  questionId: string,
  optionId: string,
): Promise<CheckAnswer> {
  return httpService.request<CheckAnswer>(
    `/api/campaign/levels/${encodeURIComponent(levelId)}/check`,
    { method: 'POST', body: { question_id: questionId, option_id: optionId } },
  )
}

export function completeCheck(levelId: string): Promise<CheckComplete> {
  return httpService.request<CheckComplete>(
    `/api/campaign/levels/${encodeURIComponent(levelId)}/check/complete`,
    { method: 'POST', body: {} },
  )
}

/** Every term the player can look up in the Trading Archive. */
export function getArchive(
  signal?: AbortSignal,
): Promise<{ terms: ArchiveTerm[] }> {
  return httpService.request<{ terms: ArchiveTerm[] }>('/api/archive', {
    signal,
  })
}

export type CreateGame =
  | { mode: 'level'; level_id: string }
  | {
      mode: 'boss'
      chapter_id: string
      boss: 'preview' | 'gate' | 'final'
    }
  | { mode: 'daily' }
  | { mode: 'practice'; scenario_id: string }

/** Create a match in its briefing; the arena at /game/:id takes over. */
export function createGame(body: CreateGame): Promise<{ id: string }> {
  return httpService.request<{ id: string }>('/api/games', {
    method: 'POST',
    body,
  })
}
