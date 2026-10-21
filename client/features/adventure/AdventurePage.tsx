import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import {
  getCampaign,
  type ChapterCard,
} from '../../services/campaignService.ts'
import Button from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import { chapterEmblem } from '../../ui/chapterEmblem.ts'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import Modal from '../../ui/Modal.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import useResource from '../../ui/useResource.ts'
import usePlayNow from '../home/usePlayNow.ts'
import useStartGame from '../play/useStartGame.ts'
import StarLegend from './StarLegend.tsx'
import styles from './Adventure.module.css'

/** One muted accent per chapter so each region reads apart, even locked. */
const ACCENTS = [
  '#3f8f6a',
  '#c08a3e',
  '#4f86a3',
  '#b5523f',
  '#8a6fc4',
  '#5f9e8f',
  '#b0884a',
  '#9a5f7a',
]

function accent(number: number): string {
  return ACCENTS[(Math.max(1, number) - 1) % ACCENTS.length]
}

function StateBadge({ chapter }: { chapter: ChapterCard }) {
  if (chapter.state === 'complete')
    return (
      <Chip tone="gain" icon="check">
        Complete
      </Chip>
    )
  if (chapter.state === 'locked') return <Chip icon="lock">Locked</Chip>
  return (
    <Chip tone="gold" icon="compass">
      {chapter.stars > 0 || chapter.levels_done > 0 ? 'In progress' : 'Open'}
    </Chip>
  )
}

function ChapterTile({
  chapter,
  readOnly,
  canGate,
  onGate,
}: {
  chapter: ChapterCard
  readOnly: boolean
  canGate: boolean
  onGate: (chapter: ChapterCard) => void
}) {
  const locked = chapter.state === 'locked'
  const emblem = chapterEmblem(chapter.icon, chapter.number)
  const tone =
    chapter.state === 'complete' ? 'green' : locked ? 'neutral' : 'gold'
  const titleId = `chapter-${chapter.id}`
  const body = (
    <>
      <div
        className={styles.tileArt}
        style={{ '--accent': accent(chapter.number) } as CSSProperties}
      >
        <Emblem name={emblem} tone={tone} size={84} shape="none" />
        <span className={styles.tileBadge}>
          <StateBadge chapter={chapter} />
        </span>
      </div>
      <div className={styles.tileBody}>
        <p className={styles.eyebrow}>Chapter {chapter.number}</p>
        <h2 id={titleId} className={styles.tileTitle}>
          {chapter.title}
        </h2>
        <p className={styles.region}>
          <Icon name="map" size={16} />
          {chapter.region}
        </p>
        {chapter.tagline && <p className={styles.tagline}>{chapter.tagline}</p>}
      </div>
    </>
  )
  const progress = (
    <div className={styles.tileFoot}>
      <div className={styles.starCount}>
        <Icon name="star" size={18} filled className={styles.starIcon} />
        <span className="num">
          {chapter.stars} / {chapter.stars_total}
        </span>
        <span className={styles.levels}>
          {chapter.levels_done} / {chapter.levels_total} levels
        </span>
      </div>
      <ProgressBar
        value={chapter.stars}
        max={chapter.stars_total}
        tone="gold"
        label={`Chapter ${chapter.number} stars`}
        valueText={`${chapter.stars} of ${chapter.stars_total} stars`}
      />
    </div>
  )

  if (!locked && !readOnly)
    return (
      <li className={styles.tile}>
        <Link
          to={`/adventure/${encodeURIComponent(chapter.id)}`}
          className={styles.tileLink}
          aria-labelledby={titleId}
        >
          {body}
          {progress}
        </Link>
      </li>
    )

  return (
    <li className={`${styles.tile} ${locked ? styles.tileLocked : ''}`}>
      <div className={styles.tileStatic}>
        {body}
        {progress}
        {locked && (
          <div className={styles.lockBox}>
            <p className={styles.lockReason}>
              <Icon name="lock" size={16} />
              Win the Chapter {chapter.number - 1} boss to unlock
            </p>
            {chapter.gate && canGate && (
              <button
                type="button"
                className={styles.gateLink}
                aria-label={`Beat the Chapter ${chapter.number} Gate Boss`}
                onClick={() => onGate(chapter)}
              >
                <Icon name="shield" size={16} />
                Skip ahead: Gate Boss
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export default function AdventurePage() {
  const { status } = useAuth()
  // The campaign is public: signed-out visitors see chapter 1 open.
  const resource = useResource(getCampaign, [status])
  const preview = status !== 'signed-in'
  const [gate, setGate] = useState<ChapterCard | null>(null)
  const { start, busy } = useStartGame()
  const { playNow, busy: joining } = usePlayNow()

  return (
    <div>
      <PageHeader
        title="Adventure"
        subtitle="Choose a chapter and begin your trading journey."
        actions={<StarLegend />}
      />
      <ResourceView resource={resource} label="Unrolling the map…">
        {(campaign) => (
          <>
            {preview && status !== 'loading' && (
              <div className={styles.preview}>
                <Emblem name="compass" size={48} tone="green" shape="circle" />
                <p>
                  <strong>Chapter 1 is open.</strong> Play now to earn stars and
                  save your progress.
                </p>
                <Button
                  icon="play"
                  disabled={joining}
                  onClick={() => void playNow()}
                >
                  Play now
                </Button>
              </div>
            )}
            <ul className={styles.grid}>
              {campaign.chapters.map((chapter) => (
                <ChapterTile
                  key={chapter.id}
                  chapter={chapter}
                  readOnly={preview}
                  canGate={!preview}
                  onGate={setGate}
                />
              ))}
            </ul>
          </>
        )}
      </ResourceView>
      <Modal
        open={!!gate}
        title="Take on the Gate Boss?"
        onClose={() => setGate(null)}
      >
        {gate && (
          <div className={styles.gate}>
            <Emblem name="shield" size={72} tone="flame" />
            <p className={styles.gateLead}>
              New to trading? We recommend playing chapters in order — the Gate
              is tough!
            </p>
            <p className={styles.muted}>
              Win to open Chapter {gate.number}: {gate.title} right away.
              {gate.gate && gate.gate.attempts > 0
                ? ` Attempts so far: ${gate.gate.attempts}.`
                : ''}
            </p>
            <div className={styles.gateActions}>
              <Button variant="ghost" onClick={() => setGate(null)}>
                Not now
              </Button>
              <Button
                icon="swords"
                disabled={!!busy}
                onClick={() =>
                  void start(
                    { mode: 'boss', chapter_id: gate.id, boss: 'gate' },
                    { scenarioId: gate.gate?.scenario_id },
                  )
                }
              >
                {busy ? 'Starting…' : 'Start Gate battle'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
