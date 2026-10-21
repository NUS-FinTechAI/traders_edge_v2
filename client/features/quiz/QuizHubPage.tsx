import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { normalizeCode } from '../../services/lobbyService.ts'
import {
  createRoom,
  getQuizzes,
  startAttempt,
  type QuizTopic,
} from '../../services/quizService.ts'
import Button from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import Emblem, { type EmblemTone } from '../../ui/Emblem.tsx'
import type { EmblemName } from '../../ui/emblemArt.tsx'
import Icon from '../../ui/Icon.tsx'
import Modal from '../../ui/Modal.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState, SectionHeader } from '../../ui/States.tsx'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import { attemptPath } from './paths.ts'
import styles from './Quiz.module.css'

const KIND: Record<
  QuizTopic['kind'],
  { emblem: EmblemName; tone: EmblemTone; label: string }
> = {
  chapter: { emblem: 'book', tone: 'gem', label: 'Chapter quiz' },
  review: { emblem: 'calendar', tone: 'info', label: 'Daily review' },
  mixed: { emblem: 'infinity', tone: 'gold', label: 'Mixed mastery' },
}

function TopicCard({
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
          <Chip icon="lock">Locked</Chip>
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

export default function QuizHubPage() {
  const navigate = useNavigate()
  const notify = useToast()
  const resource = useResource(getQuizzes)
  const [busy, setBusy] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [roomTopic, setRoomTopic] = useState('')
  const [roomTitle, setRoomTitle] = useState('')

  async function begin(topicId: string) {
    setBusy(topicId)
    try {
      const attempt = await startAttempt({ topic_id: topicId })
      void navigate(attemptPath(attempt.id, topicId))
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(null)
    }
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (code.length !== 6) return
    setBusy('join')
    try {
      const attempt = await startAttempt({ room_code: code })
      void navigate(attemptPath(attempt.id))
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(null)
    }
  }

  async function makeRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('room')
    try {
      const room = await createRoom(roomTopic, roomTitle.trim())
      void navigate(`/quiz/room/${encodeURIComponent(room.id)}`)
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(null)
    }
  }

  return (
    <div className={styles.hub}>
      <PageHeader
        title="Quiz"
        subtitle="Test what you know. No timers, retry any time."
      />
      <ResourceView resource={resource} label="Loading quizzes…">
        {({ topics, rooms }) => {
          const featured = topics.filter((topic) => topic.kind !== 'chapter')
          const chapters = topics.filter((topic) => topic.kind === 'chapter')
          const open = topics.filter((topic) => !topic.locked)
          return (
            <>
              {featured.length > 0 && (
                <ul className={styles.featuredGrid}>
                  {featured.map((topic) => (
                    <TopicCard
                      key={topic.id}
                      topic={topic}
                      busy={!!busy}
                      onStart={() => void begin(topic.id)}
                    />
                  ))}
                </ul>
              )}
              <section aria-label="Chapter quizzes">
                <SectionHeader title="Chapter quizzes" eyebrow="Pass at 80%" />
                {chapters.length ? (
                  <ul className={styles.topics}>
                    {chapters.map((topic) => (
                      <TopicCard
                        key={topic.id}
                        topic={topic}
                        busy={!!busy}
                        onStart={() => void begin(topic.id)}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon="quiz" title="No chapter quizzes yet" />
                )}
              </section>

              <section className={styles.classroom} aria-label="Classroom">
                <SectionHeader title="Classroom" eyebrow="With your class" />
                <div className={styles.classGrid}>
                  <form
                    className={styles.classCard}
                    onSubmit={(event) => void joinRoom(event)}
                  >
                    <h3 className={styles.topicTitle}>Join a class quiz</h3>
                    <label>
                      <span className="visually-hidden">
                        Six-character room code
                      </span>
                      <input
                        className={styles.codeInput}
                        value={code}
                        onChange={(event) =>
                          setCode(normalizeCode(event.target.value))
                        }
                        placeholder="ROOM42"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        maxLength={6}
                      />
                    </label>
                    <Button
                      type="submit"
                      variant="secondary"
                      block
                      disabled={code.length !== 6 || !!busy}
                    >
                      {busy === 'join' ? 'Joining…' : 'Join'}
                    </Button>
                  </form>
                  <div className={styles.classCard}>
                    <h3 className={styles.topicTitle}>Teaching a class?</h3>
                    <p className={styles.muted}>
                      Make a room, share its code and see everyone’s results.
                    </p>
                    <Button
                      variant="secondary"
                      icon="plus"
                      block
                      onClick={() => {
                        setRoomTopic(open[0]?.id ?? '')
                        setCreating(true)
                      }}
                    >
                      Create a room
                    </Button>
                  </div>
                </div>
                {rooms.length > 0 && (
                  <ul className={styles.rooms}>
                    {rooms.map((room) => (
                      <li key={room.id}>
                        <Link
                          to={`/quiz/room/${encodeURIComponent(room.id)}`}
                          className={styles.room}
                        >
                          <Emblem name="users" size={44} tone="info" />
                          <span className={styles.roomText}>
                            <strong>{room.title}</strong>
                            <span className={styles.muted}>
                              Code <span className="num">{room.code}</span> ·{' '}
                              {room.members}{' '}
                              {room.members === 1 ? 'member' : 'members'}
                            </span>
                          </span>
                          {room.is_host && <Chip tone="gold">Host</Chip>}
                          <Icon name="chevron-right" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <p className={styles.note}>
                  <Icon name="info" size={16} />
                  Classroom quizzes give no XP.
                </p>
              </section>

              <Modal
                open={creating}
                title="Create a class room"
                onClose={() => setCreating(false)}
              >
                <form
                  className={styles.form}
                  onSubmit={(event) => void makeRoom(event)}
                >
                  <label className={styles.field}>
                    <span>Room name</span>
                    <input
                      required
                      maxLength={80}
                      value={roomTitle}
                      placeholder="e.g. Period 3 · Market basics"
                      onChange={(event) => setRoomTitle(event.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Quiz</span>
                    <select
                      required
                      value={roomTopic}
                      onChange={(event) => setRoomTopic(event.target.value)}
                    >
                      {topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="submit"
                    size="lg"
                    block
                    disabled={!roomTitle.trim() || !roomTopic || !!busy}
                  >
                    {busy === 'room' ? 'Creating…' : 'Create room'}
                  </Button>
                </form>
              </Modal>
            </>
          )
        }}
      </ResourceView>
    </div>
  )
}
