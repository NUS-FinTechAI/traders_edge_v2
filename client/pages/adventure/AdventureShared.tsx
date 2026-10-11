import type { ReactNode } from 'react'
import useAuth from '../../hooks/useAuth.ts'
import PublicAdventurePage from './public-adventure-page/PublicAdventurePage.tsx'

export function AdventureGate({
  children,
}: {
  children: (userId: string) => ReactNode
}) {
  const { status, user } = useAuth()
  return status === 'signed-in' && user ? (
    children(user.id)
  ) : (
    <PublicAdventurePage />
  )
}
