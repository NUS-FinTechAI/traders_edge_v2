/**
 * Colour themes, stored per player on this device.
 *
 * A player combines up to three kinds, one of each:
 * - a base theme sets every colour token (free);
 * - an accessibility palette adjusts text, borders, gains and losses (free);
 * - a candle theme from the shop recolours chart candles only.
 * Later layers override earlier ones: base, then candles, then palette. A base
 * theme may `adapt` a palette or candle theme so it stays legible on that base.
 */
export type ThemeKind = 'base' | 'palette' | 'candles'

export interface Theme {
  id: string
  name: string
  description: string
  kind: ThemeKind
  /** Free themes are available to everyone; others must be owned. */
  free: boolean
  /** Custom properties set on :root while the theme is equipped. */
  vars: Record<string, string>
  /** Base themes only: values replacing a palette or candle theme's on this base. */
  adapt?: Record<string, Record<string, string>>
}

/** The base theme a player gets until they choose one. Change this line to switch the default. */
export const DEFAULT_BASE_THEME = 'night-map'

/** Colour tokens every base theme must set (candles inherit gain and loss). */
export const BASE_TOKENS = [
  'color-scheme',
  '--bg',
  '--bg-elev',
  '--surface',
  '--surface-2',
  '--surface-3',
  '--border',
  '--border-strong',
  '--border-input',
  '--text',
  '--text-muted',
  '--text-dim',
  '--primary',
  '--primary-hover',
  '--on-primary',
  '--gold',
  '--gold-soft',
  '--gold-line',
  '--on-gold',
  '--gem',
  '--gem-soft',
  '--gem-text',
  '--gem-line',
  '--cash',
  '--cash-soft',
  '--gain',
  '--gain-soft',
  '--gain-line',
  '--on-gain',
  '--loss',
  '--loss-soft',
  '--loss-line',
  '--on-loss',
  '--info',
  '--info-soft',
  '--info-line',
  '--warning',
  '--warning-soft',
  '--focus',
  '--shadow',
] as const

type BaseVars = Record<(typeof BASE_TOKENS)[number], string>

const DARK_SHADOW = '0 1px 0 #0006, 0 8px 24px #0005'
const GOLD_RING = '0 0 0 3px var(--gold)'

/** The original forest-green night map; `client/ui/tokens.css` mirrors it for first paint. */
const NIGHT_MAP: BaseVars = {
  'color-scheme': 'dark',
  '--bg': '#0d1714',
  '--bg-elev': '#12201b',
  '--surface': '#172821',
  '--surface-2': '#1e3329',
  '--surface-3': '#26402f',
  '--border': '#2c4638',
  '--border-strong': '#3e5e4c',
  '--border-input': '#6a957c',
  '--text': '#f2ead3',
  '--text-muted': '#a9b8a9',
  '--text-dim': '#98ab9c',
  '--primary': '#1f7a52',
  '--primary-hover': '#1a6b47',
  '--on-primary': '#ffffff',
  '--gold': '#e0b654',
  '--gold-soft': '#3a3220',
  '--gold-line': '#5a4b28',
  '--on-gold': '#1a1405',
  '--gem': '#8e72d6',
  '--gem-soft': '#2a2440',
  '--gem-text': '#a891ea',
  '--gem-line': '#4a3f73',
  '--cash': '#5fbf8a',
  '--cash-soft': '#1d3a2b',
  '--gain': '#46c384',
  '--gain-soft': '#173a29',
  '--gain-line': '#275a3f',
  '--on-gain': '#06210f',
  '--loss': '#f0705f',
  '--loss-soft': '#3d1f1b',
  '--loss-line': '#6a3029',
  '--on-loss': '#2a0905',
  '--info': '#5ba8c8',
  '--info-soft': '#18323d',
  '--info-line': '#2a5466',
  '--warning': '#e8a23a',
  '--warning-soft': '#3b2c15',
  '--focus': GOLD_RING,
  '--shadow': DARK_SHADOW,
}

