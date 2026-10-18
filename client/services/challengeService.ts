import { api, type ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import { apiEnums } from '../api/api-enums.ts'
import { HttpError } from './httpService.ts'

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

export function parseChallenge(data: Challenge): Challenge {
  const { player, result } = data
  const symbols = new Set(player.quotes.map((quote) => quote.symbol))
  const participants = new Set([
    'human',
    ...data.opponents.map((opponent) => opponent.id),
  ])
  if (
    player.tick >= player.total_ticks ||
    data.policy.ticks !== player.total_ticks ||
    player.finished !== (data.status !== 'active') ||
    participants.size !== data.opponents.length + 1 ||
    data.opponents.some((opponent) => opponent.tick !== player.tick) ||
    (data.status === 'completed' ? result === null : result !== null) ||
    symbols.size !== player.quotes.length ||
    player.quotes.some(
      (quote) => player.history[quote.symbol]?.length !== player.tick + 1,
    ) ||
    Object.values(player.history).some(
      (prices) => prices.length !== player.tick + 1,
    ) ||
    new Set(player.orders.map((order) => order.id)).size !==
      player.orders.length ||
    new Set(player.positions.map((position) => position.symbol)).size !==
      player.positions.length ||
    player.orders.some(
      (order) => order.filled + order.remaining !== order.quantity,
    ) ||
    [...player.positions, ...player.orders].some(
      (item) => !symbols.has(item.symbol),
    )
  )
    return invalid()
  if (
    result &&
    (result.attempt_id !== data.id ||
      result.mode !== data.mode ||
      result.module_id !== data.module_id ||
      result.challenge_id !== data.challenge_id ||
      result.attempt_number !== data.attempt_number ||
      result.final_tick !== player.total_ticks - 1 ||
      player.tick !== result.final_tick ||
      result.leaderboard.length !== participants.size ||
      new Set(result.leaderboard.map((entry) => entry.participant_id)).size !==
        result.leaderboard.length ||
      result.leaderboard.some(
        (entry) => !participants.has(entry.participant_id),
      ) ||
      result.leaderboard.find((entry) => entry.participant_id === 'human')
        ?.profit !== result.profit)
  )
    return invalid()
  return structuredClone(data)
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
