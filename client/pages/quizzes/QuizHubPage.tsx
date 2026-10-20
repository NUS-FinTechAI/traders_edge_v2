import { useQuizCommands, useQuizRead } from './useQuizState.ts'
import { useCallback, useId, useState, type FormEvent } from 'react'
import { Link, useLoaderData, useNavigate } from 'react-router-dom'
import type { UserProfile } from '../../services/authService.ts'
import {
  getQuizBank,
  listQuizAttempts,
  listQuizForms,
  listQuizRooms,
  resumableQuiz,
  type QuizCommandResult,
} from '../../services/quizService.ts'
import {
  QuizCommandNotice,
  QuizFrame,
  QuizReadError,
  QuizOwnerGate,
} from './QuizShared.tsx'

function InstructorCreate({
  owner,
  disabled,
  create,
  titles,
}: {
  owner: string
  disabled: boolean
  create: (title: string, questions: string[], limit: number) => void
  titles: Record<string, string>
}) {
  const load = useCallback((signal: AbortSignal) => getQuizBank(signal), [])
  const { state, reload } = useQuizRead(owner, load)
  const [selected, setSelected] = useState<string[]>([])
  const [module, setModule] = useState('')
  const prefix = useId()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    create(
      String(data.get('title')).trim(),
      selected,
      Number(data.get('attempt_limit')),
    )
  }
  if (state.status === 'loading')
    return <p role="status">Loading the instructor question bank…</p>
  if (state.status === 'error')
    return <QuizReadError error={state.error} reload={reload} />
  const questions = state.data.questions
  const modules = [...new Set(questions.map((question) => question.module_id))]
  return (
    <form onSubmit={submit}>
      <fieldset disabled={disabled}>
        <legend>Create a private classroom quiz</legend>
        <label htmlFor={`${prefix}-title`}>Classroom title</label>
        <input
          id={`${prefix}-title`}
          name="title"
          minLength={2}
          maxLength={80}
          required
        />
        <label htmlFor={`${prefix}-limit`}>Attempts per student</label>
        <select id={`${prefix}-limit`} name="attempt_limit" defaultValue="1">
          {[1, 2, 3].map((limit) => (
            <option key={limit} value={limit}>
              {limit}
            </option>
          ))}
        </select>
        <label htmlFor={`${prefix}-module`}>Question group</label>
        <select
          id={`${prefix}-module`}
          value={module}
          onChange={(event) => setModule(event.target.value)}
        >
          <option value="">All modules</option>
          {modules.map((id) => (
            <option value={id} key={id}>
              {titles[id] ?? 'Question group'}
            </option>
          ))}
        </select>
        <p role="status" aria-atomic="true">
          {selected.length} of 20 questions selected. Select at least one.
          Questions stay in selection order.
        </p>
        <details>
          <summary>Choose questions</summary>
          <div className="quiz-options">
            {questions
              .filter((question) => !module || question.module_id === module)
              .map((question) => (
                <label className="quiz-option" key={question.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(question.id)}
                    disabled={
                      !selected.includes(question.id) && selected.length >= 20
                    }
                    onChange={(event) =>
                      setSelected((values) =>
                        event.target.checked
                          ? [...values, question.id]
                          : values.filter((value) => value !== question.id),
                      )
                    }
                  />
                  <span>
                    {question.prompt}
                    <br />
                    Options:{' '}
                    {question.options.map((option) => option.text).join(' · ')}
                  </span>
                </label>
              ))}
          </div>
        </details>
        {selected.length > 0 && (
          <p>
            Selected:{' '}
            {selected
              .map(
                (id) =>
                  questions.find((question) => question.id === id)?.prompt,
              )
              .join(' · ')}
          </p>
        )}
        <button type="submit" disabled={selected.length === 0}>
          Create classroom
        </button>
      </fieldset>
    </form>
  )
}