/** Slate ledger: blue-grey ink surfaces, ivory text, gold accents, teal gains. */
const MIDNIGHT_LEDGER: BaseVars = {
  'color-scheme': 'dark',
  '--bg': '#101419',
  '--bg-elev': '#151a21',
  '--surface': '#1a2029',
  '--surface-2': '#212833',
  '--surface-3': '#2a323f',
  '--border': '#2e3744',
  '--border-strong': '#46515f',
  '--border-input': '#7a879a',
  '--text': '#ede7d8',
  '--text-muted': '#aab2bf',
  '--text-dim': '#9aa3b1',
  '--primary': '#2a6a96',
  '--primary-hover': '#245c83',
  '--on-primary': '#ffffff',
  '--gold': '#e2b860',
  '--gold-soft': '#352d1c',
  '--gold-line': '#5c4c2a',
  '--on-gold': '#1a1405',
  '--gem': '#8f7ad8',
  '--gem-soft': '#272440',
  '--gem-text': '#b0a0ef',
  '--gem-line': '#4a4278',
  '--cash': '#7cc5a6',
  '--cash-soft': '#1a332c',
  '--gain': '#3fc1a5',
  '--gain-soft': '#15332e',
  '--gain-line': '#235a50',
  '--on-gain': '#05201a',
  '--loss': '#f07a68',
  '--loss-soft': '#3b2020',
  '--loss-line': '#6a3330',
  '--on-loss': '#2a0905',
  '--info': '#69acd8',
  '--info-soft': '#192c3b',
  '--info-line': '#2c4f69',
  '--warning': '#e6a648',
  '--warning-soft': '#382b17',
  '--focus': GOLD_RING,
  '--shadow': DARK_SHADOW,
}

/** Light paper: warm parchment surfaces, ink text, deep teal actions, brass accents. */
const PARCHMENT_DAY: BaseVars = {
  'color-scheme': 'light',
  '--bg': '#f3ead9',
  '--bg-elev': '#f9f3e7',
  '--surface': '#fffaf1',
  '--surface-2': '#f1e6d1',
  '--surface-3': '#e9dbc0',
  '--border': '#d9c7a5',
  '--border-strong': '#bba37a',
  '--border-input': '#86704c',
  '--text': '#2a2017',
  '--text-muted': '#584a3a',
  '--text-dim': '#655642',
  '--primary': '#1b6566',
  '--primary-hover': '#155354',
  '--on-primary': '#ffffff',
  '--gold': '#87600f',
  '--gold-soft': '#f4e4c0',
  '--gold-line': '#d4b774',
  '--on-gold': '#ffffff',
  '--gem': '#6a50b8',
  '--gem-soft': '#ece5f7',
  '--gem-text': '#5a41a3',
  '--gem-line': '#c5b6eb',
  '--cash': '#2c6b49',
  '--cash-soft': '#e1efe3',
  '--gain': '#0e5a3d',
  '--gain-soft': '#dcefe3',
  '--gain-line': '#93c4a8',
  '--on-gain': '#ffffff',
  '--loss': '#b83c2b',
  '--loss-soft': '#f9e6e0',
  '--loss-line': '#e2a598',
  '--on-loss': '#ffffff',
  '--info': '#1f5d88',
  '--info-soft': '#dfeaf3',
  '--info-line': '#9fc0d9',
  '--warning': '#8a5800',
  '--warning-soft': '#f6e6c6',
  '--focus': GOLD_RING,
  '--shadow': '0 1px 0 #3a2a140f, 0 8px 24px #3a2a141f',
}

/** Harbour at dusk: charcoal-plum surfaces, coral actions, amber accents. */
const HARBOR_DUSK: BaseVars = {
  'color-scheme': 'dark',
  '--bg': '#17131a',
  '--bg-elev': '#1d1820',
  '--surface': '#231d27',
  '--surface-2': '#2b2430',
  '--surface-3': '#352c3a',
  '--border': '#3a3140',
  '--border-strong': '#534658',
  '--border-input': '#8f7f98',
  '--text': '#f4eae3',
  '--text-muted': '#bcafb8',
  '--text-dim': '#ab9ea9',
  '--primary': '#b44f3d',
  '--primary-hover': '#9f4535',
  '--on-primary': '#ffffff',
  '--gold': '#eeb25c',
  '--gold-soft': '#3a2b1c',
  '--gold-line': '#634a2a',
  '--on-gold': '#1f1405',
  '--gem': '#9a7ad6',
  '--gem-soft': '#2c2340',
  '--gem-text': '#bba2f0',
  '--gem-line': '#514078',
  '--cash': '#86c7a3',
  '--cash-soft': '#1f3229',
  '--gain': '#4cc3a2',
  '--gain-soft': '#17332d',
  '--gain-line': '#255a4c',
  '--on-gain': '#05201a',
  '--loss': '#f2738a',
  '--loss-soft': '#3f1e27',
  '--loss-line': '#6e3040',
  '--on-loss': '#2b0810',
  '--info': '#78b0d6',
  '--info-soft': '#1d2c3a',
  '--info-line': '#33506a',
  '--warning': '#f0a860',
  '--warning-soft': '#3a2a1a',
  '--focus': GOLD_RING,
  '--shadow': DARK_SHADOW,
}

/** High-contrast borders without the night map's green tint, for the other dark bases. */
const neutralHighContrast = (
  border: string,
  strong: string,
  input: string,
) => ({
  '--text': '#ffffff',
  '--text-muted': '#eceae6',
  '--text-dim': '#d6d3cf',
  '--border': border,
  '--border-strong': strong,
  '--border-input': input,
})

