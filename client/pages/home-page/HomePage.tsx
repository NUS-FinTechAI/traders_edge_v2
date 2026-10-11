import '../../App.css'
import useUser from '../../hooks/useUser.ts'
import { Link } from 'react-router-dom'
import { RouteEmblem } from '../adventure/AdventureShared.tsx'

export default function HomePage() {
  const user = useUser()

  return (
    <main>
      {user === null ? (
        <h1>Welcome!</h1>
      ) : (
        <h1>Welcome, {user.display_name}!</h1>
      )}
      <section
        className="adventure-home-section"
        aria-labelledby="adventure-home-title"
      >
        <h2 id="adventure-home-title">Choose your journey</h2>
        <Link className="adventure-home-card" to="/adventure">
          <RouteEmblem />
          <h3>Adventure Mode</h3>
          <p>
            Learn through chapters, complete missions and follow your progress
            on the map.
          </p>
          <span className="adventure-card-link">
            Explore chapters <span aria-hidden="true">→</span>
          </span>
        </Link>
      </section>
    </main>
  )
}