function HubContent({ owner }: { owner: string }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const [forms, attempts, rooms] = await Promise.all([
      listQuizForms(signal),
      listQuizAttempts(signal),
      listQuizRooms(signal),
    ])
    return { forms, attempts: attempts.attempts, rooms: rooms.rooms }
  }, [])
  const { state, reload } = useQuizRead(owner, load)
  const commands = useQuizCommands(owner)
  const navigate = useNavigate()
  const prefix = useId()
  function accept(result: QuizCommandResult | null) {
    if (!result) return
    navigate(
      result.kind === 'attempt'
        ? `/quizzes/attempts/${encodeURIComponent(result.attempt.id)}`
        : `/quizzes/rooms/${encodeURIComponent(result.room.id)}`,
    )
  }
  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('code'))
      .trim()
      .toUpperCase()
    void commands.perform({ kind: 'join-room', code }).then(accept)
  }
  const resumeId = resumableQuiz(commands.error)
  return (
    <QuizFrame title="Quizzes and classrooms">
      <p>
        Practise terminology and concepts in a standalone quiz, or join your
        instructor’s private classroom. Answers freeze when submitted; feedback
        appears when the full quiz ends.
      </p>
      <nav aria-label="Quiz sections">
        <a href="#quiz-classroom-join">Join a classroom</a>
        <a href="#quiz-saved-attempts">Saved attempts</a>
        <a href="#quiz-saved-rooms">Your classrooms</a>
        {state.status === 'ready' && state.data.forms.instructor_authorized && (
          <a href="#quiz-instructor">Create classroom</a>
        )}
      </nav>
      <QuizCommandNotice
        commands={commands}
        recover={() => {
          void commands.perform().then(accept)
        }}
      />
      {resumeId && (
        <Link to={`/quizzes/attempts/${encodeURIComponent(resumeId)}`}>
          Resume the existing quiz attempt
        </Link>
      )}
      <button disabled={commands.busy} onClick={reload}>
        Refresh quizzes and rooms
      </button>
      {state.status === 'loading' ? (
        <p role="status">
          Loading available quizzes and your saved activities…
        </p>
      ) : state.status === 'error' ? (
        <QuizReadError error={state.error} reload={reload} />
      ) : (
        <>
          <section className="quiz-section" id="quiz-standalone">
            <h2>Standalone quizzes</h2>
            <p>
              Passing awards player XP once per form and edition. It does not
              pass adventure levels, create learning activity days or change
              multiplayer rating.
            </p>
            <ul className="quiz-form-list">
              {state.data.forms.forms.map((form) => (
                <li key={form.module_id}>
                  <h3>{form.title}</h3>
                  <p>
                    {form.question_count} questions · up to {form.attempt_limit}{' '}
                    attempts · {form.pass_rule}
                  </p>
                  <p>First pass: {form.passing_xp} player XP.</p>
                  <button
                    disabled={commands.disabled}
                    onClick={() => {
                      void commands
                        .perform({ kind: 'start', moduleId: form.module_id })
                        .then(accept)
                    }}
                  >
                    Start {form.title} quiz
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="quiz-section" id="quiz-classroom-join">
            <h2>Join a classroom</h2>
            <p>
              Private quizzes award no XP, currency or rating. Join while the
              instructor’s room is waiting.
            </p>
            <form onSubmit={join}>
              <fieldset disabled={commands.disabled}>
                <legend>Instructor’s eight-character code</legend>
                <label htmlFor={`${prefix}-code`}>Classroom join code</label>
                <input
                  id={`${prefix}-code`}
                  name="code"
                  minLength={8}
                  maxLength={8}
                  pattern="[A-Za-z2-9]{8}"
                  autoCapitalize="characters"
                  autoComplete="off"
                  required
                />
                <div className="quiz-actions">
                  <button type="submit">Join classroom</button>
                </div>
              </fieldset>
            </form>
          </section>
          <section className="quiz-section" id="quiz-saved-attempts">
            <h2>Your recent attempts</h2>
            {state.data.attempts.length ? (
              <ul className="quiz-record-list">
                {state.data.attempts.map((attempt) => (
                  <li key={attempt.id}>
                    <Link
                      to={`/quizzes/attempts/${encodeURIComponent(attempt.id)}`}
                    >
                      {attempt.status === 'active' ? 'Resume' : 'View result'}:{' '}
                      {attempt.title ??
                        (attempt.room_id
                          ? 'Classroom quiz'
                          : 'Standalone quiz')}{' '}
                      · Attempt {attempt.attempt_number}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No quiz attempts yet.</p>
            )}
            <p>The latest 50 saved attempts are listed.</p>
          </section>
          <section className="quiz-section" id="quiz-saved-rooms">
            <h2>Your classrooms</h2>
            {state.data.rooms.length ? (
              <ul className="quiz-record-list">
                {state.data.rooms.map((room) => (
                  <li key={room.id}>
                    <Link to={`/quizzes/rooms/${encodeURIComponent(room.id)}`}>
                      {room.title} · {room.status}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>You have not joined or created a classroom.</p>
            )}
          </section>
          {state.data.forms.instructor_authorized && (
            <section className="quiz-section" id="quiz-instructor">
              <h2>Instructor classroom tools</h2>
              <p>
                Your account has instructor access. Choose one to twenty
                questions; the host does not participate as a student.
              </p>
              <InstructorCreate
                owner={owner}
                titles={Object.fromEntries(
                  state.data.forms.forms.map((form) => [
                    form.module_id,
                    form.title,
                  ]),
                )}
                disabled={commands.disabled}
                create={(title, question_ids, attempt_limit) => {
                  void commands
                    .perform({
                      kind: 'create-room',
                      input: { title, question_ids, attempt_limit },
                    })
                    .then(accept)
                }}
              />
            </section>
          )}
        </>
      )}
    </QuizFrame>
  )
}

export default function QuizHubPage() {
  const user = useLoaderData<UserProfile>()
  return (
    <QuizOwnerGate owner={user.id}>
      <HubContent key={user.id} owner={user.id} />
    </QuizOwnerGate>
  )
}
