import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
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
  return api.call(apiEndpoints.getCampaign, { signal })
}

export function getChapterMap(
  chapterId: string,
  signal?: AbortSignal,
): Promise<ChapterMap> {
  return api.call(apiEndpoints.getChapterMap, {
    path: { chapter_id: chapterId },
    signal,
  })
}

export function getLevel(
  levelId: string,
  signal?: AbortSignal,
): Promise<Level> {
  return api.call(apiEndpoints.getLevel, {
    path: { level_id: levelId },
    signal,
  })
}

export function checkAnswer(
  levelId: string,
  questionId: string,
  optionId: string,
): Promise<CheckAnswer> {
  return api.call(apiEndpoints.answerCheck, {
    path: { level_id: levelId },
    body: { question_id: questionId, option_id: optionId },
  })
}

export function completeCheck(levelId: string): Promise<CheckComplete> {
  return api.call(apiEndpoints.completeCheck, { path: { level_id: levelId } })
}

/** Every term the player can look up in the Trading Archive. */
export function getArchive(
  signal?: AbortSignal,
): Promise<{ terms: ArchiveTerm[] }> {
  return api.call(apiEndpoints.getArchive, { signal })
}

export type CreateGame = Schemas['CreateGame']

/** Create a match in its briefing; the arena at /game/:id takes over. */
export function createGame(body: CreateGame): Promise<{ id: string }> {
  return api.call(apiEndpoints.createGame, { body })
}
