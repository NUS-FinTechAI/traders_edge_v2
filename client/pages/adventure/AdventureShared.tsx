import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import { adventureError } from '../../services/adventureService.ts'
import { HttpError } from '../../services/httpService.ts'
import './adventure.css'

export function AdventureGate({
  children,
}: {
  children: (userId: string) => ReactNode
}) {
  const { status, user } = useAuth()
  if (status === 'signed-in' && user) return children(user.id)
  return (
    <main className="adventure-page">
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

export function ReadError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  const { refreshUser } = useAuth()
  return (
    <div className="adventure-notice" role="alert">
      <p>{adventureError(error)}</p>
      {error instanceof HttpError && error.status === 401 ? (
        <button
          className="adventure-button"
          onClick={() =>
            void refreshUser()
              .then(() => retry())
              .catch(() => {})
          }
        >
          Check sign-in
        </button>
      ) : (
        <button className="adventure-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Star({
  special = false,
  earned = true,
}: {
  special?: boolean
  earned?: boolean
}) {
  return (
    <svg
      className={`adventure-star${special ? ' adventure-star-special' : ''}${earned ? '' : ' adventure-star-unearned'}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {special ? (
        <path d="m12 2 3 6 7 4-7 4-3 6-3-6-7-4 7-4Z" />
      ) : (
        <path d="m12 2 3 6.5 7 1-5 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-5 7-1Z" />
      )}
    </svg>
  )
}

export function StarLegend() {
  return (
    <ul className="adventure-legend" aria-label="Mission stars">
      <li>
        <Star />
        <span>Normal star · required missions</span>
      </li>
      <li>
        <Star special />
        <span>Special star · optional bonus</span>
      </li>
    </ul>
  )
}

export function RouteEmblem() {
  return (
    <svg className="adventure-emblem" viewBox="0 0 160 112" aria-hidden="true">
      <path
        className="emblem-paper"
        d="m12 20 44-12 48 12 44-12v83l-44 13-48-13-44 13Z"
      />
      <path d="M56 8v83m48-71v84" />
      <path
        className="emblem-trail"
        d="M30 75c-2-30 48 12 47-20S124 68 125 34"
      />
      <circle cx="30" cy="75" r="5" />
      <path d="m119 27 12 12m0-12-12 12" />
    </svg>
  )
}
