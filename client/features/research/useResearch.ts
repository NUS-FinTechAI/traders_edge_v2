import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import {
  getOnboarding,
  getResearchAccess,
} from '../../services/researchService.ts'

/** Whether the signed-in account may open the researcher dashboard; false until the server says otherwise. */
export function useResearchAccess(): boolean {
  const { status, user } = useAuth()
  const [access, setAccess] = useState<{ user: unknown; allowed: boolean }>()

  useEffect(() => {
    if (status !== 'signed-in') return
    const controller = new AbortController()
    getResearchAccess(controller.signal).then(
      (allowed) => setAccess({ user, allowed }),
      () => {
        if (!controller.signal.aborted) setAccess({ user, allowed: false })
      },
    )
    return () => controller.abort()
  }, [status, user])

  return status === 'signed-in' && access?.user === user && access.allowed
}

/** Sends a participant whose study questions are due to them once; everyone else stays put. */
export function useOnboardingRedirect(): void {
  const { status } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (status !== 'signed-in') return
    const controller = new AbortController()
    getOnboarding(controller.signal).then(
      (view) => {
        if (view.due && !controller.signal.aborted) void navigate('/onboarding')
      },
      // Optional research questions never block the map.
      () => {},
    )
    return () => controller.abort()
  }, [status, navigate])
}
