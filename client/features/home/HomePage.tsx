import useAuth from '../../hooks/useAuth.ts'
import { ErrorState, Loading } from '../../ui/States.tsx'
import Dashboard from './Dashboard.tsx'
import Landing from './Landing.tsx'

export default function HomePage() {
  const { status, error, retry } = useAuth()
  if (status === 'loading') return <Loading label="Loading your camp…" />
  if (status === 'unavailable')
    return <ErrorState message={error} onRetry={() => void retry()} />
  return status === 'signed-in' ? <Dashboard /> : <Landing />
}
