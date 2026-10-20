import '../../App.css'
import useUser from '../../hooks/useUser.ts'
import AdventureModeCard from '../../components/adventure/adventure-mode-card/AdventureModeCard.tsx'
import { Link } from 'react-router-dom'
import './HomePage.css'

export default function HomePage() {
  const user = useUser()

  return (
    <main className="home-page">
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
        <AdventureModeCard />
        <section className="home-game-challenges">
          <h3>Apply a plan in a game challenge</h3>
          <p>
            Read a daily or AI practice briefing, resume saved attempts, or find
            chapter bosses. Learning checks and game results stay separate.
          </p>
          <Link className="home-game-link" to="/challenges">
            Open game challenges
          </Link>
        </section>
        {user && (
          <p>
            <Link className="adventure-button" to="/player">
              Player record, rewards and reviews
            </Link>
          </p>
        )}
      </section>
    </main>
  )
}
