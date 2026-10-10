import { useResource, dateLabel } from '../hooks'
import type {
  Curriculum,
  LessonResponse,
  Module,
  Profile,
  Question,
  Review,
} from '../api'
import { Assessment } from '../components/Assessment'
import {
  Fox,
  Notice,
  PageTitle,
  ResourceState,
  Sources,
} from '../components/ui'

export function Dashboard({
  profile,
  curriculum,
}: {
  profile: Profile
  curriculum: Curriculum
}) {
  const active = curriculum.modules.find(
    (module) => module.unlocked && !module.mastered,
  )
  const next = active?.lessons.find((lesson) => !lesson.completed)
  const href = next
    ? `#/lesson/${next.id}`
    : active?.assessment_available
      ? `#/assessment/${active.id}`
      : '#/path'
  return (
    <div className="dashboard-layout">
      <section className="today-entry">
        <p className="eyebrow">
          {active
            ? `Module ${active.order} · ${active.title}`
            : 'Your learning'}
        </p>
        <h1 tabIndex={-1}>
          {next?.title ||
            (active
              ? 'Bring your learning together'
              : 'Keep your reasoning fresh')}
        </h1>
        <p className="intro">
          {next?.objective ||
            (active
              ? 'Apply this module to a new situation in its mastery check.'
              : 'Return to a lesson or use a delayed review to revisit what you know.')}
        </p>
        <a className="button" href={href}>
          {next
            ? profile.completed_lesson_ids.length
              ? 'Continue learning'
              : 'Start learning'
            : active
              ? 'Start the mastery check'
              : 'View learning path'}{' '}
          →
        </a>
        <Fox>
          Take time to explain the decision. A useful reason matters more than a
          quick answer.
        </Fox>
        {profile.due_review_count > 0 && (
          <Notice>
            <p>
              {profile.due_review_count} delayed{' '}
              {profile.due_review_count === 1 ? 'review is' : 'reviews are'}{' '}
              ready.
            </p>
            <a href="#/reviews">Review what you learned →</a>
          </Notice>
        )}
      </section>
      <aside className="learning-summary">
        <section>
          <div className="section-heading">
            <h2>Your learning path</h2>
            <span className="small">
              {profile.mastered_module_ids.length} of{' '}
              {curriculum.modules.length} modules
            </span>
          </div>
          <ol className="compact-path">
            {curriculum.modules.slice(0, 4).map((module) => (
              <li key={module.id}>
                <span
                  className={`path-number${module.mastered ? ' complete' : ''}`}
                  aria-hidden="true"
                >
                  {module.mastered ? '✓' : module.order}
                </span>
                <span>
                  {module.title}
                  <small>
                    {module.mastered
                      ? 'Mastery check passed'
                      : module.unlocked
                        ? 'Ready to learn'
                        : 'Earlier modules required'}
                  </small>
                </span>
              </li>
            ))}
          </ol>
          <a className="text-link" href="#/path">
            View the full learning path →
          </a>
        </section>
        <section className="activity-entry">
          <h2>A little learning, often</h2>
          <p className="small">
            {profile.activity_days.length
              ? `${profile.activity_days.length} learning days recorded in the last 90 days. Return when it suits you.`
              : 'Your first learning day begins with a completed check.'}
          </p>
          {profile.activity_days.length > 0 && (
            <p className="small">
              Most recent: {dateLabel(profile.activity_days[0])}. Activity days
              use UTC.
            </p>
          )}
        </section>
        <details className="definition">
          <summary>What does mastery mean here?</summary>
          <p>
            A module check requires at least 80% correct and every critical risk
            item correct. This records a learning assessment; it does not
            establish real-world trading ability.
          </p>
        </details>
      </aside>
    </div>
  )
}
export function Path({ curriculum }: { curriculum: Curriculum }) {
  return (
    <>
      <PageTitle
        eyebrow="Ten modules · one learning path"
        description="Start with readiness and risk. Each module explains the prerequisites for the next."
      >
        Money before markets
      </PageTitle>
      <ol className="module-list">
        {curriculum.modules.map((module) => (
          <li key={module.id}>
            <span className="path-number" aria-hidden="true">
              {module.mastered ? '✓' : module.order}
            </span>
            <div>
              <h2>
                <a href={`#/module/${module.id}`}>{module.title}</a>
              </h2>
              <p>{module.description}</p>
              <p className="small">
                {module.mastered
                  ? 'Mastery check passed'
                  : module.unlocked
                    ? `${module.lessons.filter((l) => l.completed).length} of ${module.lessons.length} lessons complete`
                    : `Locked · pass ${curriculum.modules
                        .filter(
                          (m) =>
                            module.prerequisite_module_ids.includes(m.id) &&
                            !m.mastered,
                        )
                        .map((m) => m.title)
                        .join(', ')}`}
                {module.optional ? ' · Optional advanced path' : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <section className="learning-section">
        <h2>Practice modes</h2>
        <p>
          Integrated practice applies your written plan and risk reasoning.
          Multiplayer and endless practice require mastery of the first nine
          modules.
        </p>
        <a className="button secondary" href="#/simulation">
          View simulation readiness →
        </a>
      </section>
    </>
  )
}
export function ModulePage({
  module,
  curriculum,
}: {
  module: Module
  curriculum: Curriculum
}) {
  return (
    <>
      <a className="back" href="#/path">
        ← All modules
      </a>
      <PageTitle
        eyebrow={`Module ${module.order}${module.optional ? ' · Optional' : ''}`}
        description={module.description}
      >
        {module.title}
      </PageTitle>
      {!module.unlocked && (
        <Notice>
          <p>Complete these mastery checks before starting this module:</p>
          <ul>
            {curriculum.modules
              .filter(
                (m) =>
                  module.prerequisite_module_ids.includes(m.id) && !m.mastered,
              )
              .map((m) => (
                <li key={m.id}>
                  <a href={`#/module/${m.id}`}>{m.title}</a>
                </li>
              ))}
          </ul>
        </Notice>
      )}
      <div className="module-layout">
        <section aria-label="Module route">
          <div className="route-heading">
            <h2>Follow your route</h2>
            <p className="small">
              {module.lessons.filter((l) => l.completed).length} of{' '}
              {module.lessons.length} lessons complete
            </p>
          </div>
          <p className="small">
            The shaded shore begins with explanations. Follow the connected
            checkpoints toward the mastery check, then collect your learning
            notes.
          </p>
          <div className="map-canvas">
            <svg
              className="route-lines"
              viewBox="0 0 300 400"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                className="route-solid"
                d="M75 50C210 60 60 135 225 150S60 210 75 250 170 340 225 350"
              />
              <path className="route-optional" d="M225 350H75" />
            </svg>
            <ol className="learning-map">
              {module.lessons.map((lesson, i) => (
                <li
                  key={lesson.id}
                  className={`map-station station-${i % 2}${lesson.completed ? ' complete' : ''}`}
                  style={{ gridRow: i + 1 }}
                >
                  <span className="station-number" aria-hidden="true">
                    {lesson.completed ? '✓' : i + 1}
                  </span>
                  {lesson.unlocked ? (
                    <a href={`#/lesson/${lesson.id}`}>{lesson.title}</a>
                  ) : (
                    <strong>{lesson.title}</strong>
                  )}
                  <span className="small">
                    {lesson.completed
                      ? 'Learning check passed'
                      : lesson.unlocked
                        ? 'Ready to learn'
                        : 'Locked · earlier lessons and modules required'}
                  </span>
                </li>
              ))}
              <li className="map-station destination">
                <span className="station-number" aria-hidden="true">
                  {module.mastered ? '✓' : module.lessons.length + 1}
                </span>
                {module.assessment_available ? (
                  <a href={`#/assessment/${module.id}`}>Mastery check</a>
                ) : (
                  <strong>Mastery check</strong>
                )}
                <span className="small">
                  {module.mastered
                    ? 'Passed · learning cache earned'
                    : module.assessment_available
                      ? 'Ready · apply your reasoning'
                      : 'Locked · pass every lesson'}
                </span>
              </li>
              <li className="map-station optional">
                <span className="small">Optional branch</span>
                <a href="#/journal">Keep a learning note</a>
                <span className="small">
                  Reflection never blocks the route.
                </span>
              </li>
            </ol>
          </div>
        </section>
        <aside className="map-reading">
          <h2>Your learning cache</h2>
          <p>
            Keep the explanations you can use again. The destination records
            learning, never financial returns.
          </p>
          <details className="definition">
            <summary>How this route works</summary>
            <p>
              Each lesson includes an explanation, a worked example, a
              prediction, a reasoned decision and reflection. Complete the
              lesson checks before the module assessment. Passing that
              assessment opens the next module.
            </p>
          </details>
          <a className="text-link" href="#/archive">
            Look up a term →
          </a>
        </aside>
      </div>
    </>
  )
}
export function LessonPage({
  id,
  onSaved,
}: {
  id: string
  onSaved: () => void
}) {
  const resource = useResource<LessonResponse>(
    `/lessons/${encodeURIComponent(id)}`,
  )
  const lesson = resource.data?.lesson
  return (
    <>
      <ResourceState {...resource} />
      {lesson && resource.data && (
        <>
          <a className="back" href={`#/module/${resource.data.module_id}`}>
            ← Module route
          </a>
          <PageTitle
            eyebrow={
              resource.data.completed
                ? 'Lesson · previously completed'
                : 'Lesson'
            }
            description={lesson.objective}
          >
            {lesson.title}
          </PageTitle>
          <p className="small content-status">
            Content review: {resource.data.review_status.replaceAll('_', ' ')}.
          </p>
          <section className="learning-section">
            <h2>Start with a question</h2>
            <p>{lesson.learning_cycle.question}</p>
          </section>
          <section className="learning-section">
            <h2>The explanation</h2>
            <p className="prose">{lesson.explanation}</p>
            <Sources
              ids={lesson.source_basis}
              sources={resource.data.sources}
            />
          </section>
          <section className="worked-example">
            <h2>A worked example</h2>
            <p className="prose">{lesson.worked_example}</p>
          </section>
          <Assessment
            questions={lesson.questions}
            endpoint={`/lessons/${id}/complete`}
            predictionPrompt={lesson.learning_cycle.prediction}
            decisionPrompt={lesson.learning_cycle.guided_decision}
            reflectionPrompt={lesson.learning_cycle.reflection}
            onSaved={onSaved}
            returnHref={`#/module/${resource.data.module_id}`}
            returnLabel="Back to the module route"
          />
          <details className="definition">
            <summary>What happens after this check?</summary>
            <p>{lesson.learning_cycle.delayed_review}</p>
            <p>{lesson.learning_cycle.mastery_check}</p>
          </details>
        </>
      )}
    </>
  )
}
export function AssessmentPage({
  id,
  onSaved,
}: {
  id: string
  onSaved: () => void
}) {
  const resource = useResource<{
    module_id: string
    mastered: boolean
    questions: Question[]
    mastery_rule: string
  }>(`/modules/${encodeURIComponent(id)}/assessment`)
  return (
    <>
      <a className="back" href={`#/module/${id}`}>
        ← Module route
      </a>
      <PageTitle
        eyebrow="Apply your learning"
        description="Use the explanations in a new situation. Take the time you need."
      >
        Module mastery check
      </PageTitle>
      <ResourceState {...resource} />
      {resource.data && (
        <>
          <p className="small">
            {resource.data.mastery_rule}.{' '}
            {resource.data.mastered &&
              'You have already passed this check; another attempt does not duplicate its learning reward.'}
          </p>
          <Assessment
            questions={resource.data.questions}
            endpoint={`/modules/${id}/assessment`}
            onSaved={onSaved}
            returnHref={`#/module/${id}`}
            returnLabel="Return to the module"
          />
        </>
      )}
    </>
  )
}
export function Reviews({ id, onSaved }: { id?: string; onSaved: () => void }) {
  const resource = useResource<{ reviews: Review[] }>('/reviews')
  const selected = resource.data?.reviews.find((review) => review.id === id)
  return (
    <>
      <PageTitle
        eyebrow="Remember and reconsider"
        description="Revisit an explanation after a delay. A review becomes available when its scheduled time arrives."
      >
        {selected ? selected.title : 'Your learning reviews'}
      </PageTitle>
      <ResourceState {...resource} />
      {id && resource.data && !selected && (
        <Notice error>
          This review could not be found.{' '}
          <a href="#/reviews">Return to reviews</a>
        </Notice>
      )}
      {selected ? (
        selected.due ? (
          <Assessment
            questions={selected.questions}
            endpoint={`/reviews/${selected.id}/submit`}
            onSaved={onSaved}
            returnHref="#/reviews"
            returnLabel="Return to reviews"
          />
        ) : (
          <Notice>
            {selected.completed
              ? 'This delayed review is complete.'
              : `This review is available from ${dateLabel(selected.due_at)}.`}{' '}
            <a href="#/reviews">View all reviews</a>
          </Notice>
        )
      ) : (
        resource.data && (
          <>
            {resource.data.reviews.length === 0 ? (
              <Notice>
                Complete a lesson check to schedule your first delayed review.{' '}
                <a href="#/path">Find your next lesson</a>
              </Notice>
            ) : (
              <ul className="item-list">
                {resource.data.reviews.map((review) => (
                  <li key={review.id}>
                    <div>
                      <h2>{review.title}</h2>
                      <p className="small">
                        {review.completed
                          ? 'Review complete'
                          : review.due
                            ? 'Ready to review'
                            : `Available ${dateLabel(review.due_at)}`}
                      </p>
                    </div>
                    {review.due && (
                      <a
                        className="button secondary"
                        href={`#/review/${review.id}`}
                      >
                        Start review →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      )}
    </>
  )
}
