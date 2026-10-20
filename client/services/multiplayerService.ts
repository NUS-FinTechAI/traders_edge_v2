import { api, type ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import { HttpError } from './httpService.ts'

export type MultiplayerMatch = components['schemas']['MultiplayerResponse']
export type MultiplayerOrder = components['schemas']['OrderInput']
export type MultiplayerAction =
  | { kind: 'create' }
  | { kind: 'join'; code: string }
  | { kind: 'queue' }
  | { kind: 'start'; lobbyId: string }
  | {
      kind: 'order'
      lobbyId: string
      expectedTick: number
      order: MultiplayerOrder
    }
  | { kind: 'cancel'; lobbyId: string; expectedTick: number; orderId: string }
  | { kind: 'ready'; lobbyId: string; expectedTick: number }
  | { kind: 'complete'; lobbyId: string; reflection: string }
  | { kind: 'abandon'; lobbyId: string }
export type MultiplayerCommand = MultiplayerAction & { key: string }

function invalid(): never {
  throw new HttpError(
    'The server returned an inconsistent match. Refresh before continuing.',
    'invalid-response',
  )
}

export function parseMultiplayer(
  data: MultiplayerMatch,
  owner: string,
): MultiplayerMatch {
  const ids = new Set(
    data.participants.map((participant) => participant.user_id),
  )
  const own = data.participants.find(
    (participant) => participant.user_id === owner,
  )
  if (
    !own ||
    !ids.has(data.host_id) ||
    ids.size !== data.participants.length ||
    data.policy.version !== data.version
  )
    return invalid()
  if (data.player) {
    const player = data.player
    const symbols = new Set(player.quotes.map((quote) => quote.symbol))
    if (
      player.total_ticks !== data.policy.ticks ||
      player.tick >= player.total_ticks ||
      player.finished !== own.completed ||
      symbols.size !== player.quotes.length ||
      Object.values(player.history).some(
        (prices) => prices.length !== player.tick + 1,
      ) ||
      player.quotes.some((quote) => !player.history[quote.symbol]) ||
      new Set(player.orders.map((order) => order.id)).size !==
        player.orders.length ||
      [...player.orders, ...player.positions].some(
        (item) => !symbols.has(item.symbol),
      ) ||
      player.orders.some(
        (order) => order.remaining + order.filled !== order.quantity,
      )
    )
      return invalid()
  }
  if ((data.status === 'finished') !== (data.result !== null)) return invalid()
  if (
    data.result &&
    (data.result.final_tick !== data.policy.ticks - 1 ||
      new Set(data.result.leaderboard.map((entry) => entry.user_id)).size !==
        data.result.leaderboard.length ||
      data.result.leaderboard.some((entry) => !ids.has(entry.user_id)) ||
      (data.player && data.player.tick !== data.result.final_tick))
  )
    return invalid()
  return structuredClone(data)
}

export class MultiplayerService {
  constructor(privateClient: ApiClient = api) {
    this.client = privateClient
  }
  private readonly client: ApiClient

  list(signal?: AbortSignal) {
    return this.client.call(apiEndpoints.listMultiplayerMatches, { signal })
  }
  leaderboard(signal?: AbortSignal) {
    return this.client.call(apiEndpoints.getMultiplayerLeaderboard, { signal })
  }

  async get(lobbyId: string, owner: string, signal?: AbortSignal) {
    const result = parseMultiplayer(
      await this.client.call(apiEndpoints.getMultiplayerLobby, {
        path: { lobby_id: lobbyId },
        signal,
      }),
      owner,
    )
    if (result.id !== lobbyId) return invalid()
    return result
  }

  async execute(
    command: MultiplayerCommand,
    owner: string,
  ): Promise<MultiplayerMatch> {
    const body = { idempotency_key: command.key }
    let response: MultiplayerMatch
    if (command.kind === 'create')
      response = await this.client.call(apiEndpoints.createMultiplayerLobby, {
        body,
      })
    else if (command.kind === 'join')
      response = await this.client.call(apiEndpoints.joinMultiplayerLobby, {
        body: { ...body, code: command.code },
      })
    else if (command.kind === 'queue')
      response = await this.client.call(
        apiEndpoints.joinMultiplayerMatchmaking,
        { body },
      )
    else {
      const path = { lobby_id: command.lobbyId }
      switch (command.kind) {
        case 'start':
          response = await this.client.call(
            apiEndpoints.startMultiplayerMatch,
            { path, body },
          )
          break
        case 'order':
          response = await this.client.call(
            apiEndpoints.submitMultiplayerOrder,
            {
              path,
              body: {
                ...body,
                expected_tick: command.expectedTick,
                order: command.order,
              },
            },
          )
          break
        case 'cancel':
          response = await this.client.call(
            apiEndpoints.cancelMultiplayerOrder,
            {
              path: { ...path, order_id: command.orderId },
              body: { ...body, expected_tick: command.expectedTick },
            },
          )
          break
        case 'ready':
          response = await this.client.call(apiEndpoints.markMultiplayerReady, {
            path,
            body: { ...body, expected_tick: command.expectedTick },
          })
          break
        case 'complete':
          response = await this.client.call(
            apiEndpoints.completeMultiplayerMatch,
            { path, body: { ...body, reflection: command.reflection } },
          )
          break
        case 'abandon':
          response = await this.client.call(
            apiEndpoints.abandonMultiplayerMatch,
            { path, body },
          )
          break
      }
    }
    const result = parseMultiplayer(response, owner)
    if ('lobbyId' in command && result.id !== command.lobbyId) return invalid()
    if (
      (command.kind === 'create' || command.kind === 'join') &&
      result.mode !== 'private'
    )
      return invalid()
    if (command.kind === 'queue' && result.mode !== 'public_ranked')
      return invalid()
    return result
  }
}

export const multiplayerService = new MultiplayerService()

export async function loadMultiplayerHub(
  owner: string,
  signal?: AbortSignal,
  client: ApiClient = api,
) {
  const [profile, catalog, matches, ranks] = await Promise.allSettled([
    client.call(apiEndpoints.getProfile, { signal }),
    client.call(apiEndpoints.getPublicAdventure, { signal }),
    client.call(apiEndpoints.listMultiplayerMatches, { signal }),
    client.call(apiEndpoints.getMultiplayerLeaderboard, { signal }),
  ])
  signal?.throwIfAborted()
  if (profile.status === 'rejected') throw profile.reason
  if (profile.value.id !== owner) return invalid()
  if (catalog.status === 'rejected') throw catalog.reason
  return {
    profile: profile.value,
    catalog: catalog.value,
    matches: matches.status === 'fulfilled' ? matches.value.matches : null,
    ranks: ranks.status === 'fulfilled' ? ranks.value : null,
  }
}

export function multiplayerTimestamp(value: string): Date {
  // SQLite returns the server's UTC timestamps without an offset in older reads.
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`)
}

export function multiplayerError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 409)
      return 'The match changed or this action is unavailable. Refresh and inspect the current observation before choosing another action.'
    if (error.status === 403)
      return 'Complete the required chapter learning checks before entering this mode.'
    if (error.status === 401)
      return 'Sign in again, then confirm your saved action.'
    if (error.status === 404) return 'This match or join code is unavailable.'
    if (error.status === 429)
      return 'Too many code attempts. Wait ten minutes before trying another code.'
    if (error.status === 503)
      return 'Multiplayer content is awaiting publication review.'
    if (error.status === 422 && typeof error.details === 'string')
      return error.details
  }
  return error instanceof Error && !(error instanceof HttpError)
    ? error.message
    : 'The request could not be confirmed. Confirm the saved action before making another decision.'
}
