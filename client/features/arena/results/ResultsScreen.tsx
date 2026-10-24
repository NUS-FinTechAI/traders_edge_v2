import { useState, type FormEvent } from 'react'
import type {
  DecisionBreakdown,
  GameResult,
  GameState,
} from '../../../services/gameService.ts'
import Button, { ButtonLink } from '../../../ui/Button.tsx'
import Chip, { CurrencyChip, Delta } from '../../../ui/Chip.tsx'
import Icon from '../../../ui/Icon.tsx'
import ProgressBar from '../../../ui/ProgressBar.tsx'
import Stars from '../../../ui/Stars.tsx'
import { formatMoney, formatPct } from '../../../ui/format.ts'
import { errorText } from '../../../ui/useResource.ts'
import {
  chapterOf,
  equitySeries,
  isMultiplayer,
  keyMoments,
  ordinal,
  rankHeadline,
} from '../arenaLogic.ts'
import useRewardToasts from '../../rewards/useRewardToasts.tsx'
import { modeLabel, strategyLabel } from '../labels.ts'
import { MissionList } from '../panels/MissionsPanel.tsx'
import { Standings } from '../panels/RivalsPanel.tsx'
import Sparkline from './Sparkline.tsx'
import styles from './Results.module.css'

interface ResultsScreenProps {
  state: GameState
  result: GameResult
  onSaveReflection: (text: string) => Promise<void>
  onTryAgain: () => Promise<void>
}

const BREAKDOWN: { key: keyof DecisionBreakdown; label: string }[] = [
  { key: 'missions', label: 'Bonus missions met' },
  { key: 'plan', label: 'Stayed within your loss limit' },
  { key: 'risk', label: 'Protected buys with a stop-loss' },
  { key: 'overtrading', label: 'Kept fees small' },
]

/** Points available per part; older results without maxima use the original split. */
const DEFAULT_MAX: DecisionBreakdown = {
  missions: 40,
  plan: 25,
  risk: 25,
  overtrading: 10,
}

