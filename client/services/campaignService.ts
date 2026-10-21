import httpService from './httpService.ts'
import type { components } from '../api/api-types.ts'

type Schemas = components['schemas']

export type Reward = Schemas['Reward']

export type ChapterCard = Schemas['ChapterCard']

export type Campaign = Schemas['Campaign']

export type MapNode = Schemas['MapNode']

export type ChapterMap = Schemas['ChapterMap']

export type CheckQuestion = Schemas['CheckQuestion']

export type Level = Schemas['Level']

export type CheckAnswer = Schemas['CheckAnswer']

export type CheckComplete = Schemas['CheckComplete']

export type ArchiveTerm = Schemas['ArchiveTerm']

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
