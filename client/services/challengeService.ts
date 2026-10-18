import { api, type ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import { apiEnums } from '../api/api-enums.ts'
import { isEnumValue, object } from '../utilities/typeUtils.ts'
import { HttpError } from './httpService.ts'
import { parseSimulationObservation } from './lessonSimulationService.ts'

export type Challenge = components['schemas']['ChallengeResponse']
export type ChallengeStart = Omit<
  components['schemas']['CreateChallenge'],
  'idempotency_key'
>
export type ChallengeOrder = components['schemas']['OrderInput']
export type ChallengeAction =
  | { kind: 'start'; input: ChallengeStart }
  | { kind: 'order'; attemptId: string; order: ChallengeOrder }
  | { kind: 'cancel'; attemptId: string; orderId: string }
  | { kind: 'advance'; attemptId: string; steps: number }
  | { kind: 'complete'; attemptId: string; reflection: string }
  | { kind: 'abandon'; attemptId: string }
export type ChallengeCommand = ChallengeAction & { key: string }

function invalid(): never {
  throw new HttpError(
    'The server returned an invalid challenge.',
    'invalid-response',
  )
}

export function parseChallenge(data: unknown): Challenge {
  try {
    const value = object(data) as Challenge
    const { player, result } = value
    if (
      typeof value.id !== 'string' ||
      !value.id ||
      typeof value.challenge_id !== 'string' ||
      !value.challenge_id ||
      typeof value.version !== 'string' ||
      !value.version ||
      !Number.isSafeInteger(value.attempt_number) ||
      value.attempt_number < 1 ||
      (value.module_id !== null &&
        (typeof value.module_id !== 'string' || !value.module_id)) ||
      !isEnumValue(apiEnums.ChallengeType, value.mode) ||
      !isEnumValue(apiEnums.ChallengeStatus, value.status) ||
      !Number.isSafeInteger(player.tick) ||
      player.tick < 0 ||
      !Number.isSafeInteger(player.total_ticks) ||
      player.total_ticks < 2 ||
      player.tick >= player.total_ticks ||
      value.policy.ticks !== player.total_ticks ||
      player.finished !== (value.status !== 'active') ||
      !Array.isArray(value.opponents) ||
      !value.opponents.length ||
      new Set(value.opponents.map((opponent) => opponent.id)).size !==
        value.opponents.length ||
      value.opponents.some(
        (opponent) =>
          typeof opponent.id !== 'string' ||
          !opponent.id ||
          opponent.tick !== player.tick,
      ) ||
      (value.status === 'completed' ? !result : result !== null)
    )
      return invalid()
    parseSimulationObservation(player, player.tick)
    if (
      result &&
      (result.attempt_id !== value.id ||
        result.mode !== value.mode ||
        result.module_id !== value.module_id ||
        result.challenge_id !== value.challenge_id ||
        result.attempt_number !== value.attempt_number ||
        result.final_tick !== player.total_ticks - 1 ||
        player.tick !== result.final_tick ||
        typeof result.win !== 'boolean' ||
        !Array.isArray(result.leaderboard) ||
        result.leaderboard.length !== value.opponents.length + 1 ||
        new Set(result.leaderboard.map((entry) => entry.participant_id))
          .size !== result.leaderboard.length ||
        result.leaderboard.some(
          (entry) =>
            ![
              'human',
              ...value.opponents.map((opponent) => opponent.id),
            ].includes(entry.participant_id) ||
            !Number.isSafeInteger(entry.rank) ||
            entry.rank < 1 ||
            typeof entry.profit !== 'string' ||
            !/^-?\d+(?:\.\d+)?$/.test(entry.profit),
        ) ||
        result.leaderboard.find((entry) => entry.participant_id === 'human')
          ?.profit !== result.profit)
    )
      return invalid()
    return structuredClone(value)
  } catch {
    return invalid()
  }
}

export class ChallengeService {
  constructor(client: ApiClient = api) {
    this.client = client
  }

  private readonly client: ApiClient

  async list(signal?: AbortSignal) {
    return this.client.call(apiEndpoints.listChallenges, { signal })
  }

  async get(attemptId: string, signal?: AbortSignal) {
    const result = parseChallenge(
      await this.client.call(apiEndpoints.getChallenge, {
        path: { attempt_id: attemptId },
        signal,
      }),
    )
    if (result.id !== attemptId) return invalid()
    return result
  }

  async execute(
    command: ChallengeCommand,
    signal?: AbortSignal,
  ): Promise<Challenge> {
    const body = { idempotency_key: command.key }
    let result: Challenge
    if (command.kind === 'start') {
      result = await this.client.call(apiEndpoints.startChallenge, {
        body: { ...command.input, ...body },
        signal,
      })
    } else {
      const path = { attempt_id: command.attemptId }
      switch (command.kind) {
        case 'order':
          result = await this.client.call(apiEndpoints.submitChallengeOrder, {
            path,
            body: { ...body, order: command.order },
            signal,
          })
          break
        case 'cancel':
          result = await this.client.call(apiEndpoints.cancelChallengeOrder, {
            path: { ...path, order_id: command.orderId },
            body,
            signal,
          })
          break
        case 'advance':
          result = await this.client.call(apiEndpoints.advanceChallenge, {
            path,
            body: { ...body, steps: command.steps },
            signal,
          })
          break
        case 'complete':
          result = await this.client.call(apiEndpoints.completeChallenge, {
            path,
            body: { ...body, reflection: command.reflection },
            signal,
          })
          break
        case 'abandon':
          result = await this.client.call(apiEndpoints.abandonChallenge, {
            path,
            body,
            signal,
          })
          break
      }
    }
    const challenge = parseChallenge(result)
    const expectedStatus =
      command.kind === 'complete'
        ? apiEnums.ChallengeStatus.completed
        : command.kind === 'abandon'
          ? apiEnums.ChallengeStatus.abandoned
          : apiEnums.ChallengeStatus.active
    if (challenge.status !== expectedStatus) return invalid()
    if (command.kind === 'start') {
      if (
        challenge.mode !==
          (command.input.mode ?? apiEnums.ChallengeType.practice) ||
        challenge.module_id !== (command.input.module_id ?? null)
      )
        return invalid()
    } else if (challenge.id !== command.attemptId) return invalid()
    return challenge
  }
}

export const challengeService = new ChallengeService()
