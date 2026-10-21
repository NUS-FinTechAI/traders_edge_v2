import { useState } from 'react'
import type {
  GameState,
  Plan,
  StrategyId,
} from '../../../services/gameService.ts'
import Avatar from '../../../ui/Avatar.tsx'
import Button from '../../../ui/Button.tsx'
import Chip from '../../../ui/Chip.tsx'
import Icon from '../../../ui/Icon.tsx'
import { formatMoney } from '../../../ui/format.ts'
import { errorText } from '../../../ui/useResource.ts'
import { MAX_LOSS, STRATEGIES, TIER_LABEL, modeLabel } from '../labels.ts'
import { MissionList } from '../panels/MissionsPanel.tsx'
import styles from './Briefing.module.css'

interface BriefingScreenProps {
  state: GameState
  onStart: (plan: Plan) => Promise<void>
  onBack: () => void
}

function trimZero(value: number): string {
  return String(Number(value.toFixed(2)))
}

export default function BriefingScreen({
  state,
  onStart,
  onBack,
}: BriefingScreenProps) {
  const [strategy, setStrategy] = useState<StrategyId | null>(null)
  const [maxLoss, setMaxLoss] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { scenario } = state
  const rivals = state.leaderboard.filter((entry) => !entry.is_me)
  const startingCash = scenario.starting_cash
  const ready = strategy !== null && maxLoss !== null

  async function start() {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      await onStart({ strategy, max_loss_pct: maxLoss })
    } catch (caught) {
      setError(errorText(caught))
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <Button variant="ghost" icon="chevron-left" onClick={onBack}>
          Back
        </Button>
      </div>
      <article className={styles.card} aria-labelledby="briefing-title">
        <header className={styles.header}>
          <Chip tone="gold" icon={state.mode === 'boss' ? 'crown' : 'swords'}>
            {modeLabel(state.mode, state.boss)}
          </Chip>
          <h1 id="briefing-title">{scenario.title}</h1>
          <p className={styles.briefing}>{scenario.briefing}</p>
        </header>

        <section className={styles.objective} aria-labelledby="objective-title">
          <Icon name="compass" size={22} />
          <div>
            <h2 id="objective-title">What this market teaches</h2>
            <p>{scenario.objective}</p>
          </div>
        </section>

        <div className={styles.grid}>
          {rivals.length > 0 && (
            <section aria-labelledby="rivals-title">
              <h2 id="rivals-title" className={styles.sectionTitle}>
                Your rivals
              </h2>
              <ul className={styles.rivals}>
                {rivals.map((rival) => (
                  <li key={rival.participant_id}>
                    <Avatar id={rival.avatar || rival.name} size={44} />
                    <div>
                      <p className={styles.rivalName}>
                        {rival.name}
                        {rival.tier && (
                          <span className={styles.tier}>
                            {TIER_LABEL[rival.tier]}
                          </span>
                        )}
                        {rival.kind === 'human' && (
                          <span className={styles.tier}>Player</span>
                        )}
                      </p>
                      {rival.style && (
                        <p className={styles.rivalStyle}>{rival.style}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="missions-title">
            <h2 id="missions-title" className={styles.sectionTitle}>
              Missions
            </h2>
            <MissionList missions={state.missions} showState={false} />
            <p className={styles.legend}>
              <span className={styles.legendBasic}>
                <Icon name="star" size={14} filled /> Mission
              </span>
              <span className={styles.legendBonus}>
                <Icon name="sparkle" size={14} filled /> Bonus
              </span>
            </p>
          </section>

          <section aria-labelledby="assets-title">
            <h2 id="assets-title" className={styles.sectionTitle}>
              Stocks in this market
            </h2>
            <ul className={styles.assets}>
              {state.assets.map((asset) => (
                <li key={asset.symbol}>
                  <span className={styles.ticker}>{asset.symbol}</span>
                  <div>
                    <p className={styles.assetName}>
                      {asset.name} <span>{asset.sector}</span>
                    </p>
                    <p className={styles.assetBlurb}>{asset.blurb}</p>
                  </div>
                  <span className="num">{formatMoney(asset.price)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="rules-title">
            <h2 id="rules-title" className={styles.sectionTitle}>
              Rules
            </h2>
            <ul className={styles.rules}>
              <li>
                <Icon name="cash" size={18} /> Start with{' '}
                <span className="num">{formatMoney(startingCash, true)}</span>
              </li>
              <li>
                <Icon name="coin" size={18} /> Fees{' '}
                {trimZero(scenario.fee.rate * 100)}% (min{' '}
                {formatMoney(scenario.fee.min, true)}) + spread
              </li>
              <li>
                <Icon name="trophy" size={18} /> Highest total profit wins
              </li>
            </ul>
          </section>
        </div>

        <section className={styles.plan} aria-labelledby="plan-title">
          <h2 id="plan-title">Your game plan</h2>
          <p className={styles.planHint}>
            Pick one of each. Your results will compare the plan with what you
            did.
          </p>
          <fieldset className={styles.chipSet}>
            <legend>Strategy</legend>
            <div className={styles.chips}>
              {STRATEGIES.map((option) => (
                <label key={option.id} className={styles.choice}>
                  <input
                    type="radio"
                    name="strategy"
                    value={option.id}
                    checked={strategy === option.id}
                    onChange={() => setStrategy(option.id)}
                  />
                  <span>
                    <Icon
                      name="check"
                      size={16}
                      className={styles.choiceCheck}
                    />
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.chipSet}>
            <legend>Most I’m willing to lose</legend>
            <div className={styles.chips}>
              {MAX_LOSS.map((pct) => (
                <label key={pct} className={styles.choice}>
                  <input
                    type="radio"
                    name="max-loss"
                    value={pct}
                    checked={maxLoss === pct}
                    onChange={() => setMaxLoss(pct)}
                  />
                  <span>
                    <Icon
                      name="check"
                      size={16}
                      className={styles.choiceCheck}
                    />
                    <span className="num">{pct}%</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button
            variant="gold"
            size="lg"
            block
            icon="play"
            disabled={!ready || busy}
            onClick={start}
            aria-describedby={ready ? undefined : 'plan-needed'}
          >
            {busy ? 'Starting…' : 'Start trading'}
          </Button>
          {!ready && (
            <p id="plan-needed" className={styles.planNeeded}>
              Choose a strategy and a loss limit to start.
            </p>
          )}
        </section>
      </article>
      <p className={styles.footer}>Simulated money · fictional companies</p>
    </div>
  )
}
