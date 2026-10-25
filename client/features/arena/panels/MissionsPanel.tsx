import type { Mission, MissionState } from '../../../services/gameService.ts'
import Icon, { type IconName } from '../../../ui/Icon.tsx'
import Panel from './Panel.tsx'
import styles from './panels.module.css'

const STATES: Record<
  Exclude<MissionState, 'done' | 'pending'>,
  { label: string; icon?: IconName; className?: string }
> = {
  on_track: { label: 'On track', icon: 'eye', className: styles.stateOnTrack },
  behind: { label: 'Behind', className: styles.stateBehind },
  failed: { label: 'Missed', icon: 'close', className: styles.stateFailed },
}

function MissionStatus({ mission }: { mission: Mission }) {
  const count = /^(\d+)\/(\d+)$/.test(mission.progress)
  if (count && (mission.state === 'pending' || mission.state === 'done')) {
    return (
      <span className={`num ${styles.missionState}`}>{mission.progress}</span>
    )
  }
  if (mission.state === 'pending' || mission.done || mission.state === 'done')
    return null
  const state = STATES[mission.state]
  return (
    <span
      className={[styles.missionState, state.className]
        .filter(Boolean)
        .join(' ')}
    >
      {state.icon && <Icon name={state.icon} size={14} />}
      <span>{state.label}</span>
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
            aria-label={`${mission.tier === 'bonus' ? 'Bonus star mission' : 'Star mission'}${showState ? `: ${mission.done ? 'completed' : 'incomplete'}` : ''}`}
            role="img"
          >
            <Icon
              name={mission.tier === 'bonus' ? 'sparkle' : 'star'}
              size={18}
              filled={showState && mission.done}
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
  return (
    <Panel title="Missions" bare={bare}>
      <MissionList missions={missions} />
    </Panel>
  )
}