export const THEMES: Theme[] = [
  {
    id: 'night-map',
    name: 'Night Map (classic)',
    description:
      'Forest-green night map with parchment text and brass accents.',
    kind: 'base',
    free: true,
    vars: NIGHT_MAP,
  },
  {
    id: 'midnight-ledger',
    name: 'Midnight Ledger',
    description:
      'Slate ledger surfaces, ivory text, gold accents and teal gains.',
    kind: 'base',
    free: true,
    vars: MIDNIGHT_LEDGER,
    adapt: {
      'theme-palette-high-contrast': neutralHighContrast(
        '#8391a6',
        '#adb9ca',
        '#d3dbe6',
      ),
    },
  },
  {
    id: 'parchment-day',
    name: 'Parchment Day',
    description:
      'Light paper surfaces, ink text, deep teal actions and brass accents.',
    kind: 'base',
    free: true,
    vars: PARCHMENT_DAY,
    adapt: {
      'theme-palette-colorblind': {
        '--gain': '#1d5f9e',
        '--gain-soft': '#dde8f5',
        '--loss': '#a34f00',
        '--loss-soft': '#f7e4cc',
      },
      'theme-palette-high-contrast': {
        '--text': '#000000',
        '--text-muted': '#2a2017',
        '--text-dim': '#3b3023',
        '--border': '#7a6648',
        '--border-strong': '#5a4a32',
        '--border-input': '#2a2017',
        '--gain': '#0a4a31',
        '--loss': '#962c1f',
      },
      'theme-candles-ocean': {
        '--candle-up': '#2b74b5',
        '--candle-down': '#b8601c',
      },
      'theme-candles-ink': {
        '--candle-up': '#977a4b',
        '--candle-down': '#3a2a1c',
      },
      'theme-candles-sunset': {
        '--candle-up': '#a77b12',
        '--candle-down': '#6f55b5',
      },
    },
  },
  {
    id: 'harbor-dusk',
    name: 'Harbor Dusk',
    description: 'Charcoal-plum surfaces with coral actions and amber accents.',
    kind: 'base',
    free: true,
    vars: HARBOR_DUSK,
    adapt: {
      'theme-palette-high-contrast': neutralHighContrast(
        '#9a8aa0',
        '#c0b2c5',
        '#e3d6e0',
      ),
    },
  },
  {
    id: 'theme-palette-colorblind',
    name: 'Colour-blind-safe palette',
    description: 'Blue for gains and orange for losses everywhere.',
    kind: 'palette',
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
    kind: 'palette',
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
    kind: 'candles',
    free: false,
    vars: { '--candle-up': '#4f9fd8', '--candle-down': '#e8893a' },
  },
  {
    id: 'theme-candles-ink',
    name: 'Ink candles',
    description: 'Parchment rising candles and ink-brown falling candles.',
    kind: 'candles',
    free: false,
    vars: { '--candle-up': '#e8dcc0', '--candle-down': '#a08a6c' },
  },
  {
    id: 'theme-candles-sunset',
    name: 'Sunset candles',
    description: 'Gold rising candles and plum falling candles.',
    kind: 'candles',
    free: false,
    vars: { '--candle-up': '#e0b654', '--candle-down': '#a993d9' },
  },
]

export const BASE_THEMES = THEMES.filter((theme) => theme.kind === 'base')

const byId = new Map(THEMES.map((theme) => [theme.id, theme]))

export function findTheme(id: string | null | undefined): Theme | undefined {
  return id ? byId.get(id) : undefined
}

/** Every property any theme sets, so switching clears what the old one set. */
const ALL_VARS = [
  ...new Set(
    THEMES.flatMap((theme) => [
      ...Object.keys(theme.vars),
      ...Object.values(theme.adapt ?? {}).flatMap((vars) => Object.keys(vars)),
    ]),
  ),
]

/** The themes a player has chosen, one per kind. */
export interface ThemeSelection {
  base: string
  palette: string | null
  candles: string | null
}

type Stored = Partial<Record<ThemeKind, string>>

const storageKey = (playerId: string) => `traders-edge:themes:${playerId}`
/** Before base themes, one theme id was stored here; read it once as a fallback. */
const legacyKey = (playerId: string) => `traders-edge:theme:${playerId}`

const listeners = new Set<() => void>()
const memory = new Map<string, Stored>()

function clean(value: unknown): Stored {
  const stored: Stored = {}
  if (!value || typeof value !== 'object') return stored
  for (const [kind, id] of Object.entries(value)) {
    const theme = findTheme(typeof id === 'string' ? id : null)
    if (theme && theme.kind === kind) stored[theme.kind] = theme.id
  }
  return stored
}

