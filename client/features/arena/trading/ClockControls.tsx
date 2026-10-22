import type { ClockAction } from '../../../services/gameService.ts'
import Button from '../../../ui/Button.tsx'
import { tourTarget } from '../tour/tour.ts'
import styles from './Trading.module.css'

const SPEEDS = [1, 2, 4] as const

interface ClockControlsProps {
  paused: boolean
  speed: number
  busy: boolean
  onClock: (action: ClockAction, speed?: 1 | 2 | 4) => void
}

export default function ClockControls({
  paused,
  speed,
  busy,
  onClock,
}: ClockControlsProps) {
  const nextSpeed =
    SPEEDS[(SPEEDS.indexOf(speed as 1 | 2 | 4) + 1) % SPEEDS.length]
  return (
    <div
      className={styles.clock}
      role="group"
      aria-label="Market clock"
      {...tourTarget('clock')}
    >
      <Button
        variant={paused ? 'primary' : 'secondary'}
        size="sm"
        icon={paused ? 'play' : 'pause'}
        className={styles.clockMain}
        disabled={busy}
        aria-label={paused ? 'Play' : 'Pause'}
        onClick={() => onClock(paused ? 'resume' : 'pause')}
      >
        <span className={styles.clockText} aria-hidden="true">
          {paused ? 'Play' : 'Pause'}
        </span>
      </Button>
      {paused && (
        <Button
          variant="secondary"
          size="sm"
          icon="step"
          className={styles.clockMain}
          disabled={busy}
          aria-label="Next day"
          onClick={() => onClock('step')}
        >
          <span className={styles.clockText} aria-hidden="true">
            Next day
          </span>
        </Button>
      )}
      <div className={styles.speeds} role="group" aria-label="Speed">
        {SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            className={`num ${styles.speed}`}
            aria-pressed={speed === value}
            aria-label={`${value} times speed`}
            disabled={busy}
            onClick={() => onClock('speed', value)}
          >
            {value}×
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`num ${styles.speedCycle}`}
        aria-label={`Speed ${speed} times. Switch to ${nextSpeed} times`}
        disabled={busy}
        onClick={() => onClock('speed', nextSpeed)}
      >
        {speed}×
      </button>
    </div>
  )
}
