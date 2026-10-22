import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react'
import { usePlayer } from './PlayerContext.ts'
import {
  adoptUrlTheme,
  composeThemeVars,
  subscribeTheme,
  themeSelection,
} from './themes.ts'

/** Apply the signed-in player's base, palette and candle themes to :root. */
export default function ThemeApplier() {
  const { player } = usePlayer()
  const playerId = player?.id ?? null
  const selection = useSyncExternalStore(
    subscribeTheme,
    () => themeSelection(playerId),
    () => themeSelection(null),
  )

  // A `?theme=` link becomes the player's saved choice once they are known.
  useEffect(() => {
    if (playerId) adoptUrlTheme(playerId)
  }, [playerId])

  // Before paint, so a light base never flashes the dark defaults.
  useLayoutEffect(() => {
    const root = document.documentElement.style
    const vars = composeThemeVars(selection)
    for (const [name, value] of Object.entries(vars)) {
      if (value) root.setProperty(name, value)
      else root.removeProperty(name)
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta && vars['--bg']) meta.setAttribute('content', vars['--bg'])
  }, [selection])

  return null
}
