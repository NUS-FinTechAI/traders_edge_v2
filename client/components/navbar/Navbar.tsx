import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AppLogo } from '../icons/app-logo/AppLogo.tsx'
import useAuth from '../../hooks/useAuth.ts'
import './navbar.css'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const destination = location.pathname + location.search
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
            <>
              <AppLogo />
              <span>Trader’s Edge</span>
            </>
        </Link>
        <div className="site-auth-actions">
          {status === 'loading' && <span role="status">Checking sign-in…</span>}
          {status === 'signed-out' && (
            <Link
              className="site-auth-button"
              to={
                destination === '/'
                  ? '/login'
                  : `/login?returnTo=${encodeURIComponent(destination)}`
              }
            >
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
