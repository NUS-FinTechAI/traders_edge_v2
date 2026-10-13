import { createContext } from 'react'
import type { AuthSnapshot } from '../services/authController.ts'
import type { UserProfile } from '../services/authService.ts'

export interface AuthContextValue extends AuthSnapshot {
  refreshUser(): Promise<UserProfile | null>
  retry(): Promise<void>
  logout(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
