import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import authService from '../../services/authService.ts'
import firebaseService from '../../services/firebaseService.ts'
import { HttpError } from '../../services/httpService.ts'
import Button from '../../ui/Button.tsx'
import Emblem from '../../ui/Emblem.tsx'
import { ErrorState, Loading } from '../../ui/States.tsx'
import { useToast } from '../../ui/toastContext.ts'
import { safeReturnTo } from './returnTo.ts'
import styles from './LoginPage.module.css'

function errorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match. Try again.'
    case 'auth/email-already-in-use':
      return 'That email already has an account. Try signing in.'
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Pick a stronger password (at least 8 characters).'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was closed. You can try again.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups and retry.'
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a moment and try again.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is off. Try another one.'
    default:
      if (error instanceof HttpError && error.kind === 'http')
        return error.message
      return 'We couldn’t sign you in. Check your connection and try again.'
  }
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
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
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const destination = safeReturnTo(search.get('returnTo'))
  const { config, status, error: authError, refreshUser, retry } = useAuth()
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  /** The sign-in method whose identity step already succeeded, if any. */
  const [identityReady, setIdentityReady] = useState<string | null>(null)
  const [emailForm, setEmailForm] = useState(false)
  const [register, setRegister] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const verified = useRef(false)
  const [verifying, setVerifying] = useState(false)

  // A stale "signed-in" state (for example an expired cookie) must not bounce
  // back to a protected page, so confirm the session before leaving.
  useEffect(() => {
    if (status !== 'signed-in') return
    if (verified.current) {
      void navigate(destination, { replace: true })
      return
    }
    let active = true
    setVerifying(true)
    refreshUser().then(
      (profile) => {
        if (!active) return
        setVerifying(false)
        if (profile) {
          verified.current = true
          void navigate(destination, { replace: true })
        }
      },
      () => {
        if (active) setVerifying(false)
      },
    )
    return () => {
      active = false
    }
  }, [status, navigate, destination, refreshUser])

  async function signIn(method: string, action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try {
      // Retrying after only the session check failed skips the identity step.
      if (identityReady !== method) {
        setIdentityReady(null)
        await action()
        setIdentityReady(method)
      }
      const profile = await refreshUser()
      if (!profile) {
        setIdentityReady(null)
        throw new HttpError('Sign-in could not be verified', 'http', 401)
      }
      verified.current = true
    } catch (error) {
      notify(errorMessage(error), 'error')
      setBusy(false)
    }
  }

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void signIn(register ? 'register' : 'email', () =>
      register
        ? firebaseService.createAccount(email, password)
        : firebaseService.signInWithEmail(email, password),
    )
  }

  if (status === 'loading' || verifying)
    return <Loading label="Getting things ready…" />
  if (!config && status === 'unavailable')
    return (
      <ErrorState
        message={authError || 'Sign-in is unavailable right now.'}
        onRetry={() => void retry()}
      />
    )

  const mode = config?.auth.mode

  return (
    <div className={styles.page}>
      <section
        className={styles.card}
        aria-labelledby="login-title"
        aria-busy={busy}
      >
        <Emblem name="compass" size={80} tone="gold" shape="circle" />
        <p className={styles.brand}>Trader’s Edge</p>
        <h1 id="login-title" className={styles.title}>
          {register ? 'Create your account' : 'Start your adventure'}
        </h1>
        {mode === 'guest' && (
          <>
            <p className={styles.lead}>
              Jump straight in. Your progress is saved on this browser.
            </p>
            <Button
              size="lg"
              block
              icon="play"
              disabled={busy}
              onClick={() =>
                void signIn('guest', () => authService.startGuestSession())
              }
            >
              {busy ? 'Setting up…' : 'Start playing'}
            </Button>
          </>
        )}
        {mode === 'firebase' && (
          <div className={styles.methods}>
            <p className={styles.lead}>Sign in to save your progress.</p>
            <Button
              variant="secondary"
              size="lg"
              block
              disabled={busy}
              className={styles.google}
              onClick={() =>
                void signIn('google', () => firebaseService.signInWithGoogle())
              }
            >
              <GoogleMark />
              Continue with Google
            </Button>
            {!emailForm ? (
              <Button
                variant="ghost"
                block
                disabled={busy}
                onClick={() => {
                  setEmailForm(true)
                  setIdentityReady(null)
                }}
              >
                Use email instead
              </Button>
            ) : (
              <form className={styles.form} onSubmit={submitEmail}>
                <div className={styles.divider}>
                  <span>or with email</span>
                </div>
                <label className={styles.field}>
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    disabled={busy}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setIdentityReady(null)
                    }}
                  />
                </label>
                <label className={styles.field}>
                  <span>Password</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      register ? 'new-password' : 'current-password'
                    }
                    required
                    minLength={register ? 8 : undefined}
                    disabled={busy}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setIdentityReady(null)
                    }}
                  />
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(event) => setShowPassword(event.target.checked)}
                  />
                  Show password
                </label>
                <Button type="submit" size="lg" block disabled={busy}>
                  {busy ? 'Checking…' : register ? 'Create account' : 'Sign in'}
                </Button>
                <Button
                  variant="ghost"
                  block
                  disabled={busy}
                  onClick={() => {
                    setRegister(!register)
                    setPassword('')
                    setIdentityReady(null)
                  }}
                >
                  {register
                    ? 'Have an account? Sign in'
                    : 'New here? Create an account'}
                </Button>
              </form>
            )}
          </div>
        )}
        {busy && (
          <p role="status" className={styles.status}>
            Checking your sign-in…
          </p>
        )}
        <p className={styles.footnote}>Simulated money · fictional companies</p>
      </section>
    </div>
  )
}
