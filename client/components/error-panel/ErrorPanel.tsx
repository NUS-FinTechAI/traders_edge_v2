import type { ReactNode } from 'react'
import './ErrorPanel.css'

function ErrorPanel({}: { message?: string; children?: ReactNode }) {
  return (
    <div className="error-panel" role="alert">
      <p className="error-message">
        Something went wrong. Please try again later.
      </p>
    </div>
  )
}

export default ErrorPanel
