import { createBrowserRouter } from 'react-router-dom'
import HomePage from './pages/home-page/HomePage.tsx'
import LoginPage from './pages/login-page/LoginPage.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import AdventurePage from './pages/adventure/adventure-page/AdventurePage.tsx'
import ChapterPage from './pages/adventure/chapter-page/ChapterPage.tsx'

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    children: [
      { path: '/', Component: HomePage },
      { path: '/login', Component: LoginPage },
      { path: '/adventure', Component: AdventurePage },
      { path: '/adventure/chapters/:moduleId', Component: ChapterPage },
    ],
  },
])
