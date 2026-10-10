import { Link } from 'react-router-dom'
import '../../App.css'

export default function HomePage() {
  return (
    <main>
      <h1>Trader’s Edge</h1>
      <p>A financial decision-making academy supported by a simulator.</p>
      <p>The rebuild is in discovery. Lessons are not available yet.</p>
      <Link to="/login">Sign in</Link>
    </main>
  )
}
