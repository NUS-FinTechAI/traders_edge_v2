import { useEffect, useSyncExternalStore } from 'react'
import { usePlayer } from './PlayerContext.ts'
import { currentTheme, subscribeTheme, themeVars } from './themes.ts'

/** Apply the signed-in player's equipped theme to :root. */
export default function ThemeApplier() {
  const { player } = usePlayer()
  const playerId = player?.id ?? null
  const themeId = useSyncExternalStore(
    subscribeTheme,
    () => currentTheme(playerId),
    () => null,
  )

  useEffect(() => {
    const root = document.documentElement.style
    for (const [name, value] of Object.entries(themeVars(themeId))) {
      if (value) root.setProperty(name, value)
      else root.removeProperty(name)
    }
  }, [themeId])

  return null
}
