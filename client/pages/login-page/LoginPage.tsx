import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import configService, {
  type PublicConfig,
} from '../../services/configService.ts'
import authService from '../../services/authService.ts'
import firebaseService from '../../services/firebaseService.ts'
import './login-page.css'

function errorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password could not be verified.'
    case 'auth/email-already-in-use':
      return 'An account already uses this email. Try signing in.'
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Choose a stronger password according to the account password policy.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled. You can try again.'
    case 'auth/popup-blocked':
      return 'Allow the sign-in popup in your browser and try again.'
    case 'auth/too-many-requests':
      return 'Sign-in is temporarily unavailable. Please try again later.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is unavailable. Try another method.'
    default:
      return 'Unable to complete sign-in. Please check your connection and try again.'
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<PublicConfig>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [identityReady, setIdentityReady] = useState(false)
  const [emailForm, setEmailForm] = useState(false)
  const [register, setRegister] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const nextConfig = await configService.getConfig({
          signal: controller.signal,
        })
        if (!controller.signal.aborted) setConfig(nextConfig)
        const authenticated = await authService.isAuthenticated({
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        if (authenticated) {
          void navigate('/', { replace: true })
          return
        }
      } catch {
        if (!controller.signal.aborted)
          setError('Unable to load sign-in. Please try again.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [attempt, navigate])

  async function signIn(action?: () => Promise<unknown>) {
    if (busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      if (action) {
        await action()
        setIdentityReady(true)
      }
      await authService.getProfile()
      void navigate('/', { replace: true })
    } catch (error) {
      setError(errorMessage(error))
      setBusy(false)
    }
  }

  function submitEmail(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    void signIn(() =>
      register
        ? firebaseService.createAccount(email, password)
        : firebaseService.signInWithEmail(email, password),
    )
  }

  return (
    <main className="login-page">
      <header className="login-header">
        <Link to="/">Trader’s Edge</Link>
        <span>Financial decision-making academy</span>
      </header>
      <div className="login-layout">
        <aside className="login-introduction">
          <span className="login-kicker">Your learning journey</span>
          <h1>
            Find your footing.
            <br />
            Plan your next step.
          </h1>
          <p>
            Build an understanding of risk and practise financial decisions
            through lessons and simulations.
          </p>
          <ol className="login-route">
            <li>Understand the basics</li>
            <li>Practise decisions</li>
            <li>Reflect and progress</li>
          </ol>
        </aside>
        <section
          className="login-panel"
          aria-labelledby="login-title"
          aria-busy={loading || busy}
        >
          <span className="login-kicker">Start here</span>
          <h2 id="login-title">
            {register ? 'Create an account' : 'Welcome to Trader’s Edge'}
          </h2>
          {loading && <p role="status">Loading sign-in…</p>}
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          {!loading && !config && (
            <button
              onClick={() => {
                setLoading(true)
                setError('')
                setAttempt(attempt + 1)
              }}
            >
              Try again
            </button>
          )}
          {!loading && !identityReady && config?.auth.mode === 'guest' && (
            <>
              <p>
                Continue with a guest profile on this browser. Account sign-in
                is unavailable in this mode.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void signIn(() => authService.startGuestSession())
                }
              >
                Continue as guest
              </button>
            </>
          )}
          {!loading && !identityReady && config?.auth.mode === 'firebase' && (
            <>
              <p>Sign in to access your learning profile.</p>
              <button
                className="google-button"
                disabled={busy}
                onClick={() =>
                  void signIn(() => firebaseService.signInWithGoogle())
                }
              >
                <svg viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
                  />
                </svg>
                Sign in with Google
              </button>
              {!emailForm && (
                <button
                  className="login-secondary"
                  disabled={busy}
                  onClick={() => setEmailForm(true)}
                >
                  Continue with email
                </button>
              )}
              {emailForm && (
                <form onSubmit={submitEmail}>
                  <label htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={busy}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <label htmlFor="login-password">Password</label>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      register ? 'new-password' : 'current-password'
                    }
                    required
                    disabled={busy}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <label className="login-password-toggle">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(event) =>
                        setShowPassword(event.target.checked)
                      }
                    />
                    Show password
                  </label>
                  <button type="submit" disabled={busy}>
                    {register ? 'Create account' : 'Sign in'}
                  </button>
                  <button
                    type="button"
                    className="login-text-button"
                    disabled={busy}
                    onClick={() => {
                      setRegister(!register)
                      setPassword('')
                      setError('')
                    }}
                  >
                    {register
                      ? 'Already have an account? Sign in'
                      : 'New here? Create an account'}
                  </button>
                </form>
              )}
            </>
          )}
          {busy && <p role="status">Checking your sign-in…</p>}
          {identityReady && !busy && (
            <>
              <p>You’re signed in. Your profile could not be loaded yet.</p>
              <button onClick={() => void signIn()}>
                Retry loading profile
              </button>
            </>
          )}
          <Link className="login-home" to="/">
            Back to home
          </Link>
        </section>
      </div>
    </main>
  )
}
