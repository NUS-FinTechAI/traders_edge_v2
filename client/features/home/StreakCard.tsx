import { useState } from 'react'
import { usePlayer } from '../../app/PlayerContext.ts'
import {
  claimDailyLogin,
  type Activity,
  type Player,
} from '../../services/playerService.ts'
import Button from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import { utcDate } from '../../ui/format.ts'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'
import styles from './Home.module.css'

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function weekday(date: string): string {
  return DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()]
}

export default function StreakCard({
  player,
  activity,
  onClaimed,
}: {
  player: Player
  activity: Activity | undefined
  onClaimed: () => void
}) {
  const { refreshPlayer } = usePlayer()
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const week = activity?.week ?? []
  const todayDate = utcDate()
  const found = week.findIndex((day) => day.date === todayDate)
  const today = found >= 0 ? found : player.streak.cycle_day - 1
  const claimed = player.streak.claimed_today

  async function claim() {
    setBusy(true)
    try {
      const result = await claimDailyLogin()
      notify(
        result.already_claimed
          ? 'Already claimed today. Come back tomorrow!'
          : `+${result.doubloons} Doubloons · +${result.xp} XP`,
        'success',
      )
      await refreshPlayer()
      onClaimed()
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.streak} aria-labelledby="streak-title">
      <div className={styles.streakHead}>
        <h2 id="streak-title" className={styles.cardTitle}>
          Daily streak
        </h2>
        <Chip tone="flame" icon="flame">
          {player.streak.days} {player.streak.days === 1 ? 'day' : 'days'} in a
          row
        </Chip>
      </div>
      <div className={styles.streakRow}>
        <ol className={styles.days}>
          {week.map((day, index) => {
            const name = weekday(day.date)
            const isToday = index === today
            const state = day.claimed
              ? styles.dayClaimed
              : isToday
                ? styles.dayToday
                : styles.dayLater
            return (
              <li
                key={day.date}
                className={styles.day}
                aria-label={`${name}${isToday ? ' (today)' : ''}: ${day.claimed ? 'claimed' : 'not claimed yet'}, ${day.xp} XP and ${day.doubloons} Doubloons`}
              >
                <span
                  className={`${styles.dayDot} ${state}`}
                  aria-hidden="true"
                >
                  {day.claimed ? <Icon name="check" size={18} /> : name[0]}
                </span>
                <span className={styles.dayName} aria-hidden="true">
                  {isToday ? 'Today' : name.slice(0, 3)}
                </span>
                <span className={styles.dayXp} aria-hidden="true">
                  +{day.xp} XP
                </span>
                <span className={styles.dayCoins} aria-hidden="true">
                  <Icon name="coin" size={12} />
                  {day.doubloons}
                </span>
              </li>
            )
          })}
        </ol>
        <div className={styles.chest}>
          <Emblem
            name={claimed ? 'chest-open' : 'chest'}
            tone={claimed ? 'neutral' : 'gold'}
            size={64}
          />
          {claimed ? (
            <p className={styles.chestText}>
              <strong>Claimed</strong>
              <span>Come back tomorrow</span>
            </p>
          ) : (
            <Button variant="gold" disabled={busy} onClick={() => void claim()}>
              {busy ? 'Opening…' : 'Claim'}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
