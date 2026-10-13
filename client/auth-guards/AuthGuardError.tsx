import { Link, useRevalidator } from 'react-router-dom'
import './AuthGuardError.css'
import ErrorPanel from '../components/error-panel/ErrorPanel.tsx'

export default function AuthGuardError() {
  const revalidator = useRevalidator()
  return (
    <main className="auth-guard-error">
      <h1>Unable to check sign-in</h1>
      <ErrorPanel message="Your profile could not be verified. Check your connection and try again.">
        <button
          disabled={revalidator.state === 'loading'}
          onClick={() => void revalidator.revalidate()}
        >
          {revalidator.state === 'loading' ? 'Checking…' : 'Try again'}
        </button>
        <Link to="/adventure">Browse chapters</Link>
      </ErrorPanel>
    </main>
  )
}
