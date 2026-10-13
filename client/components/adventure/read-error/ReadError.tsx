import useAuth from '../../../hooks/useAuth.ts'
import { adventureError } from '../../../services/adventureService.ts'
import { HttpError } from '../../../services/httpService.ts'
import './ReadError.css'
import ErrorPanel from '../../error-panel/ErrorPanel.tsx'

export default function ReadError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  const { refreshUser } = useAuth()
  return (
    <ErrorPanel message={adventureError(error)}>
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
    </ErrorPanel>
  )
}
