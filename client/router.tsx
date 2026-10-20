import { createBrowserRouter, Navigate } from 'react-router-dom'
import HomePage from './pages/home-page/HomePage.tsx'
import LoginPage from './pages/login-page/LoginPage.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import AdventurePage from './pages/adventure/adventure-page/AdventurePage.tsx'
import ChapterPage from './pages/adventure/chapter-page/ChapterPage.tsx'
import LearningStartPage from './pages/adventure/learning-start-page/LearningStartPage.tsx'
import LearningRunPage from './pages/adventure/learning-run-page/LearningRunPage.tsx'
import MultiplayerHubPage from './pages/multiplayer/MultiplayerHubPage.tsx'
import MultiplayerPage from './pages/multiplayer/MultiplayerPage.tsx'
import QuizHubPage from './pages/quizzes/QuizHubPage.tsx'
import QuizAttemptPage from './pages/quizzes/QuizAttemptPage.tsx'
import QuizRoomPage from './pages/quizzes/QuizRoomPage.tsx'
import authGuard from './auth-guards/authGuard.ts'
import AuthGuardError from './auth-guards/AuthGuardError.tsx'
import RouteError from './components/error-panel/RouteError.tsx'
import ChallengeHubPage from './pages/challenges/ChallengeHubPage.tsx'
import ChallengeStartPage from './pages/challenges/ChallengeStartPage.tsx'
import ChallengePage from './pages/challenges/ChallengePage.tsx'
import PlayerPage from './pages/player/PlayerPage.tsx'

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    children: [
      {
        ErrorBoundary: RouteError,
        children: [
          {
            path: '/quizzes',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: QuizHubPage,
          },
          {
            path: '/quizzes/attempts/:attemptId',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: QuizAttemptPage,
          },
          {
            path: '/quizzes/rooms/:roomId',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: QuizRoomPage,
          },
          { path: '/', Component: HomePage },
          { path: '/login', Component: LoginPage },
          {
            path: '/player',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: PlayerPage,
          },
          { path: '/adventure', Component: AdventurePage },
          { path: '/adventure/chapters/:moduleId', Component: ChapterPage },
          {
            path: '/multiplayer',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: MultiplayerHubPage,
          },
          {
            path: '/multiplayer/:lobbyId',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: MultiplayerPage,
          },
          {
            path: '/challenges',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: ChallengeHubPage,
          },
          {
            path: '/challenges/start/:mode',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: ChallengeStartPage,
          },
          {
            path: '/challenges/play/:attemptId',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: ChallengePage,
          },
          {
            path: '/challenges/resume',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: ChallengePage,
          },
          {
            path: '/adventure/start/:purpose/:target',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: LearningStartPage,
          },
          {
            path: '/adventure/runs/:runId',
            loader: authGuard.loader,
            ErrorBoundary: AuthGuardError,
            Component: LearningRunPage,
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
