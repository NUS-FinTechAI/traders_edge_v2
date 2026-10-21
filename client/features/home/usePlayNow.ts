import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import authService from '../../services/authService.ts'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'

/** "Play now": a guest session where available, otherwise the sign-in page. */
export default function usePlayNow(destination = '/adventure') {
  const { config, refreshUser } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()
  const [busy, setBusy] = useState(false)

  async function playNow() {
    if (busy) return
    if (config?.auth.mode !== 'guest') {
      void navigate(`/login?returnTo=${encodeURIComponent(destination)}`)
      return
    }
    setBusy(true)
    try {
      await authService.startGuestSession()
      if (!(await refreshUser())) throw new Error('Session not verified')
      void navigate(destination)
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(false)
    }
  }

  return { playNow, busy }
}
