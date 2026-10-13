import './ErrorPanel.css'
export default function ErrorState() {
  return (
    <div className="error-panel" role="alert">
      <p className="error-message">
        Something went wrong. Please try again later.
      </p>
    </div>
  )
}
