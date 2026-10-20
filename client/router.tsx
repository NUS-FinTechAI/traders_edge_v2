import { createBrowserRouter, Navigate } from 'react-router-dom'
import HomePage from './pages/home-page/HomePage.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import authGuard from './auth-guards/authGuard.ts'
import AuthGuardError from './auth-guards/AuthGuardError.tsx'
import RouteError from './components/error-panel/RouteError.tsx'

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    HydrateFallback: () => (
      <main className="route-loading">
        <p role="status">Loading Trader’s Edge…</p>
      </main>
    ),
    children: [
      {
        ErrorBoundary: RouteError,
        children: [
          {
            path: '/quizzes',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (await import('./pages/quizzes/QuizHubPage.tsx'))
                .default,
            }),
          },
          {
            path: '/quizzes/attempts/:attemptId',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (await import('./pages/quizzes/QuizAttemptPage.tsx'))
                .default,
            }),
          },
          {
            path: '/quizzes/rooms/:roomId',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (await import('./pages/quizzes/QuizRoomPage.tsx'))
                .default,
            }),
          },
          { path: '/', Component: HomePage },
          {
            path: '/login',
            lazy: async () => ({
              Component: (await import('./pages/login-page/LoginPage.tsx'))
                .default,
            }),
          },
          {
            path: '/player',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (await import('./pages/player/PlayerPage.tsx'))
                .default,
            }),
          },
          {
            path: '/adventure',
            lazy: async () => ({
              Component: (
                await import('./pages/adventure/adventure-page/AdventurePage.tsx')
              ).default,
            }),
          },
          {
            path: '/adventure/chapters/:moduleId',
            lazy: async () => ({
              Component: (
                await import('./pages/adventure/chapter-page/ChapterPage.tsx')
              ).default,
            }),
          },
          {
            path: '/multiplayer',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (
                await import('./pages/multiplayer/MultiplayerHubPage.tsx')
              ).default,
            }),
          },
          {
            path: '/multiplayer/:lobbyId',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (
                await import('./pages/multiplayer/MultiplayerPage.tsx')
              ).default,
            }),
          },
          {
            path: '/challenges',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (
                await import('./pages/challenges/ChallengeHubPage.tsx')
              ).default,
            }),
          },
          {
            path: '/challenges/start/:mode',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (
                await import('./pages/challenges/ChallengeStartPage.tsx')
              ).default,
            }),
          },
          {
            path: '/challenges/play/:attemptId',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (await import('./pages/challenges/ChallengePage.tsx'))
                .default,
            }),
          },
          {
            path: '/challenges/resume',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (await import('./pages/challenges/ChallengePage.tsx'))
                .default,
            }),
          },
          {
            path: '/adventure/start/:purpose/:target',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (
                await import('./pages/adventure/learning-start-page/LearningStartPage.tsx')
              ).default,
            }),
          },
          {
            path: '/adventure/runs/:runId',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            lazy: async () => ({
              Component: (
                await import('./pages/adventure/learning-run-page/LearningRunPage.tsx')
              ).default,
            }),
          },
          {
            path: '*',
            element: <Navigate to="/" replace />,
          },
        ],
      },
    ],
  },
])
