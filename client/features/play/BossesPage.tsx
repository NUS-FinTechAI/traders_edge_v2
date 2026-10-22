import { getBosses, type BossEntry } from '../../services/dailyService.ts'
import Button from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import Emblem from '../../ui/Emblem.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState } from '../../ui/States.tsx'
import useResource from '../../ui/useResource.ts'
import useStartGame from './useStartGame.ts'
import styles from './Play.module.css'

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

export default function BossesPage() {
  const bosses = useResource(getBosses)
  const { start, busy } = useStartGame()
  return (
    <div className={styles.page}>
      <PageHeader
        back={{ to: '/play', label: 'Play' }}
        eyebrow="By chapter"
        title="Boss Battles"
        subtitle="Bosses open as you progress through each chapter. Rematch any boss you have beaten."
      />
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
    </div>
  )
}
