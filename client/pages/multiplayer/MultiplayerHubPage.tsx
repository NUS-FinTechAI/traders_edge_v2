import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLoaderData, useNavigate } from 'react-router-dom'
import type { components } from '../../api/api-types.ts'
import authService, { type UserProfile } from '../../services/authService.ts'
import {
  loadMultiplayerHub,
  multiplayerError,
  multiplayerTimestamp,
} from '../../services/multiplayerService.ts'
import useMultiplayer from '../../hooks/useMultiplayer.ts'
import useAuth from '../../hooks/useAuth.ts'
import './Multiplayer.css'

function Hub({ owner }: { owner: UserProfile }) {
  const { state, controller } = useMultiplayer(owner.id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<{
    matches: components['schemas']['MultiplayerSummary'][] | null
    ranks: components['schemas']['MultiplayerLeaderboardResponse'] | null
    privateMissing: string[]
    publicMissing: string[]
    privateEligible: boolean
    publicEligible: boolean
  } | null>(null)
  const [readError, setReadError] = useState<unknown>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    void loadMultiplayerHub(owner.id, abort.signal)
      .then(({ profile, matches, ranks, catalog }) => {
        if (abort.signal.aborted || authService.getUser()?.id !== owner.id)
          return
        const required = (limit: number) =>
          catalog.chapters.filter((chapter) => chapter.order <= limit)
        const missing = (limit: number) =>
          required(limit)
            .filter(
              (chapter) =>
                !profile.mastered_module_ids.includes(chapter.module_id),
            )
            .map((chapter) => chapter.title)
        const privateMissing = missing(4),
          publicMissing = missing(9)
        setData({
          matches,
          ranks,
          privateMissing,
          publicMissing,
          privateEligible:
            required(4).length === 4 && privateMissing.length === 0,
          publicEligible:
            required(9).length === 9 && publicMissing.length === 0,
        })
        setReadError(null)
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setReadError(error)
          setData(null)
        }
      })
    return () => abort.abort()
  }, [owner, revision])
  if (user?.id !== owner.id) return <p>Sign in to view your matches.</p>
  const disabled = state.busy || state.pending
  async function open(task: Promise<void>) {
    try {
      await task
      const match = controller.getSnapshot().match
      if (match) await navigate(`/multiplayer/${encodeURIComponent(match.id)}`)
    } catch {
      /* The saved action remains available below. */
    }
  }
  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void open(
      controller.join(
        String(new FormData(event.currentTarget).get('code') ?? ''),
      ),
    )
  }
  return (
    <main className="multiplayer-page">
      <Link to="/adventure">Return to chapters</Link>
      <h1>Multiplayer</h1>
      <p>
        Compete in a shared fictional market. Match results use net portfolio
        profit; they do not measure learning or future profitability.
      </p>
      {state.error !== null && (
        <p role="alert">{multiplayerError(state.error)}</p>
      )}
      {readError !== null && <p role="alert">{multiplayerError(readError)}</p>}
      <button
        disabled={state.busy}
        onClick={() => setRevision((value) => value + 1)}
      >
        Refresh mode access and saved matches
      </button>
      {state.pending && (
        <section className="multiplayer-panel">
          <h2>Confirm your saved action</h2>
          <p>
            A previous request has not been confirmed here. Confirm the same
            action before starting another.
          </p>
          <button
            disabled={state.busy}
            onClick={() => void open(controller.retry())}
          >
            Confirm saved action
          </button>
        </section>
      )}
      {state.match && (
        <p>
          <Link to={`/multiplayer/${encodeURIComponent(state.match.id)}`}>
            Open your last saved match
          </Link>
        </p>
      )}
      {!data && readError === null ? (
        <p role="status">Loading mode access and saved matches…</p>
      ) : data ? (
        <>
          <section className="multiplayer-panel">
            <h2>Private lobby</h2>
            <p>
              Share a code outside the app. Two to eight players can join; the
              host starts the match. Private play grants no XP, premium currency
              or rating.
            </p>
            {!data.privateEligible && (
              <p>
                Complete the first four chapter learning checks. Remaining:{' '}
                {data.privateMissing.join(', ') ||
                  'the full foundation catalog'}
                .
              </p>
            )}
            <button
              disabled={disabled || !data.privateEligible}
              onClick={() => void open(controller.create())}
            >
              Create private lobby
            </button>
            <form onSubmit={join}>
              <label htmlFor="multiplayer-code">Join code</label>
              <input
                id="multiplayer-code"
                name="code"
                required
                minLength={16}
                maxLength={16}
                pattern="[A-Fa-f0-9]{16}"
                autoComplete="off"
                spellCheck={false}
              />
              <button disabled={disabled || !data.privateEligible}>
                Join private lobby
              </button>
            </form>
          </section>
          <section className="multiplayer-panel">
            <h2>Public ranked match</h2>
            <p>
              Pair with one other player. Public results use a separate Elo
              rating. Finish the reflection to receive the server's game XP and
              premium reward.
            </p>
            {!data.publicEligible && (
              <p>
                Complete chapters 1–9 learning checks. Remaining:{' '}
                {data.publicMissing.join(', ') || 'the full core catalog'}.
              </p>
            )}
            <button
              disabled={disabled || !data.publicEligible}
              onClick={() => void open(controller.queue())}
            >
              Find public match
            </button>
          </section>
          <section className="multiplayer-panel">
            <h2>Your matches</h2>
            {data.matches === null ? (
              <p role="alert">
                Saved matches could not be loaded. Refresh to try again; mode
                entry remains available.
              </p>
            ) : data.matches.length === 0 ? (
              <p>No matches yet.</p>
            ) : (
              <ul>
                {data.matches.map((match) => (
                  <li key={match.id}>
                    <Link to={`/multiplayer/${encodeURIComponent(match.id)}`}>
                      {match.mode === 'private'
                        ? 'Private lobby'
                        : 'Public ranked match'}{' '}
                      · {match.status} ·{' '}
                      {multiplayerTimestamp(match.updated_at).toLocaleString(
                        undefined,
                        { timeZone: 'UTC' },
                      )}{' '}
                      UTC
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="multiplayer-panel">
            <h2>Public rating leaderboard</h2>
            {data.ranks === null ? (
              <p role="alert">
                Public ratings could not be loaded. Refresh to try again; mode
                entry remains available.
              </p>
            ) : (
              <>
                <p>
                  Your rating: {data.ranks.your_rating} · Rated matches:{' '}
                  {data.ranks.your_matches}. This ranks public competition
                  results separately from learning progress.
                </p>
                {data.ranks.players.length === 0 ? (
                  <p>No rated matches recorded yet.</p>
                ) : (
                  <div
                    className="multiplayer-table"
                    role="region"
                    aria-label="Public Elo ratings; scroll horizontally for all columns"
                    tabIndex={0}
                  >
                    <table>
                      <caption>Public Elo ratings</caption>
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Rating</th>
                          <th>Matches</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ranks.players.map((player) => (
                          <tr key={player.user_id}>
                            <th scope="row">{player.display_name}</th>
                            <td>{player.rating}</td>
                            <td>{player.matches}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}

export default function MultiplayerHubPage() {
  const owner = useLoaderData<UserProfile>()
  return <Hub key={owner.id} owner={owner} />
}
