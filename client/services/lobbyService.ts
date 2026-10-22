import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'

type Schemas = components['schemas']

export type LobbyScenario = Schemas['LobbyScenarioDetail']

export type Lobby = Schemas['Lobby']

export type Match = Schemas['Match']

export function getLobbyScenarios(
  signal?: AbortSignal,
): Promise<{ scenarios: LobbyScenario[] }> {
  return api.call(apiEndpoints.getLobbyScenarios, { signal })
}

export function createLobby(body: {
  scenario_id?: string
  bots: number
}): Promise<Lobby> {
  return api.call(apiEndpoints.createLobby, { body })
}

export function joinLobby(code: string): Promise<Lobby> {
  return api.call(apiEndpoints.joinLobby, { body: { code } })
}

export function getLobby(
  lobbyId: string,
  signal?: AbortSignal,
): Promise<Lobby> {
  return api.call(apiEndpoints.getLobby, {
    path: { lobby_id: lobbyId },
    signal,
  })
}

export function startLobby(lobbyId: string): Promise<Lobby> {
  return api.call(apiEndpoints.startLobby, { path: { lobby_id: lobbyId } })
}

export async function leaveLobby(lobbyId: string): Promise<void> {
  await api.call(apiEndpoints.leaveLobby, { path: { lobby_id: lobbyId } })
}

export function joinMatchmaking(): Promise<Match> {
  return api.call(apiEndpoints.joinMatchmaking, {})
}

export function getMatchmaking(signal?: AbortSignal): Promise<Match> {
  return api.call(apiEndpoints.getMatchmaking, { signal })
}

export async function leaveMatchmaking(): Promise<void> {
  await api.call(apiEndpoints.leaveMatchmaking)
}

/** Join codes: up to six upper-case letters and digits. */
export function normalizeCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}
