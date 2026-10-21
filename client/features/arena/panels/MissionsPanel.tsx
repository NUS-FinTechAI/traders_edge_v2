import type { Mission, MissionState } from '../../../services/gameService.ts'
import Icon, { type IconName } from '../../../ui/Icon.tsx'
import Panel from './Panel.tsx'
import styles from './panels.module.css'

const STATES: Record<
  MissionState,
  { label: string; icon?: IconName; className?: string }
> = {
  done: { label: 'Done', icon: 'check', className: styles.stateDone },
  on_track: { label: 'On track', icon: 'eye', className: styles.stateOnTrack },
  behind: { label: 'Behind', className: styles.stateBehind },
  failed: { label: 'Missed', icon: 'close', className: styles.stateFailed },
  pending: { label: 'To do' },
}

function MissionStatus({ mission }: { mission: Mission }) {
  const state =
    STATES[mission.state] ?? STATES[mission.done ? 'done' : 'pending']
  return (
    <span
      className={[styles.missionState, state.className]
        .filter(Boolean)
        .join(' ')}
    >
      {state.icon && <Icon name={state.icon} size={14} />}
      <span>{state.label}</span>
      {mission.state !== 'done' && mission.progress && (
        <span className={`num ${styles.missionProgress}`}>
          {mission.progress}
        </span>
      )}
    </span>
  )
}

export function MissionList({
  missions,
  showState = true,
}: {
  missions: Mission[]
  showState?: boolean
}) {
  return (
    <ul className={styles.missions}>
      {missions.map((mission) => (
        <li
          key={mission.id}
          className={showState && mission.done ? styles.missionDone : undefined}
        >
          <span
            className={
              mission.tier === 'bonus' ? styles.tierBonus : styles.tierBasic
            }
            aria-label={mission.tier === 'bonus' ? 'Bonus mission' : 'Mission'}
            role="img"
          >
            <Icon
              name={mission.tier === 'bonus' ? 'sparkle' : 'star'}
              size={18}
              filled
            />
          </span>
          <span className={styles.missionText}>{mission.text}</span>
          {showState && <MissionStatus mission={mission} />}
        </li>
      ))}
    </ul>
  )
}

export default function MissionsPanel({
  missions,
  bare,
}: {
  missions: Mission[]
  bare?: boolean
}) {
  const done = missions.filter((m) => m.done).length
  return (
    <Panel
      title="Missions"
      bare={bare}
      aside={
        <span className={`num ${styles.panelNote}`}>
          {done}/{missions.length} done
        </span>
      }
    >
      <MissionList missions={missions} />
    </Panel>
  )
}
