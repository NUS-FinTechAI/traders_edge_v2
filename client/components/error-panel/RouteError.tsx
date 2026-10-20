import ErrorPanel from './ErrorPanel.tsx'

export default function RouteError() {
  return (
    <main className="route-error">
      <ErrorPanel />
      <div className="route-recovery">
        <button onClick={() => window.location.reload()}>
          Reload this page
        </button>
        <a href="/">Return home</a>
      </div>
    </main>
  )
}
