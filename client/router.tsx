import { createBrowserRouter } from 'react-router-dom'
import HomePage from './pages/home-page/HomePage.tsx'
import LoginPage from './pages/login-page/LoginPage.tsx'
import AppLayout from './layouts/AppLayout.tsx'

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    children: [
      { path: '/', Component: HomePage },
      { path: '/login', Component: LoginPage },
    ],
  },
])
