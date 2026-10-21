import type { ReactNode } from 'react'
import useAuth from '../hooks/useAuth.ts'
import type { Player } from '../services/playerService.ts'
import { ButtonLink } from '../ui/Button.tsx'
import { ErrorState, Loading } from '../ui/States.tsx'
import { usePlayer } from './PlayerContext.ts'

/** Render a page that needs the player, with a way out instead of a spinner that never ends. */
export default function RequirePlayer({
  label,
  children,
}: {
  label: string
  children: (player: Player) => ReactNode
}) {
  const { player, error, refreshPlayer } = usePlayer()
  const { status, error: authError, retry } = useAuth()
  if (player) return <>{children(player)}</>
  if (status === 'unavailable')
    return (
      <ErrorState
        message={authError || 'We couldn’t check your sign-in.'}
        onRetry={() => void retry().catch(() => undefined)}
      />
    )
  if (status === 'signed-out')
    return (
      <ErrorState
        title="You’re signed out"
        message="Sign in to see this page."
        action={
          <ButtonLink to="/login" icon="user">
            Sign in
          </ButtonLink>
        }
      />
    )
  if (error)
    return <ErrorState message={error} onRetry={() => void refreshPlayer()} />
  return <Loading label={label} />
}
