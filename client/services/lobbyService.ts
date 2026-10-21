import httpService from './httpService.ts'
import type { components } from '../api/api-types.ts'

type Schemas = components['schemas']

export type LobbyScenario = Schemas['LobbyScenarioDetail']

export type Lobby = Schemas['Lobby']

export type Match = Schemas['Match']

export function getLobbyScenarios(
  signal?: AbortSignal,
): Promise<{ scenarios: LobbyScenario[] }> {
  return httpService.request<{ scenarios: LobbyScenario[] }>(
    '/api/lobbies/scenarios',
    { signal },
  )
}

export function createLobby(body: {
  scenario_id?: string
  bots: number
}): Promise<Lobby> {
  return httpService.request<Lobby>('/api/lobbies', { method: 'POST', body })
}

export function joinLobby(code: string): Promise<Lobby> {
  return httpService.request<Lobby>('/api/lobbies/join', {
    method: 'POST',
    body: { code },
  })
}

export function getLobby(
  lobbyId: string,
  signal?: AbortSignal,
): Promise<Lobby> {
  return httpService.request<Lobby>(
    `/api/lobbies/${encodeURIComponent(lobbyId)}`,
    { signal },
  )
}

export function startLobby(lobbyId: string): Promise<Lobby> {
  return httpService.request<Lobby>(
    `/api/lobbies/${encodeURIComponent(lobbyId)}/start`,
    { method: 'POST', body: {} },
  )
}

export async function leaveLobby(lobbyId: string): Promise<void> {
  await httpService.request(
    `/api/lobbies/${encodeURIComponent(lobbyId)}/leave`,
    { method: 'POST', body: {} },
  )
}

export function joinMatchmaking(): Promise<Match> {
  return httpService.request<Match>('/api/matchmaking', {
    method: 'POST',
    body: {},
  })
}

export function getMatchmaking(signal?: AbortSignal): Promise<Match> {
  return httpService.request<Match>('/api/matchmaking', { signal })
}

export async function leaveMatchmaking(): Promise<void> {
  await httpService.request('/api/matchmaking', { method: 'DELETE' })
}

/** Join codes: up to six upper-case letters and digits. */
export function normalizeCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}
