import { useState } from 'react'
import { usePlayer } from '../../app/PlayerContext.ts'
import {
  onCooldown,
  refreshDaily,
  type Daily,
} from '../../services/dailyService.ts'
import Avatar from '../../ui/Avatar.tsx'
import Button from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import { formatClock, formatCount, formatShortDate } from '../../ui/format.ts'
import { useNow } from '../../ui/hooks.ts'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'
import useStartGame from './useStartGame.ts'
import styles from './DailyCard.module.css'

/** Weekly-track Doubloons for the first daily win of a UTC day (GDD §6.2). */
const DAILY_WIN_DOUBLOONS = 200

interface DailyCardProps {
  daily: Daily
  onChange: (daily: Daily) => void
  onReload: () => void
  full?: boolean
}

export default function DailyCard({
  daily,
  onChange,
  onReload,
  full,
}: DailyCardProps) {
  const { player, refreshPlayer } = usePlayer()
  const notify = useToast()
  const { start, busy } = useStartGame()
  const [refreshing, setRefreshing] = useState(false)
  const now = useNow(15000, !!daily.cooldown_until)
  const cooling = onCooldown(daily, now)

  if (!daily.unlocked)
    return (
      <section
        className={[styles.card, styles.locked, full && styles.full]
          .filter(Boolean)
          .join(' ')}
        aria-labelledby="daily-title"
      >
        <Emblem name="calendar" tone="neutral" size={full ? 72 : 56} />
        <div className={styles.body}>
          <p className={styles.eyebrow}>Daily challenge</p>
          <h2 id="daily-title" className={styles.title}>
            A new rival every day
          </h2>
          <p className={styles.lockLine}>
            <Icon name="lock" size={16} />
            {daily.locked_reason ?? 'Beat the Chapter 1 boss to unlock'}
          </p>
        </div>
      </section>
    )

  async function skipWait() {
    setRefreshing(true)
    try {
      onChange(await refreshDaily())
      notify('Cooldown skipped. Good luck!', 'success')
      void refreshPlayer()
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const { week, opponent } = daily
  const canAfford = (player?.wallet.gems ?? 0) >= daily.refresh_cost_gems

  return (
    <section
      className={[styles.card, full && styles.full].filter(Boolean).join(' ')}
      aria-labelledby="daily-title"
    >
      <div className={styles.rival}>
        <Avatar
          id={opponent.avatar}
          size={full ? 88 : 64}
          label={`${opponent.name} avatar`}
        />
        {full && (
          <div className={styles.rivalText}>
            <strong>{opponent.name}</strong>
            <Chip>{opponent.tier}</Chip>
          </div>
        )}
      </div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>Daily challenge</p>
        <h2 id="daily-title" className={styles.title}>
          {daily.scenario.title}
        </h2>
        <p className={styles.versus}>
          {full ? (
            <>“{opponent.style}”</>
          ) : (
            <>
              vs {opponent.name} · {opponent.tier}
            </>
          )}
        </p>
        {full && (
          <p className={styles.briefing}>
            {daily.scenario.briefing}{' '}
            <span className={styles.days}>{daily.scenario.ticks} days.</span>
          </p>
        )}
        <p className={styles.reward}>
          {daily.won_today ? (
            <Chip tone="gain" icon="check">
              Won today
            </Chip>
          ) : (
            <>
              <Icon name="coin" size={18} className={styles.coin} />
              Win to earn {DAILY_WIN_DOUBLOONS} Doubloons
            </>
          )}
        </p>
        <div className={styles.week}>
          <div className={styles.weekText}>
            <span>
              <span className="num">
                {formatCount(week.doubloons)} / {formatCount(week.target)}
              </span>{' '}
              Doubloons this week
            </span>
            <span className={styles.muted}>
              Resets {formatShortDate(week.resets_at)}
            </span>
          </div>
          <ProgressBar
            value={week.doubloons}
            max={week.target}
            tone="gold"
            label="Weekly Doubloons"
            valueText={`${week.doubloons} of ${week.target} Doubloons`}
          />
        </div>
      </div>
      <div className={styles.actions}>
        {cooling && daily.cooldown_until ? (
          <>
            <p className={styles.next}>
              <Icon name="clock" size={16} />
              Next try at {formatClock(daily.cooldown_until)}
            </p>
            <Button
              variant="secondary"
              icon="gem"
              disabled={refreshing || !canAfford}
              onClick={() => void skipWait()}
            >
              Skip wait · {daily.refresh_cost_gems} Gems
            </Button>
            {!canAfford && (
              <p className={styles.muted}>Earn Gems in ranked matches.</p>
            )}
          </>
        ) : (
          <Button
            variant={daily.won_today ? 'secondary' : 'primary'}
            size={full ? 'lg' : 'md'}
            icon="play"
            disabled={!!busy}
            onClick={() => void start({ mode: 'daily' }, { onError: onReload })}
          >
            {busy ? 'Starting…' : daily.won_today ? 'Play again' : 'Play'}
          </Button>
        )}
      </div>
    </section>
  )
}
