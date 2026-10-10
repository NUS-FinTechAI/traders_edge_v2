import { useSyncExternalStore } from 'react'
import authService from '../services/authService.ts'

export default function useUser() {
  return useSyncExternalStore(
    authService.subscribe,
    authService.getUser,
    authService.getUser,
  )
}
