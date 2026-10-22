import { useEffect } from 'react'

const APP = 'Trader’s Edge'

const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Home'],
  [/^\/login/, 'Sign in'],
  [/^\/adventure\/[^/]+/, 'Chapter map'],
  [/^\/adventure/, 'Adventure'],
  [/^\/level\//, 'Lesson'],
  [/^\/game\//, 'Match'],
  [/^\/play/, 'Play'],
  [/^\/multiplayer\/lobby\//, 'Lobby'],
  [/^\/multiplayer/, 'Multiplayer'],
  [/^\/quiz\/attempt\//, 'Quiz'],
  [/^\/quiz\/room\//, 'Class room'],
  [/^\/quiz\/daily/, 'Daily Quiz'],
  [/^\/quiz\/chapters/, 'Chapter Quizzes'],
  [/^\/quiz\/classroom/, 'Classroom'],
  [/^\/quiz/, 'Quiz'],
  [/^\/leaderboard/, 'Leaderboard'],
  [/^\/profile/, 'Profile'],
  [/^\/shop/, 'Shop'],
  [/^\/archive/, 'Trading Archive'],
]

/** "Adventure · Trader’s Edge"-style document titles for each route. */
export function pageTitle(pathname: string): string {
  const name = TITLES.find(([pattern]) => pattern.test(pathname))?.[1]
  return name ? `${name} · ${APP}` : APP
}

export default function usePageTitle(pathname: string): void {
  useEffect(() => {
    document.title = pageTitle(pathname)
  }, [pathname])
}
