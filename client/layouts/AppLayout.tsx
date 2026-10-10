import { Outlet } from 'react-router-dom'
import Navbar from '../components/navbar/Navbar.tsx'
import AuthProvider from '../contexts/AuthProvider.tsx'

export default function AppLayout() {
  return (
    <AuthProvider>
      <Navbar />
      <Outlet />
    </AuthProvider>
  )
}
