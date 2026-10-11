import useAuth from '../../../hooks/useAuth.ts'
import { adventureError } from '../../../services/adventureService.ts'
import { HttpError } from '../../../services/httpService.ts'
import './ReadError.css'

export default function ReadError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  const { refreshUser } = useAuth()
  return (
    <div className="adventure-notice adventure-read-error" role="alert">
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
