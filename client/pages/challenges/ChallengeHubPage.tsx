import { useCallback, useState } from 'react'
import { Link, useLoaderData } from 'react-router-dom'
import useAdventureRead from '../../hooks/useAdventureRead.ts'
import type { UserProfile } from '../../services/authService.ts'
import { ChallengeJournal } from '../../services/challengeJournal.ts'
import {
  challengeError,
  challengeNames,
  challengePath,
  challengeStartPath,
  loadChallengeOverview,
  utcTime,
} from '../../services/challengeReadService.ts'
import './Challenges.css'

function ChallengeHub({ owner }: { owner: string }) {
  const load = useCallback(
    (signal: AbortSignal) => loadChallengeOverview(signal),
    [],
  )
  const { state } = useAdventureRead(load)
  const [journal] = useState(() => {
    try {
      return {
        saved: new ChallengeJournal(owner, sessionStorage).read(),
        error: null,
      }
    } catch (error) {
      return { saved: null, error }
    }
  })
  return (
    <main className="challenge-page">
      <Link className="challenge-back" to="/">
        ← Home
      </Link>
      <h1>Game challenges</h1>
      <p>
        Apply a written plan in a shared synthetic market. Results rank net
        portfolio profit; learning checks and learning-earned badges remain
        separate.
      </p>
      <nav className="challenge-actions" aria-label="Game and learning modes">
        <Link to="/adventure">Learning chapters</Link>
        <Link to="/player">Player rewards</Link>
      </nav>
      {!!journal.error && <p role="alert">{challengeError(journal.error)}</p>}
      {journal.saved?.pending && (
        <section className="challenge-notice">
          <h2>Recover your saved action</h2>
          <p>
            An earlier challenge response is unconfirmed. Recover the same
            command before making a different decision.
          </p>
          <Link className="challenge-button" to="/challenges/resume">
            Confirm saved challenge action
          </Link>
        </section>
      )}
      {state.status === 'loading' && (
        <p role="status">Loading your saved attempts and availability…</p>
      )}
      {state.status === 'error' && (
        <div className="challenge-notice" role="alert">
          <p>{challengeError(state.error)}</p>
          <button onClick={() => window.location.reload()}>
            Reload challenges
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <section className="challenge-section">
            <h2>Daily AI challenge</h2>
            <p>
              One shared scenario and opponent per UTC day. The first daily
              victory can grant weekly Stocks currency; a loss or abandonment
              starts a two-hour retry cooldown.
            </p>
            {state.data.wallet.daily_cooldown_until ? (
              <>
                <p>
                  Available again at{' '}
                  {utcTime(state.data.wallet.daily_cooldown_until)}. There is no
                  need to hurry.
                </p>
                <Link to="/player">
                  View player rewards and daily availability
                </Link>
              </>
            ) : (
              <Link
                className="challenge-button"
                to={challengeStartPath('daily')}
              >
                Read daily briefing
              </Link>
            )}
            <p>
              Weekly Stocks balance: {state.data.wallet.stocks_balance}. Unspent
              Stocks expire at {utcTime(state.data.wallet.stocks_expires_at)}.
            </p>
          </section>
          <section className="challenge-section">
            <h2>Practice against AI</h2>
            <p>
              Choose one to three opponents and practise with execution costs,
              partial fills and saved order plans.
            </p>
            {state.data.practiceAvailable ? (
              <Link
                className="challenge-button"
                to={challengeStartPath('practice')}
              >
                Read practice briefing
              </Link>
            ) : (
              <>
                <p>
                  Pass the learning checks in Chapters 1–4 before practice.
                  Early boss access does not bypass these checks.
                </p>
                <ul>
                  {state.data.missing.map((chapter) => (
                    <li key={chapter.module_id}>
                      <Link
                        to={`/adventure/chapters/${encodeURIComponent(chapter.module_id)}`}
                      >
                        Chapter {chapter.order}: {chapter.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <section className="challenge-section">
            <h2>Chapter bosses</h2>
            <p>
              Open a chapter map to read its entry or chapter-boss briefing.
              Their game access and the separate chapter learning check have
              different criteria.
            </p>
            <Link className="challenge-button" to="/adventure">
              Open chapter maps
            </Link>
          </section>
          <section className="challenge-section">
            <h2>Saved attempts</h2>
            <button onClick={() => window.location.reload()}>
              Reload attempts and availability
            </button>
            {!state.data.attempts.length ? (
              <p>No challenge attempts yet. Read a briefing before starting.</p>
            ) : (
              <ul className="challenge-attempts">
                {state.data.attempts.map((attempt) => (
                  <li key={attempt.id}>
                    <Link to={challengePath(attempt.id)}>
                      {attempt.status === 'active' ? 'Resume' : 'Read'}{' '}
                      {challengeNames[attempt.mode]}
                      {attempt.module_id
                        ? ` · ${state.data.chapters.find((chapter) => chapter.module_id === attempt.module_id)?.title ?? attempt.module_id}`
                        : ''}
                    </Link>
                    <span>
                      {attempt.status} · saved {utcTime(attempt.updated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}

export default function ChallengeHubPage() {
  const user = useLoaderData<UserProfile>()
  return <ChallengeHub key={user.id} owner={user.id} />
}
