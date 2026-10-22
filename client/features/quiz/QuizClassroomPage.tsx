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
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import Modal from '../../ui/Modal.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import { attemptPath } from './paths.ts'
import styles from './Quiz.module.css'

export default function QuizClassroomPage() {
  const navigate = useNavigate()
  const notify = useToast()
  const resource = useResource(getQuizzes)
  const [busy, setBusy] = useState<'join' | 'room' | null>(null)
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [roomTopic, setRoomTopic] = useState('')
  const [roomTitle, setRoomTitle] = useState('')

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

  function openCreate(topics: QuizTopic[]) {
    setRoomTopic(topics.find((topic) => !topic.locked)?.id ?? '')
    setCreating(true)
  }

  return (
    <div className={styles.hub}>
      <PageHeader
        back={{ to: '/quiz', label: 'Quiz' }}
        eyebrow="With your class"
        title="Classroom"
        subtitle="Join with a room code, or host a room and see everyone’s results."
      />
      <div className={styles.classGrid}>
        <form
          className={styles.classCard}
          onSubmit={(event) => void joinRoom(event)}
        >
          <h2 className={styles.topicTitle}>Join a class quiz</h2>
          <label>
            <span className="visually-hidden">Six-character room code</span>
            <input
              className={styles.codeInput}
              value={code}
              onChange={(event) => setCode(normalizeCode(event.target.value))}
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
          <h2 className={styles.topicTitle}>Teaching a class?</h2>
          <p className={styles.muted}>
            Make a room, share its code and see everyone’s results.
          </p>
          <Button
            variant="secondary"
            icon="plus"
            block
            disabled={!resource.data}
            onClick={() => openCreate(resource.data?.topics ?? [])}
          >
            Create a room
          </Button>
        </div>
      </div>
      <ResourceView resource={resource} label="Loading your rooms…">
        {({ topics, rooms }) => (
          <>
            {rooms.length > 0 && (
              <section className={styles.classroom} aria-labelledby="rooms">
                <h2 id="rooms" className={styles.topicTitle}>
                  Your rooms
                </h2>
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
              </section>
            )}
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
        )}
      </ResourceView>
      <p className={styles.note}>
        <Icon name="info" size={16} />
        Classroom quizzes give no XP.
      </p>
    </div>
  )
}
