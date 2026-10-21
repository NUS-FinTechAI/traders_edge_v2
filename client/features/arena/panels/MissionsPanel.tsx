import type { Mission } from '../../../services/gameService.ts'
import Icon from '../../../ui/Icon.tsx'
import Panel from './Panel.tsx'
import styles from './panels.module.css'

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
          {showState && (
            <span className={styles.missionState}>
              {mission.done ? (
                <>
                  <Icon name="check" size={16} />
                  <span>Done</span>
                </>
              ) : (
                <span className="num">{mission.progress ?? 'To do'}</span>
              )}
            </span>
          )}
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
