import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLoaderData, useParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import type { UserProfile } from '../../services/authService.ts'
import type { Challenge } from '../../services/challengeService.ts'
import {
  challengeBrief,
  challengeDecisionReview,
  challengeError,
  challengeNames,
  challengeStartPath,
  utcTime,
} from '../../services/challengeReadService.ts'
import TradingWorkspace from '../../components/trading/TradingWorkspace.tsx'
import useChallengeSession from './useChallengeSession.ts'
import './Challenges.css'

function ChallengeResults({ challenge }: { challenge: Challenge }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const result = challenge.result
  if (!result) return null
  const review = challengeDecisionReview(challenge)
  const awards = result.awards
  return (
    <section
      className="challenge-section"
      aria-labelledby="challenge-result-title"
    >
      <h2 ref={heading} id="challenge-result-title" tabIndex={-1}>
        {result.win ? 'First place — result saved' : 'Challenge result saved'}
      </h2>
      <p>
        Your net portfolio profit: <strong>{result.profit}</strong> simulated
        funds. Final portfolio value is cash plus remaining holdings after paid
        transaction costs. Net profit is final portfolio value minus the
        starting portfolio value.
      </p>
      <p>
        A win requires strictly more profit than every opponent. Equal profits
        share a rank; a tie is not a victory. These results describe this game,
        not validated learning or future profitability.
      </p>
      <div
        className="challenge-table"
        role="region"
        aria-label="Final profit leaderboard"
        tabIndex={0}
      >
        <table>
          <caption>
            Frozen final leaderboard · scroll sideways for all values
          </caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Participant</th>
              <th scope="col">Net profit</th>
              <th scope="col">Final value</th>
              <th scope="col">Fees paid</th>
            </tr>
          </thead>
          <tbody>
            {result.leaderboard.map((entry) => (
              <tr key={entry.participant_id}>
                <th scope="row">{entry.rank}</th>
                <td>
                  {entry.participant_id === 'human'
                    ? 'You'
                    : entry.display_name}
                </td>
                <td>{entry.profit}</td>
                <td>{entry.final_value}</td>
                <td>{entry.fees}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {awards?.awarded && (
        <section>
          <h3>Game rewards recorded</h3>
          <ul>
            <li>Player XP: {awards.awarded.xp}</li>
            <li>Weekly Stocks currency: {awards.awarded.stocks}</li>
            <li>Premium currency: {awards.awarded.premium}</li>
          </ul>
          <p>
            These are game rewards. Individual orders and trading volume do not
            earn rewards, learning days or learning badges.
          </p>
        </section>
      )}
      {awards?.chapter_entry_unlocked && (
        <p>
          This chapter is now open through its entry boss. Earlier module checks
          remain separate.
        </p>
      )}
      {awards?.chapter_exit_completed && (
        <p>
          The chapter boss is complete. Where a following chapter exists, its
          game access is now open.
        </p>
      )}
      {awards?.wallet?.daily_cooldown_until && (
        <p>
          Daily retry available again at{' '}
          {utcTime(awards.wallet.daily_cooldown_until)}. You can continue
          learning or visit <Link to="/player">your player rewards</Link>.
        </p>
      )}
      {review && (
        <section>
          <h3>Decision record for reflection</h3>
          <p>{review.basis}</p>
          <dl className="challenge-balances">
            <div>
              <dt>Final cash allocation</dt>
              <dd>{review.cash_percent}%</dd>
            </div>
            <div>
              <dt>Largest final position</dt>
              <dd>{review.largest_position_percent}%</dd>
            </div>
            <div>
              <dt>Largest observed drawdown</dt>
              <dd>{review.max_drawdown_percent}%</dd>
            </div>
            <div>
              <dt>Total fees</dt>
              <dd>{review.fees}</dd>
            </div>
            <div>
              <dt>Orders recorded</dt>
              <dd>{review.submitted_orders}</dd>
            </div>
            <div>
              <dt>Orders with fills</dt>
              <dd>{review.filled_orders}</dd>
            </div>
          </dl>
          <ul>
            {review.review_prompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
          <p>
            These recorded facts and prompts are not an automatically graded
            reasoning score.
          </p>
        </section>
      )}
      {challenge.player.reflection && (
        <section>
          <h3>Your saved reflection</h3>
          <p className="challenge-prose">{challenge.player.reflection}</p>
        </section>
      )}
      <nav className="challenge-actions" aria-label="After this challenge">
        <Link
          className="challenge-button"
          to={challengeStartPath(challenge.mode, challenge.module_id)}
        >
          Review a new attempt
        </Link>
        {challenge.module_id && (
          <Link
            className="challenge-button"
            to={`/adventure/chapters/${encodeURIComponent(challenge.module_id)}`}
          >
            Return to chapter map
          </Link>
        )}
        <Link className="challenge-button" to="/player">
          Player rewards
        </Link>
      </nav>
    </section>
  )
}

function PlayChallenge({
  owner,
  attemptId,
}: {
  owner: string
  attemptId?: string
}) {
  const { controller, state, busy } = useChallengeSession(owner, attemptId)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const { refreshUser } = useAuth()
  const challenge = state.challenge
  const invoke = (action: Promise<void>) => {
    void action.catch(() => {})
  }
  const ended =
    challenge?.status === 'completed' || challenge?.status === 'abandoned'
  useEffect(() => {
    if (ended) void refreshUser().catch(() => {})
  }, [ended, refreshUser])
  function reflect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    invoke(
      controller.complete(
        String(
          new FormData(event.currentTarget).get('reflection') ?? '',
        ).trim(),
      ),
    )
  }
  const disabled =
    busy ||
    state.pending ||
    state.phase === 'error' ||
    state.phase === 'recovery'
  const last = challenge
    ? challenge.player.tick === challenge.player.total_ticks - 1
    : false
  const remaining = challenge
    ? challenge.player.total_ticks - 1 - challenge.player.tick
    : 0
  const advances = remaining > 1 ? [1, Math.min(5, remaining)] : [1]
  const brief = challenge ? challengeBrief(challenge) : null
  return (
    <main className="challenge-page">
      <Link className="challenge-back" to="/challenges">
        ← Game challenges
      </Link>
      <h1>{challenge ? challengeNames[challenge.mode] : 'Saved challenge'}</h1>
      {busy && (
        <p role="status">
          {state.phase === 'submitting'
            ? 'Confirming your saved action…'
            : 'Loading your saved challenge…'}
        </p>
      )}
      {!!state.error && (
        <div className="challenge-notice" role="alert">
          <p>{challengeError(state.error)}</p>
          <button
            disabled={busy}
            onClick={() => invoke(controller.recover(attemptId))}
          >
            {state.pending ? 'Confirm saved action' : 'Reload saved challenge'}
          </button>
          <p>
            <Link to="/challenges/resume">
              Recover the most recent saved action
            </Link>
          </p>
        </div>
      )}
      {state.pending && !state.error && (
        <div className="challenge-notice" role="status">
          Checking the same saved command. Other actions wait until its receipt
          is confirmed.
        </div>
      )}
      {!challenge && !busy && !state.error && (
        <p>
          No saved challenge was found in this browser.{' '}
          <Link to="/challenges">Choose a challenge</Link> to read its briefing.
        </p>
      )}
      {challenge && (
        <>
          <header className="challenge-heading">
            <p role="status" aria-atomic="true">
              <strong>
                Observation {challenge.player.tick} of{' '}
                {challenge.player.total_ticks - 1}
              </strong>{' '}
              · {challenge.status} · attempt {challenge.attempt_number}
            </p>
            <button
              disabled={busy}
              onClick={() => invoke(controller.recover(challenge.id))}
            >
              Reload current observation
            </button>
          </header>
          <section className="challenge-notice">
            <h2>{challenge.policy.objective}</h2>
            {brief?.context && <p>{brief.context}</p>}
            <p>
              All opponents observe the same market step. Their orders and
              holdings stay private; the final leaderboard shows permitted
              results. You face {challenge.opponents.length}{' '}
              {challenge.opponents.length === 1 ? 'opponent' : 'opponents'}.
            </p>
            <p>{challenge.policy.provenance}</p>
            <p>
              Difficulty: {challenge.policy.difficulty}. Profit determines this
              game result; it does not establish learning mastery.
            </p>
            {brief?.assessment_basis && <p>{brief.assessment_basis}</p>}
          </section>
          {challenge.status === 'completed' && (
            <ChallengeResults challenge={challenge} />
          )}
          {challenge.status === 'abandoned' && (
            <section className="challenge-notice" role="status">
              <h2>Attempt ended without a result</h2>
              <p>
                The saved record is retained. Abandonment grants no leaderboard
                result or completion reward.
                {challenge.mode === 'daily'
                  ? ' A daily attempt also starts the two-hour retry cooldown.'
                  : ''}
              </p>
              <Link to="/challenges">Return to your challenges</Link>
              {challenge.mode === 'daily' && (
                <p>
                  <Link to="/player">
                    View daily availability and player rewards
                  </Link>
                </p>
              )}
            </section>
          )}
          {challenge.status === 'active' && (
            <section className="challenge-section">
              <h2>
                {last
                  ? 'Final observation reached'
                  : 'Choose your next observation'}
              </h2>
              <p>
                There is no wall-clock deadline and no requirement to trade.
                Orders may execute on the next observation. Reach the final
                observation before saving your reflection and result.
              </p>
              <div className="challenge-actions">
                {advances.map((steps) => (
                  <button
                    key={steps}
                    disabled={disabled || last}
                    onClick={() =>
                      invoke(
                        controller.advance(
                          Math.min(
                            steps,
                            challenge.player.total_ticks -
                              1 -
                              challenge.player.tick,
                          ),
                        ),
                      )
                    }
                  >
                    {steps === 1 ? 'Observe 1 step' : `Observe ${steps} steps`}
                  </button>
                ))}
              </div>
            </section>
          )}
          <TradingWorkspace
            observation={challenge.player}
            busy={disabled || last}
            readOnly={challenge.status !== 'active'}
            onOrder={
              !last
                ? (order) => invoke(controller.submitOrder(order))
                : undefined
            }
            onCancel={(id) => invoke(controller.cancelOrder(id))}
          />
          <details className="challenge-section">
            <summary>Execution assumptions</summary>
            <p>
              Spread: {challenge.player.rules.spread_percent}%. Fee rate:{' '}
              {(Number(challenge.player.rules.fee_rate) * 100).toFixed(2)}% of
              each fill, plus {challenge.player.rules.first_fill_fee} on the
              first fill of each order. Partial fills and changing liquidity can
              change execution.
            </p>
            <p>{challenge.player.rules.settlement}</p>
            <p>
              A planned loss boundary is an intention, not an automatic exit or
              guarantee.
            </p>
          </details>
          {challenge.status === 'active' && last && (
            <section className="challenge-section">
              <h2>Reflect and save the final result</h2>
              {brief?.review_prompts?.length ? (
                <ul>
                  {brief.review_prompts.map((prompt) => (
                    <li key={prompt}>{prompt}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  Compare the plan, what you observed, execution costs and any
                  decision to wait. A profitable outcome alone does not explain
                  the quality of a decision.
                </p>
              )}
              <form onSubmit={reflect}>
                <fieldset disabled={disabled}>
                  <label htmlFor="challenge-reflection">
                    Your reflection (30–1,500 characters)
                  </label>
                  <textarea
                    id="challenge-reflection"
                    name="reflection"
                    minLength={30}
                    maxLength={1500}
                    rows={5}
                    required
                  />
                  <p>
                    The reflection is saved as your own record. Its length does
                    not establish reasoning quality.
                  </p>
                  <button type="submit">
                    Save reflection and final result
                  </button>
                </fieldset>
              </form>
            </section>
          )}
          {challenge.status === 'active' && (
            <section className="challenge-section">
              <h2>Leave this attempt</h2>
              {confirmAbandon ? (
                <div className="challenge-notice">
                  <p>
                    Abandoning ends this saved attempt without a leaderboard or
                    completion reward.
                    {challenge.mode === 'daily'
                      ? ' It also starts the two-hour daily retry cooldown.'
                      : ''}
                  </p>
                  <div className="challenge-actions">
                    <button
                      disabled={disabled}
                      onClick={() => invoke(controller.abandon())}
                    >
                      Confirm abandonment
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setConfirmAbandon(false)}
                    >
                      Keep this attempt open
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  disabled={disabled}
                  onClick={() => setConfirmAbandon(true)}
                >
                  Review abandonment
                </button>
              )}
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default function ChallengePage() {
  const { attemptId } = useParams()
  const user = useLoaderData<UserProfile>()
  return (
    <PlayChallenge
      key={`${user.id}:${attemptId ?? 'resume'}`}
      owner={user.id}
      attemptId={attemptId}
    />
  )
}
