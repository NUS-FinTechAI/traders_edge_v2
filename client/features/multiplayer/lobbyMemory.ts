const KEY = 'traders-edge:lobby'

/** The lobby this browser last joined, so the hub can offer a way back. */
export function rememberedLobby(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function rememberLobby(lobbyId: string | null): void {
  try {
    if (lobbyId) localStorage.setItem(KEY, lobbyId)
    else localStorage.removeItem(KEY)
  } catch {
    // Without storage the hub simply shows no return banner.
  }
}
