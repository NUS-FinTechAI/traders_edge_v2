import ToastProvider from '../components/context-providers/toast/ToastProvider.tsx'
import { Outlet, useNavigation } from 'react-router-dom'
import Navbar from '../components/navbar/Navbar.tsx'
import './AppLayout.css'
import AuthProvider from '../components/context-providers/auth/AuthProvider.tsx'

export default function AppLayout() {
  const navigation = useNavigation()
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="app-layout">
          <Navbar />
          {navigation.state === 'loading' && (
            <p className="route-loading" role="status">
              Loading activity…
            </p>
          )}
          <Outlet />
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}