function readStored(playerId: string | null): Stored {
  if (!playerId) return {}
  if (memory.has(playerId)) return memory.get(playerId) ?? {}
  try {
    const raw = localStorage.getItem(storageKey(playerId))
    if (raw !== null) return clean(JSON.parse(raw))
    const legacy = findTheme(localStorage.getItem(legacyKey(playerId)))
    return legacy ? { [legacy.kind]: legacy.id } : {}
  } catch {
    return {}
  }
}

function writeStored(playerId: string, stored: Stored): void {
  try {
    localStorage.setItem(storageKey(playerId), JSON.stringify(stored))
    localStorage.removeItem(legacyKey(playerId))
    memory.delete(playerId)
  } catch {
    // Without storage the theme still applies until the page reloads.
    memory.set(playerId, stored)
  }
  for (const listener of listeners) listener()
}

/**
 * Equip a theme in its kind's slot, keeping the other kinds. `null` clears
 * the `kind` slot, or every slot when no kind is given (the standard look).
 */
export function equipTheme(
  playerId: string,
  themeId: string | null,
  kind?: ThemeKind,
): void {
  const theme = findTheme(themeId)
  if (themeId && !theme) return
  if (!theme) {
    const stored = { ...readStored(playerId) }
    if (kind) delete stored[kind]
    writeStored(playerId, kind ? stored : {})
    return
  }
  writeStored(playerId, { ...readStored(playerId), [theme.kind]: theme.id })
}

/** Free themes anyone may open by link with `?theme=<id>`; shop themes stay owned-only. */
export function themeFromQuery(search: string): string | null {
  const id = new URLSearchParams(search).get('theme')
  const theme = findTheme(id)
  return theme?.free ? theme.id : null
}

/** A `?theme=` preview read once at startup, applied now and saved once a player is known. */
let pending: string | null = readUrlTheme()

function readUrlTheme(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('theme')) return null
    const id = themeFromQuery(url.search)
    // Drop the parameter so a reload does not override a later choice.
    url.searchParams.delete('theme')
    window.history.replaceState(
      window.history.state,
      '',
      url.pathname + url.search + url.hash,
    )
    return id
  } catch {
    return null
  }
}

/** Save a pending `?theme=` preview as this player's choice. */
export function adoptUrlTheme(playerId: string): void {
  if (!pending) return
  const id = pending
  pending = null
  equipTheme(playerId, id)
}

const selections = new Map<string, ThemeSelection>()

/** The player's composed choice (a stable object per value, safe for useSyncExternalStore). */
export function themeSelection(playerId: string | null): ThemeSelection {
  const stored = { ...readStored(playerId) }
  const preview = findTheme(pending)
  if (preview) stored[preview.kind] = preview.id
  const base = stored.base ?? DEFAULT_BASE_THEME
  const palette = stored.palette ?? null
  const candles = stored.candles ?? null
  const key = `${base}|${palette}|${candles}`
  let selection = selections.get(key)
  if (!selection) {
    selection = { base, palette, candles }
    selections.set(key, selection)
  }
  return selection
}

export function isThemeEquipped(
  playerId: string | null,
  themeId: string | null,
): boolean {
  const selection = themeSelection(playerId)
  if (themeId === null) {
    return (
      selection.base === DEFAULT_BASE_THEME &&
      !selection.palette &&
      !selection.candles
    )
  }
  const theme = findTheme(themeId)
  return !!theme && selection[theme.kind] === themeId
}

/** One theme id for single-choice lists: candles, else palette, else a chosen base. */
function singleId(stored: Stored): string | null {
  return stored.candles ?? stored.palette ?? stored.base ?? null
}

/** The theme id this player equipped on this device, if it still exists. */
export function storedTheme(playerId: string | null): string | null {
  return singleId(readStored(playerId))
}

/** Equipped theme for single-choice lists, including a pending `?theme=` preview. */
export function currentTheme(playerId: string | null): string | null {
  const stored = { ...readStored(playerId) }
  const preview = findTheme(pending)
  if (preview) stored[preview.kind] = preview.id
  return singleId(stored)
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The custom properties to set for one theme alone; every other theme property is cleared. */
export function themeVars(
  themeId: string | null,
): Record<string, string | null> {
  const theme = findTheme(themeId)
  return Object.fromEntries(
    ALL_VARS.map((name) => [name, theme?.vars[name] ?? null]),
  )
}

/** The custom properties for a composed selection: base, then candles, then palette. */
export function composeThemeVars(
  selection: ThemeSelection,
): Record<string, string | null> {
  const base = findTheme(selection.base) ?? findTheme(DEFAULT_BASE_THEME)
  const vars: Record<string, string> = { ...base?.vars }
  for (const id of [selection.candles, selection.palette]) {
    const theme = findTheme(id)
    if (!theme) continue
    Object.assign(vars, theme.vars, base?.adapt?.[theme.id])
  }
  return Object.fromEntries(ALL_VARS.map((name) => [name, vars[name] ?? null]))
}
