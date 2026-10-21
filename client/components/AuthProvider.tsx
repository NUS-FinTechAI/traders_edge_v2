import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { authController } from '../controllers/authController.ts'
import { AuthContext } from '../contexts/AuthContext.ts'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    authController.subscribe,
    authController.getSnapshot,
    authController.getSnapshot,
  )
  useEffect(() => {
    void authController.initialize().catch(() => {})
  }, [])
  return (
    <AuthContext.Provider
      value={{
        ...snapshot,
        refreshUser: authController.refreshUser,
        retry: authController.retry,
        logout: authController.logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
