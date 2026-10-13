import ToastProvider from '../components/context-providers/toast/ToastProvider.tsx'
import { Outlet } from 'react-router-dom'
import Navbar from '../components/navbar/Navbar.tsx'
import './AppLayout.css'
import AuthProvider from '../components/context-providers/auth/AuthProvider.tsx'

export default function AppLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="app-layout">
          <Navbar />
          <Outlet />
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}
