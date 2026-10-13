import { createBrowserRouter, Navigate } from 'react-router-dom'
import HomePage from './pages/home-page/HomePage.tsx'
import LoginPage from './pages/login-page/LoginPage.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import AdventurePage from './pages/adventure/adventure-page/AdventurePage.tsx'
import ChapterPage from './pages/adventure/chapter-page/ChapterPage.tsx'
import LearningStartPage from './pages/adventure/learning-start-page/LearningStartPage.tsx'
import LearningRunPage from './pages/adventure/learning-run-page/LearningRunPage.tsx'
import authGuard from './auth-guards/authGuard.ts'
import AuthGuardError from './auth-guards/AuthGuardError.tsx'

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    children: [
      { path: '/', Component: HomePage },
      { path: '/login', Component: LoginPage },
      { path: '/adventure', Component: AdventurePage },
      { path: '/adventure/chapters/:moduleId', Component: ChapterPage },
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
        element: <Navigate to='/' replace />,
      }
    ],
  },
])
