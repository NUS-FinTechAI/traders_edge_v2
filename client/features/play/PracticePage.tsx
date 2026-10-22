import {
  getPractice,
  type PracticeScenario,
} from '../../services/dailyService.ts'
import Avatar from '../../ui/Avatar.tsx'
import Button from '../../ui/Button.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState } from '../../ui/States.tsx'
import useResource from '../../ui/useResource.ts'
import useStartGame from './useStartGame.ts'
import styles from './Play.module.css'

const DIFFICULTY = ['Easy', 'Medium', 'Hard']

function Difficulty({ level }: { level: number }) {
  const value = Math.min(3, Math.max(1, Math.round(level)))
  return (
    <span className={styles.difficulty}>
      <span className={styles.pips} aria-hidden="true">
        {[1, 2, 3].map((pip) => (
          <span
            key={pip}
            className={pip <= value ? styles.pipOn : styles.pip}
          />
        ))}
      </span>
      {DIFFICULTY[value - 1]}
    </span>
  )
}

function PracticeCard({
  scenario,
  busy,
  onStart,
}: {
  scenario: PracticeScenario
  busy: boolean
  onStart: () => void
}) {
  return (
    <li className={styles.practice}>
      <div className={styles.practiceHead}>
        <h3 className={styles.cardTitle}>{scenario.title}</h3>
        <Difficulty level={scenario.difficulty} />
      </div>
      <p className={styles.muted}>{scenario.briefing}</p>
      {scenario.bots.length > 0 && (
        <div className={styles.rivals}>
          <span className={styles.stack} aria-hidden="true">
            {scenario.bots.map((bot) => (
              <Avatar key={bot.bot_id} id={bot.avatar} size={36} />
            ))}
          </span>
          <span className={styles.rivalNames}>
            vs {scenario.bots.map((bot) => bot.name).join(', ')}
          </span>
        </div>
      )}
      <Button
        variant="secondary"
        icon="play"
        disabled={busy}
        onClick={onStart}
        aria-label={`Start ${scenario.title}`}
      >
        Start
      </Button>
    </li>
  )
}

export default function PracticePage() {
  const practice = useResource(getPractice)
  const { start, busy } = useStartGame()
  return (
    <div className={styles.page}>
      <PageHeader
        back={{ to: '/play', label: 'Play' }}
        eyebrow="Endless"
        title="Practice Arena"
        subtitle="Replay any market as often as you like."
      />
      <ResourceView resource={practice} label="Loading practice markets…">
        {({ scenarios }) =>
          scenarios.length ? (
            <ul className={styles.practiceGrid}>
              {scenarios.map((scenario) => (
                <PracticeCard
                  key={scenario.id}
                  scenario={scenario}
                  busy={!!busy}
                  onStart={() =>
                    void start(
                      { mode: 'practice', scenario_id: scenario.id },
                      { key: scenario.id, scenarioId: scenario.id },
                    )
                  }
                />
              ))}
            </ul>
          ) : (
            <EmptyState icon="infinity" title="No practice markets yet" />
          )
        }
      </ResourceView>
    </div>
  )
}
