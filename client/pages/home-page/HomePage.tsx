import '../../App.css'
import useUser from '../../hooks/useUser.ts'
import AdventureModeCard from '../../components/adventure/adventure-mode-card/AdventureModeCard.tsx'
import { Link } from 'react-router-dom'
import NextJourney from '../../components/adventure/next-journey/NextJourney.tsx'
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
      {user && <NextJourney key={user.id} owner={user.id} />}
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
        <section className="home-game-challenges">
          <h3>Play with other learners</h3>
          <p>
            Create a private code lobby after the foundation checks, or enter
            public ranked matches after all core chapter checks. Both players
            share the same market observations.
          </p>
          <Link className="home-game-link" to="/multiplayer">
            Multiplayer and public rankings
          </Link>
        </section>
        <section className="home-game-challenges">
          <h3>Check your understanding</h3>
          <p>
            Take a standalone quiz or join an instructor’s private classroom.
            Submitted answers stay saved; feedback appears after the full quiz.
          </p>
          <Link className="home-game-link" to="/quizzes">
            Quizzes and classrooms
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
