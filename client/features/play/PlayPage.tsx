import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  getBosses,
  getDaily,
  getPractice,
  type BossEntry,
  type PracticeScenario,
} from '../../services/dailyService.ts'
import Avatar from '../../ui/Avatar.tsx'
import Button from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState, SectionHeader } from '../../ui/States.tsx'
import useResource from '../../ui/useResource.ts'
import DailyCard from './DailyCard.tsx'
import ResumeMatches from './ResumeMatches.tsx'
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
      <Button variant="secondary" icon="play" disabled={busy} onClick={onStart}>
        Start
      </Button>
    </li>
  )
}

const BOSS_KIND = { boss: 'Chapter boss', gate: 'Gate boss' } as const

function BossChapter({
  chapterId,
  bosses,
  busy,
  onStart,
}: {
  chapterId: string
  bosses: BossEntry[]
  busy: boolean
  onStart: (boss: BossEntry) => void
}) {
  const number = Number(chapterId.replace(/\D/g, '')) || null
  const ordered = [...bosses].sort(
    (a, b) => Number(a.kind === 'gate') - Number(b.kind === 'gate'),
  )
  return (
    <li className={styles.bossChapter}>
      <h3 className={styles.bossChapterTitle}>
        {number ? `Chapter ${number}` : chapterId}
      </h3>
      <ul className={styles.bossPair}>
        {ordered.map((boss) => {
          const locked = boss.state === 'locked'
          const kind = BOSS_KIND[boss.kind]
          return (
            <li key={boss.kind} className={styles.boss}>
              <Emblem
                name={boss.kind === 'gate' ? 'shield' : 'crown'}
                size={44}
                shape="circle"
                tone={boss.won ? 'green' : locked ? 'neutral' : 'gold'}
              />
              <div className={styles.bossText}>
                <span className={styles.bossKind}>{kind}</span>
                <strong>{boss.title}</strong>
              </div>
              <div className={styles.bossActions}>
                {boss.won ? (
                  <Chip tone="gain" icon="check">
                    Won
                  </Chip>
                ) : locked ? (
                  <Chip icon="lock">Locked</Chip>
                ) : null}
                {!locked && (
                  <Button
                    variant={boss.won ? 'ghost' : 'primary'}
                    icon="swords"
                    disabled={busy}
                    onClick={() => onStart(boss)}
                    aria-label={`${boss.won ? 'Rematch' : 'Battle'} ${kind}: ${boss.title}`}
                  >
                    {boss.won ? 'Rematch' : 'Battle'}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

function byChapter(bosses: BossEntry[]): [string, BossEntry[]][] {
  const groups = new Map<string, BossEntry[]>()
  for (const boss of bosses)
    groups.set(boss.chapter_id, [...(groups.get(boss.chapter_id) ?? []), boss])
  return [...groups]
}

export default function PlayPage() {
  const daily = useResource(getDaily)
  const practice = useResource(getPractice)
  const bosses = useResource(getBosses)
  const { start, busy } = useStartGame()
  const { hash } = useLocation()
  const practiceReady = practice.status === 'ready'

  useEffect(() => {
    if (hash === '#practice' && practiceReady)
      document.getElementById('practice')?.scrollIntoView()
  }, [hash, practiceReady])

  return (
    <div className={styles.page}>
      <PageHeader
        title="Play"
        subtitle="Pick a challenge. Profit decides the match; your missions show what you learned."
      />

      <ResumeMatches />

      <section aria-label="Daily challenge">
        <ResourceView resource={daily} label="Loading the daily…">
          {(data) => (
            <DailyCard
              daily={data}
              onChange={daily.reload}
              onReload={daily.reload}
              full
            />
          )}
        </ResourceView>
      </section>

      <div className={styles.entries}>
        <Link to="/multiplayer" className={styles.entry}>
          <Emblem name="users" size={56} tone="info" />
          <span className={styles.entryText}>
            <strong>Multiplayer</strong>
            <span className={styles.muted}>Lobbies and ranked matches</span>
          </span>
          <Icon name="chevron-right" />
        </Link>
        <Link to="/leaderboard" className={styles.entry}>
          <Emblem name="podium" size={56} tone="gold" />
          <span className={styles.entryText}>
            <strong>Leaderboard</strong>
            <span className={styles.muted}>See where you rank</span>
          </span>
          <Icon name="chevron-right" />
        </Link>
      </div>

      <section id="practice" aria-label="Practice Arena">
        <SectionHeader title="Practice Arena" eyebrow="Endless" />
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
      </section>

      <section aria-label="Boss battles">
        <SectionHeader title="Boss battles" eyebrow="By chapter" />
        <ResourceView resource={bosses} label="Loading bosses…">
          {(data) =>
            data.bosses.length ? (
              <ul className={styles.bosses}>
                {byChapter(data.bosses).map(([chapterId, pair]) => (
                  <BossChapter
                    key={chapterId}
                    chapterId={chapterId}
                    bosses={pair}
                    busy={!!busy}
                    onStart={(boss) =>
                      void start(
                        {
                          mode: 'boss',
                          chapter_id: boss.chapter_id,
                          boss: boss.kind === 'gate' ? 'gate' : 'final',
                        },
                        { scenarioId: boss.scenario_id },
                      )
                    }
                  />
                ))}
              </ul>
            ) : (
              <EmptyState icon="crown" title="No bosses yet">
                Finish a chapter’s levels to face its boss.
              </EmptyState>
            )
          }
        </ResourceView>
      </section>
    </div>
  )
}
