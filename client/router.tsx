import { createBrowserRouter } from 'react-router-dom'
import HomePage from './pages/home-page/HomePage.tsx'
import LoginPage from './pages/login-page/LoginPage.tsx'

export const router = createBrowserRouter([
  { path: '/', Component: HomePage },
  { path: '/login', Component: LoginPage },
])
