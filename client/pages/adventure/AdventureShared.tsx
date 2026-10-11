import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import './AdventureShared.css'

export function AdventureGate({
  children,
}: {
  children: (userId: string) => ReactNode
}) {
  const { status, user } = useAuth()
  if (status === 'signed-in' && user) return children(user.id)
  return (
    <main className="adventure-page adventure-auth-page">
      <Link className="adventure-back" to="/">
        Back to home
      </Link>
      <h1>Adventure Mode</h1>
      {status === 'loading' ? (
        <p role="status">Checking your learning profile…</p>
      ) : (
        <div className="adventure-notice">
          <h2>
            {status === 'signed-out'
              ? 'Your journey starts here'
              : 'Your profile is unavailable'}
          </h2>
          <p>Sign in to browse chapters and see your saved mission progress.</p>
          <Link className="adventure-button" to="/login">
            Go to sign in
          </Link>
        </div>
      )}
    </main>
  )
}
