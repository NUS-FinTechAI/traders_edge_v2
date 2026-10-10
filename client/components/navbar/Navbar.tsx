import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import authService from '../../services/authService.ts'
import './navbar.css'

type AuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'unavailable'

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const pendingCheck = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    pendingCheck.current = controller
    void authService.isAuthenticated({ signal: controller.signal }).then(
      (authenticated) => {
        if (controller.signal.aborted) return
        setStatus(authenticated ? 'signed-in' : 'signed-out')
        setError('')
      },
      () => {
        if (controller.signal.aborted) return
        setStatus('unavailable')
        setError('Unable to check your sign-in. Please try again.')
      },
    )
    return () => controller.abort()
  }, [pathname, attempt])

  async function signOut() {
    if (busy) return
    pendingCheck.current?.abort()
    setBusy(true)
    setError('')
    try {
      await authService.logout()
      setStatus('signed-out')
      void navigate('/', { replace: true })
    } catch {
      setError('Unable to sign out. Please try again.')
    } finally {
      setBusy(false)
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
        <span className="site-tagline">Financial decision-making academy</span>
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
              onClick={() => {
                setStatus('loading')
                setError('')
                setAttempt(attempt + 1)
              }}
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
