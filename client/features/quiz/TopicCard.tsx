import type { QuizTopic } from '../../services/quizService.ts'
import Button from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import Emblem, { type EmblemTone } from '../../ui/Emblem.tsx'
import type { EmblemName } from '../../ui/emblemArt.tsx'
import styles from './Quiz.module.css'

const KIND: Record<
  QuizTopic['kind'],
  { emblem: EmblemName; tone: EmblemTone; label: string }
> = {
  chapter: { emblem: 'book', tone: 'gem', label: 'Chapter quiz' },
  review: { emblem: 'calendar', tone: 'info', label: 'Daily review' },
  mixed: { emblem: 'infinity', tone: 'gold', label: 'Mixed mastery' },
}

/** How a locked chapter quiz opens, from its "ch3"-style id. */
function unlockHint(topic: QuizTopic): string {
  const number = /(\d+)/.exec(topic.id)?.[1]
  return number
    ? `Opens when Chapter ${number} unlocks on the Adventure map.`
    : 'Opens when its chapter unlocks on the Adventure map.'
}

export default function TopicCard({
  topic,
  busy,
  onStart,
}: {
  topic: QuizTopic
  busy: boolean
  onStart: () => void
}) {
  const look = KIND[topic.kind]
  return (
    <li
      className={[
        styles.topic,
        topic.kind !== 'chapter' && styles.featured,
        topic.locked && styles.topicLocked,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Emblem
        name={look.emblem}
        tone={topic.locked ? 'neutral' : look.tone}
        size={56}
      />
      <div className={styles.topicBody}>
        {look.label.toLowerCase() !== topic.title.toLowerCase() && (
          <p className={styles.topicKind}>{look.label}</p>
        )}
        <h3 className={styles.topicTitle}>{topic.title}</h3>
        <p className={styles.muted}>
          {topic.questions} questions
          {topic.best !== null && (
            <>
              {' '}
              · Best{' '}
              <span className="num">
                {topic.best}/{topic.questions}
              </span>
            </>
          )}
        </p>
      </div>
      <div className={styles.topicSide}>
        {topic.locked ? (
          <>
            <Chip icon="lock">Locked</Chip>
            <p className={styles.unlockHint}>{unlockHint(topic)}</p>
          </>
        ) : (
          <>
            {topic.passed && (
              <Chip tone="gain" icon="check">
                Passed
              </Chip>
            )}
            <Button
              variant={topic.passed ? 'secondary' : 'primary'}
              disabled={busy}
              onClick={onStart}
              aria-label={`Start ${topic.title}`}
            >
              {topic.best !== null ? 'Retry' : 'Start'}
            </Button>
          </>
        )}
      </div>
    </li>
  )
}