export default function ResultsScreen({
  state,
  result,
  onSaveReflection,
  onTryAgain,
}: ResultsScreenProps) {
  const stored = result.reflection?.trim() || null
  const [reflection, setReflection] = useState('')
  const [saving, setSaving] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startingCash = state.scenario.starting_cash
  const lastTick = Math.min(state.tick, state.ticks - 1)
  const series = equitySeries(
    startingCash,
    state.me.fills,
    state.bars,
    lastTick,
  )
  const moments = result.key_moments.length
    ? result.key_moments
    : keyMoments(state.me.fills, state.news)
  const chapter = chapterOf(state)
  const review = result.plan_review
  const preview = state.mode === 'boss' && state.boss === 'preview'
  const won = result.won && !result.forfeited && !preview
  const rewards = result.rewards
  useRewardToasts(state.id, rewards)
  const hasRewards =
    rewards.xp > 0 ||
    rewards.stocks > 0 ||
    rewards.gems > 0 ||
    rewards.items.length > 0 ||
    rewards.badges.length > 0 ||
    !!result.unlocked?.chapter_id
  const headline = preview ? 'Your starting point' : rankHeadline(result)

  async function save(event: FormEvent) {
    event.preventDefault()
    const text = reflection.trim()
    if (!text || stored) return
    setSaving(true)
    setError(null)
    try {
      await onSaveReflection(text)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setSaving(false)
    }
  }

  async function retry() {
    setRetrying(true)
    try {
      await onTryAgain()
    } finally {
      setRetrying(false)
    }
  }

  const playAgainLabel = state.mode === 'level' ? 'Try again' : 'Play again'

  const actions = (
    <div className={styles.actions}>
      {isMultiplayer(state) ? (
        <ButtonLink to="/multiplayer" variant="gold" size="lg">
          Back to multiplayer
        </ButtonLink>
      ) : (
        <>
          {chapter && (state.mode === 'level' || state.mode === 'boss') ? (
            <ButtonLink
              to={`/adventure/${chapter}`}
              variant="gold"
              size="lg"
              icon="map"
            >
              Back to the map
            </ButtonLink>
          ) : (
            <ButtonLink to="/play" variant="gold" size="lg" icon="swords">
              Play hub
            </ButtonLink>
          )}
          {state.mode !== 'daily' && (
            <Button
              variant="secondary"
              size="lg"
              icon="refresh"
              onClick={retry}
              disabled={retrying}
            >
              {retrying ? 'Setting up…' : playAgainLabel}
            </Button>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className={styles.page}>
      <section
        className={[
          styles.banner,
          won ? styles.bannerWin : styles.bannerPlain,
        ].join(' ')}
        aria-labelledby="result-title"
      >
        <span className={styles.bannerIcon}>
          <Icon
            name={
              preview
                ? 'compass'
                : result.of === 1 && !result.forfeited
                  ? 'target'
                  : won
                    ? 'trophy'
                    : result.forfeited
                      ? 'flag'
                      : 'podium'
            }
            size={30}
          />
        </span>
        <div>
          <p className={styles.eyebrow}>
            {modeLabel(state.mode, state.boss)} · {state.scenario.title}
          </p>
          <h1 id="result-title">{headline}</h1>
          {preview && (
            <p className={styles.profitLine}>
              You finished {ordinal(result.rank)} of {result.of}. This battle
              can’t be lost: it shows where you’re starting from.
            </p>
          )}
          <p className={styles.profitLine}>
            Your profit <Delta value={result.profit} pct={result.profit_pct} />
          </p>
        </div>
        {result.stars && (state.mode === 'level' || state.mode === 'boss') && (
          <div className={styles.stars}>
            <Stars
              normal={result.stars.normal}
              special={result.stars.special}
              size={30}
            />
          </div>
        )}
      </section>
      <p className={styles.caption}>
        Profit decides the match; your missions show what you learned.
      </p>
      {actions}

      <div className={styles.grid}>
        {result.leaderboard.length > 1 && (
          <section className={styles.card} aria-labelledby="final-title">
            <h2 id="final-title">Final standings</h2>
            <Standings entries={result.leaderboard} podium />
          </section>
        )}

        <section
          className={styles.card}
          aria-labelledby="missions-result-title"
        >
          <h2 id="missions-result-title">Missions</h2>
          <MissionList missions={result.missions} />
        </section>

        {hasRewards && (
          <section className={styles.card} aria-labelledby="rewards-title">
            <h2 id="rewards-title">Rewards</h2>
            <div className={styles.rewards}>
              {rewards.xp > 0 && (
                <CurrencyChip kind="xp" amount={rewards.xp} signed />
              )}
              {rewards.stocks > 0 && (
                <CurrencyChip kind="doubloons" amount={rewards.stocks} signed />
              )}
              {rewards.gems > 0 && (
                <CurrencyChip kind="gems" amount={rewards.gems} signed />
              )}
              {rewards.items.map((item) => (
                <Chip key={item.id} tone="gold" icon="gift">
                  New {item.kind}: {item.name}
                </Chip>
              ))}
              {rewards.badges.map((badge) => (
                <Chip key={badge.id} tone="info" icon="shield">
                  Badge: {badge.name}
                </Chip>
              ))}
              {result.unlocked?.chapter_id && (
                <Chip tone="gain" icon="map">
                  New chapter unlocked
                </Chip>
              )}
            </div>
          </section>
        )}

        {review && (
          <section className={styles.card} aria-labelledby="plan-review-title">
            <h2 id="plan-review-title">Plan review</h2>
            <p className={styles.planStrategy}>
              <Icon name="target" size={18} /> Strategy:{' '}
              {strategyLabel(review.strategy)}
            </p>
            <p
              className={
                review.kept_loss_limit ? styles.planKept : styles.planMissed
              }
            >
              <Icon
                name={review.kept_loss_limit ? 'check' : 'close'}
                size={20}
              />
              <span>
                You planned to risk at most {review.max_loss_pct}%; your worst
                drop was{' '}
                <span className="num">
                  {formatPct(review.worst_drawdown_pct)}
                </span>
                : {review.kept_loss_limit ? 'plan kept' : 'over your limit'}
              </span>
            </p>
            <dl className={styles.statList}>
              <div>
                <dt>Trades</dt>
                <dd className="num">{result.stats.trades}</dd>
              </div>
              <div>
                <dt>Fees paid</dt>
                <dd className="num">{formatMoney(result.stats.fees)}</dd>
              </div>
              <div>
                <dt>Biggest position</dt>
                <dd className="num">
                  {formatPct(result.stats.biggest_position_pct, 0)}
                </dd>
              </div>
              <div>
                <dt>Buy and hold</dt>
                <dd>
                  <Delta value={result.stats.buy_hold_profit} />
                </dd>
              </div>
            </dl>
            <p className={styles.muted}>
              Buy and hold: what you would have made if you had put all your
              cash in on day 0, split evenly across the stocks, and held.
            </p>
          </section>
        )}

        <section className={styles.card} aria-labelledby="score-title">
          <h2 id="score-title">Discipline score</h2>
          <p className={styles.score}>
            <span className="num">{Math.round(result.decision_score)}</span>
            <small>/ 100</small>
          </p>
          <ProgressBar
            value={Math.round(result.decision_score)}
            max={100}
            label="Discipline score"
            tone="gold"
          />
          <ul className={styles.breakdown}>
            {BREAKDOWN.filter(
              ({ key }) => (result.decision_max ?? DEFAULT_MAX)[key] > 0,
            ).map(({ key, label }) => (
              <li key={key}>
                <span>{label}</span>
                <span className="num">
                  {Math.round(result.decision_breakdown?.[key] ?? 0)} /{' '}
                  {Math.round((result.decision_max ?? DEFAULT_MAX)[key])}
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.muted}>This score never decides who wins.</p>
        </section>

        {series.length > 1 && (
          <section
            className={`${styles.card} ${styles.wide}`}
            aria-labelledby="equity-title"
          >
            <h2 id="equity-title">Your total value</h2>
            <Sparkline points={series} baseline={startingCash} />
            <p className={styles.sparkScale}>
              <span>Day 0</span>
              <span>
                Dashed line: starting cash {formatMoney(startingCash, true)}
              </span>
              <span>Day {Math.min(state.tick, state.ticks)}</span>
            </p>
          </section>
        )}

        {moments.length > 0 && (
          <section className={styles.card} aria-labelledby="moments-title">
            <h2 id="moments-title">Key moments</h2>
            <ol className={styles.timeline}>
              {moments.map((moment, n) => {
                const [, day, text] = moment.match(/^(Day \d+):\s*(.*)$/s) ?? [
                  null,
                  null,
                  moment,
                ]
                return (
                  <li key={n}>
                    {day && (
                      <span className={`num ${styles.momentDay}`}>{day}</span>
                    )}
                    <span>{text}</span>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {result.debrief && (
          <section className={styles.card} aria-labelledby="debrief-title">
            <h2 id="debrief-title">What happened</h2>
            <p className={styles.debrief}>{result.debrief}</p>
          </section>
        )}

        <section
          className={`${styles.card} ${styles.wide}`}
          aria-labelledby="reflection-title"
        >
          <h2 id="reflection-title">What would you do differently?</h2>
          {stored ? (
            <p className={styles.savedReflection}>
              <Icon name="check" size={18} />
              <span>
                <span className="visually-hidden">Your saved reflection: </span>
                “{stored}”
              </span>
            </p>
          ) : (
            <form className={styles.reflection} onSubmit={save}>
              <label htmlFor="reflection" className="visually-hidden">
                One line about what you would change
              </label>
              <input
                id="reflection"
                className={styles.input}
                maxLength={280}
                value={reflection}
                placeholder="One line is enough"
                onChange={(event) => setReflection(event.target.value)}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={saving || !reflection.trim()}
              >
                {saving ? 'Saving…' : 'Save reflection'}
              </Button>
            </form>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>
      </div>

      <p className={styles.footer}>
        Sim results. Real markets are harder, and nobody can guarantee profits.
      </p>
    </div>
  )
}
