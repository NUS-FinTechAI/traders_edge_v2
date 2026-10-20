import '../../App.css'
import useUser from '../../hooks/useUser.ts'
import AdventureModeCard from '../../components/adventure/adventure-mode-card/AdventureModeCard.tsx'
import './HomePage.css'
import { Link } from 'react-router-dom'

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
