import type { ComponentType } from 'react'
import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom'
import AppShell from './app/AppShell.tsx'
import RouteError from './app/RouteError.tsx'
import authGuard from './auth-guards/authGuard.ts'
import { Loading } from './ui/States.tsx'

type Page = () => Promise<{ default: ComponentType }>

function page(path: string, load: Page, protectedRoute = true): RouteObject {
  return {
    path,
    loader: protectedRoute ? authGuard.loader : undefined,
    lazy: async () => ({ Component: (await load()).default }),
  }
}

export const router = createBrowserRouter([
  {
    Component: AppShell,
    HydrateFallback: () => <Loading label="Loading Trader’s Edge…" />,
    children: [
      {
        ErrorBoundary: RouteError,
        children: [
          page('/', () => import('./features/home/HomePage.tsx'), false),
          page('/login', () => import('./features/auth/LoginPage.tsx'), false),
          page(
            '/adventure',
            () => import('./features/adventure/AdventurePage.tsx'),
            false,
          ),
          page(
            '/adventure/:chapterId',
            () => import('./features/adventure/ChapterMapPage.tsx'),
            false,
          ),
          page(
            '/level/:levelId',
            () => import('./features/level/LevelPage.tsx'),
          ),
          page('/game/:gameId', () => import('./features/arena/ArenaPage.tsx')),
          page('/play', () => import('./features/play/PlayPage.tsx')),
          page(
            '/multiplayer',
            () => import('./features/multiplayer/MultiplayerPage.tsx'),
          ),
          page(
            '/multiplayer/lobby/:lobbyId',
            () => import('./features/multiplayer/LobbyPage.tsx'),
          ),
          page('/quiz', () => import('./features/quiz/QuizHubPage.tsx')),
          page(
            '/quiz/daily',
            () => import('./features/quiz/QuizDailyPage.tsx'),
          ),
          page(
            '/quiz/chapters',
            () => import('./features/quiz/QuizChaptersPage.tsx'),
          ),
          page(
            '/quiz/classroom',
            () => import('./features/quiz/QuizClassroomPage.tsx'),
          ),
          page(
            '/quiz/attempt/:attemptId',
            () => import('./features/quiz/QuizPage.tsx'),
          ),
          page(
            '/quiz/room/:roomId',
            () => import('./features/quiz/QuizRoomPage.tsx'),
          ),
          page(
            '/leaderboard',
            () => import('./features/leaderboard/LeaderboardPage.tsx'),
          ),
          page('/profile', () => import('./features/profile/ProfilePage.tsx')),
          page('/shop', () => import('./features/profile/ShopPage.tsx')),
          page(
            '/archive',
            () => import('./features/archive/ArchivePage.tsx'),
            false,
          ),
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
