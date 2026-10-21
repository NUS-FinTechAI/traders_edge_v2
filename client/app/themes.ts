/** Candle themes sold in the shop and the free accessibility palettes. */
export interface Theme {
  id: string
  name: string
  description: string
  /** Free palettes are available to everyone; others must be owned. */
  free: boolean
  /** Custom properties set on :root while the theme is equipped. */
  vars: Record<string, string>
}

export const THEMES: Theme[] = [
  {
    id: 'theme-palette-colorblind',
    name: 'Colour-blind-safe palette',
    description: 'Blue for gains and orange for losses everywhere.',
    free: true,
    vars: {
      '--gain': '#5aa9e6',
      '--gain-soft': '#16304a',
      '--loss': '#f0a03c',
      '--loss-soft': '#3d2a12',
    },
  },
  {
    id: 'theme-palette-high-contrast',
    name: 'High-contrast palette',
    description: 'Brighter text, borders and chart colours.',
    free: true,
    vars: {
      '--text': '#ffffff',
      '--text-muted': '#e4ece4',
      '--text-dim': '#cdd8cd',
      '--border': '#7fa58f',
      '--border-strong': '#a7c7b4',
      '--border-input': '#d0e6d8',
      '--gain': '#6ff5ab',
      '--loss': '#ff9a8c',
    },
  },
  {
    id: 'theme-candles-ocean',
    name: 'Ocean candles',
    description: 'Blue rising candles and orange falling candles.',
    free: false,
    vars: { '--candle-up': '#4f9fd8', '--candle-down': '#e8893a' },
  },
  {
    id: 'theme-candles-ink',
    name: 'Ink candles',
    description: 'Parchment rising candles and ink-brown falling candles.',
    free: false,
    vars: { '--candle-up': '#e8dcc0', '--candle-down': '#a08a6c' },
  },
  {
    id: 'theme-candles-sunset',
    name: 'Sunset candles',
    description: 'Gold rising candles and plum falling candles.',
    free: false,
    vars: { '--candle-up': '#e0b654', '--candle-down': '#a993d9' },
  },
]

const ALL_VARS = [
  ...new Set(THEMES.flatMap((theme) => Object.keys(theme.vars))),
]

const storageKey = (playerId: string) => `traders-edge:theme:${playerId}`

const listeners = new Set<() => void>()
const memory = new Map<string, string | null>()

/** The theme id this player equipped on this device, if it still exists. */
export function storedTheme(playerId: string | null): string | null {
  if (!playerId) return null
  try {
    const id = localStorage.getItem(storageKey(playerId))
    return THEMES.some((theme) => theme.id === id) ? id : null
  } catch {
    return null
  }
}

export function equipTheme(playerId: string, themeId: string | null): void {
  try {
    if (themeId) localStorage.setItem(storageKey(playerId), themeId)
    else localStorage.removeItem(storageKey(playerId))
    memory.delete(playerId)
  } catch {
    // Without storage the theme still applies until the page reloads.
    memory.set(playerId, themeId)
  }
  for (const listener of listeners) listener()
}

/** Equipped theme, falling back to an in-memory choice when storage is blocked. */
export function currentTheme(playerId: string | null): string | null {
  if (playerId && memory.has(playerId)) return memory.get(playerId) ?? null
  return storedTheme(playerId)
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The custom properties to set for `themeId`; every other theme property is cleared. */
export function themeVars(
  themeId: string | null,
): Record<string, string | null> {
  const theme = THEMES.find((item) => item.id === themeId)
  return Object.fromEntries(
    ALL_VARS.map((name) => [name, theme?.vars[name] ?? null]),
  )
}
