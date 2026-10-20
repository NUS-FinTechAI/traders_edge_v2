import { useQuizCommands, useQuizRead } from './useQuizState.ts'
import { useCallback } from 'react'
import { Link, useLoaderData, useNavigate, useParams } from 'react-router-dom'
import type { UserProfile } from '../../services/authService.ts'
import {
  getQuizReport,
  getQuizRoom,
  listQuizAttempts,
  resumableQuiz,
  type QuizCommandResult,
  type QuizReport,
} from '../../services/quizService.ts'
import {
  QuizCommandNotice,
  QuizFeedbackList,
  QuizFrame,
  QuizReadError,
  QuizOwnerGate,
} from './QuizShared.tsx'

function RoomContent({ owner, roomId }: { owner: string; roomId: string }) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [room, attempts] = await Promise.all([
        getQuizRoom(roomId, signal),
        listQuizAttempts(signal),
      ])
      let report: QuizReport | null = null
      let reportError: unknown = null
      if (room.can_manage === true) {
        try {
          report = await getQuizReport(roomId, signal)
        } catch (error) {
          reportError = error
        }
      }
      return {
        room,
        attempts: attempts.attempts.filter(
          (attempt) => attempt.room_id === roomId,
        ),
        report,
        reportError,
      }
    },
    [roomId],
  )
  const { state, reload } = useQuizRead(owner, load)
  const commands = useQuizCommands(owner)
  const navigate = useNavigate()
  function accept(result: QuizCommandResult | null) {
    if (!result) return
    if (result.kind === 'attempt')
      navigate(`/quizzes/attempts/${encodeURIComponent(result.attempt.id)}`)
    else if (result.room.id !== roomId)
      navigate(`/quizzes/rooms/${encodeURIComponent(result.room.id)}`)
    else reload()
  }
  const resumeId = resumableQuiz(commands.error)
  return (
    <QuizFrame
      title={
        state.status === 'ready' ? state.data.room.title : 'Private classroom'
      }
    >
      <QuizCommandNotice
        commands={commands}
        recover={() => {
          void commands.perform().then(accept)
        }}
      />
      {resumeId && (
        <Link to={`/quizzes/attempts/${encodeURIComponent(resumeId)}`}>
          Resume your existing classroom attempt
        </Link>
      )}
      <button disabled={commands.busy} onClick={reload}>
        Refresh classroom
      </button>
      {state.status === 'loading' ? (
        <p role="status">Loading the classroom and your saved attempts…</p>
      ) : state.status === 'error' ? (
        <QuizReadError error={state.error} reload={reload} />
      ) : (
        <>
          <section className="quiz-section">
            <h2>Classroom status</h2>
            <p role="status" aria-atomic="true">
              {state.data.room.status === 'waiting'
                ? 'Waiting for the instructor to start'
                : state.data.room.status === 'started'
                  ? 'Open for quiz answers'
                  : 'Closed — saved work is retained'}
            </p>
            <p>
              {state.data.room.question_count} questions · up to{' '}
              {state.data.room.attempt_limit} attempts per student ·{' '}
              {state.data.room.member_count} of {state.data.room.capacity}{' '}
              students joined
            </p>
            <p>
              Private classroom quizzes grant no XP, currency or rating.
              Submitted answers are final for each attempt, and feedback appears
              only after the full form.
            </p>
            {state.data.room.status === 'waiting' && (
              <>
                <p>Share this join code with your class:</p>
                <p className="quiz-code">
                  <strong>{state.data.room.join_code}</strong>
                </p>
                <p>
                  Students enter the code on quiz home. Refresh this room to see
                  when the instructor starts.
                </p>
              </>
            )}
            {state.data.room.host_id !== owner && (
              <>
                {state.data.attempts.find(
                  (attempt) => attempt.status === 'active',
                ) ? (
                  <p>
                    Resume your saved attempt below before starting another.
                  </p>
                ) : (
                  <button
                    disabled={
                      commands.disabled || state.data.room.status !== 'started'
                    }
                    onClick={() => {
                      void commands
                        .perform({ kind: 'room-attempt', roomId })
                        .then(accept)
                    }}
                  >
                    Start classroom quiz attempt
                  </button>
                )}
                <ul className="quiz-record-list">
                  {state.data.attempts.map((attempt) => (
                    <li key={attempt.id}>
                      <Link
                        to={`/quizzes/attempts/${encodeURIComponent(attempt.id)}`}
                      >
                        {attempt.status === 'active'
                          ? 'Resume saved answers'
                          : 'View completed result'}{' '}
                        · Attempt {attempt.attempt_number}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          {state.data.room.can_manage === true && (
            <section className="quiz-section">
              <h2>Instructor controls</h2>
              <p>
                At least one student must join before starting. Closing stops
                new attempts and answers. Partial progress and completed results
                are retained.
              </p>
              <div className="quiz-actions">
                {state.data.room.status === 'waiting' && (
                  <button
                    disabled={
                      commands.disabled || state.data.room.member_count === 0
                    }
                    onClick={() => {
                      void commands
                        .perform({ kind: 'start-room', roomId })
                        .then(accept)
                    }}
                  >
                    Start classroom for joined students
                  </button>
                )}
                {state.data.room.status !== 'closed' && (
                  <button
                    disabled={commands.disabled}
                    onClick={() => {
                      void commands
                        .perform({ kind: 'close-room', roomId })
                        .then(accept)
                    }}
                  >
                    Close classroom and stop answers
                  </button>
                )}
              </div>
            </section>
          )}
          {state.data.room.host_id === owner &&
            state.data.room.can_manage !== true && (
              <p className="quiz-notice">
                Instructor management access is not currently available for this
                account. Your classroom record remains visible.
              </p>
            )}
          {state.data.reportError !== null && (
            <QuizReadError error={state.data.reportError} reload={reload} />
          )}
          {state.data.report && (
            <section className="quiz-section">
              <h2>Private class report</h2>
              <p>
                This report covers students who joined this classroom. Active
                attempts disclose status only; completed attempts include frozen
                first answers and feedback. Quiz results are not trading
                competence measures.
              </p>
              {state.data.report.students.length === 0 ? (
                <p>No students have joined yet.</p>
              ) : (
                <ul className="quiz-record-list">
                  {state.data.report.students.map((student) => (
                    <li key={student.user_id}>
                      <h3>{student.display_name}</h3>
                      {student.attempts.length === 0 ? (
                        <p>No attempts started.</p>
                      ) : (
                        student.attempts.map((attempt) => (
                          <section key={attempt.id}>
                            <h4>
                              Attempt {attempt.attempt_number} ·{' '}
                              {attempt.status === 'active'
                                ? 'In progress; answers withheld'
                                : 'Completed'}
                            </h4>
                            {attempt.status === 'completed' &&
                              attempt.result && (
                                <details>
                                  <summary>
                                    Score {attempt.result.score}% ·{' '}
                                    {attempt.result.passed
                                      ? 'Passed'
                                      : 'Review needed'}{' '}
                                    · Show first answers
                                  </summary>
                                  <p>
                                    Player XP awarded:{' '}
                                    {attempt.result.xp_earned}. Private quizzes
                                    award zero.
                                  </p>
                                  <QuizFeedbackList
                                    result={attempt.result}
                                    questions={
                                      state.data.report?.questions ?? []
                                    }
                                  />
                                  <details>
                                    <summary>
                                      First-answer recording times
                                    </summary>
                                    <ul>
                                      {attempt.result.first_answers.map(
                                        (answer, index) => (
                                          <li key={answer.question_id}>
                                            Question {index + 1}:{' '}
                                            <time dateTime={answer.recorded_at}>
                                              {answer.recorded_at}
                                            </time>
                                          </li>
                                        ),
                                      )}
                                    </ul>
                                  </details>
                                </details>
                              )}
                          </section>
                        ))
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </QuizFrame>
  )
}

export default function QuizRoomPage() {
  const user = useLoaderData<UserProfile>()
  const { roomId = '' } = useParams()
  return (
    <QuizOwnerGate owner={user.id}>
      <RoomContent
        key={`${user.id}:${roomId}`}
        owner={user.id}
        roomId={roomId}
      />
    </QuizOwnerGate>
  )
}
