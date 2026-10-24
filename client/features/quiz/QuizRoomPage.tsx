import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getRoom,
  startAttempt,
  type QuizRoom,
} from '../../services/quizService.ts'
import Button from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import CopyButton from '../../ui/CopyButton.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState } from '../../ui/States.tsx'
import { usePolling } from '../../ui/hooks.ts'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import { attemptPath } from './paths.ts'
import styles from './Quiz.module.css'

function Room({ room }: { room: QuizRoom }) {
  const navigate = useNavigate()
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const mine = room.is_host ? null : room.results[0]

  async function take() {
    if (room.my_attempt_id) {
      void navigate(attemptPath(room.my_attempt_id))
      return
    }
    setBusy(true)
    try {
      const attempt = await startAttempt({ room_code: room.code })
      void navigate(attemptPath(attempt.id))
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(false)
    }
  }

  const finished = room.results.filter((row) => row.finished).length

  return (
    <div className={styles.roomLayout}>
      <section className={styles.roomCode} aria-labelledby="room-code-label">
        <p id="room-code-label" className={styles.codeLabel}>
          Room code
        </p>
        <p className={styles.bigCode}>{room.code}</p>
        <CopyButton text={room.code} />
        <p className={styles.muted}>
          {room.members} {room.members === 1 ? 'member' : 'members'} · Students
          join from Quiz → Classroom.
        </p>
      </section>

      <section className={styles.roomQuiz} aria-labelledby="room-quiz-title">
        <Emblem name="book" size={56} tone="gem" />
        <div className={styles.roomQuizText}>
          <p className={styles.topicKind}>Quiz</p>
          <h2 id="room-quiz-title" className={styles.topicTitle}>
            {room.topic_title}
          </h2>
          {mine && (
            <p className={styles.muted}>
              {mine.finished
                ? `Finished · ${mine.score ?? 0}/${mine.total}`
                : 'Not finished yet'}
            </p>
          )}
        </div>
        <Button
          size="lg"
          icon="play"
          disabled={busy}
          onClick={() => void take()}
        >
          {room.my_attempt_id
            ? mine?.finished
              ? 'See my results'
              : 'Continue'
            : 'Take the quiz'}
        </Button>
      </section>

      {room.is_host && (
        <section className={styles.results} aria-labelledby="results-title">
          <div className={styles.resultsHead}>
            <h2 id="results-title" className={styles.topicTitle}>
              Results
            </h2>
            <span className={styles.muted}>
              {finished} of {room.results.length} finished · updates every few
              seconds
            </span>
          </div>
          {room.results.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Score</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {room.results.map((row, index) => (
                    <tr key={`${row.name}-${index}`}>
                      <th scope="row">{row.name}</th>
                      <td className="num">
                        {row.score === null ? '-' : `${row.score}/${row.total}`}
                      </td>
                      <td>
                        {row.finished ? (
                          <Chip tone="gain" icon="check">
                            Finished
                          </Chip>
                        ) : (
                          <Chip icon="clock">In progress</Chip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="users" title="No one has joined yet">
              Share the room code to get started.
            </EmptyState>
          )}
        </section>
      )}
      <p className={styles.note}>
        <Icon name="info" size={16} />
        Classroom quizzes give no XP.
      </p>
    </div>
  )
}

export default function QuizRoomPage() {
  const { roomId = '' } = useParams()
  const resource = useResource((signal) => getRoom(roomId, signal), [roomId])
  usePolling(resource.reload, 5000, !!resource.data?.is_host)
  return (
    <div>
      <PageHeader
        back={{ to: '/quiz/classroom', label: 'Classroom' }}
        eyebrow="Classroom"
        title={resource.data?.title ?? 'Class room'}
      />
      <ResourceView resource={resource} label="Opening the room…">
        {(room) => <Room room={room} />}
      </ResourceView>
    </div>
  )
}
