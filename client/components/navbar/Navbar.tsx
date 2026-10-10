import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import './navbar.css'

export default function Navbar() {
  const navigate = useNavigate()
  const { status, error, signingOut: busy, logout, retry } = useAuth()

  async function signOut() {
    if (busy) return
    try {
      await logout()
      void navigate('/', { replace: true })
    } catch {
      /* The controller exposes the error in the shared state. */
    }
  }

  return (
    <header className="site-header">
      <nav className="site-navbar" aria-label="Main navigation">
        <Link className="site-brand" to="/" aria-label="Trader’s Edge home">
          <svg viewBox="0 0 32 36" aria-hidden="true">
            <path d="M16 2 29 7v12c0 7-7 12-13 15C10 31 3 26 3 19V7Z" />
            <circle cx="16" cy="16" r="8" />
            <path d="m20 12-3 5-5 3 3-5Z" />
          </svg>
          <span>Trader’s Edge</span>
        </Link>
        <div className="site-auth-actions">
          {status === 'loading' && <span role="status">Checking sign-in…</span>}
          {status === 'signed-out' && (
            <Link className="site-auth-button" to="/login">
              Sign in
            </Link>
          )}
          {status === 'signed-in' && (
            <button
              className="site-auth-button"
              disabled={busy}
              onClick={() => void signOut()}
            >
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          )}
          {status === 'unavailable' && (
            <button
              className="site-auth-button"
              onClick={() => void retry().catch(() => {})}
            >
              Retry sign-in check
            </button>
          )}
        </div>
      </nav>
      {error && (
        <p className="site-auth-error" role="alert">
          {error}
        </p>
      )}
    </header>
  )
}
