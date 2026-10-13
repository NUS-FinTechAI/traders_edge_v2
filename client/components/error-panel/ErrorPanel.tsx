import './ErrorPanel.css'
import ErrorLogo from '../icons/ErrorLogo'

export default function ErrorPanel() {
  return (
    <div className="error-panel" role="alert">
      <ErrorLogo />
      <p className="error-message">
        Something went wrong. Please try again later.
      </p>
    </div>
  )
}
