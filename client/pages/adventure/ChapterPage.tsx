import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useAdventureRead from '../../hooks/useAdventureRead.ts'
import {
  loadChapter,
  loadLevel,
  levelLockReason,
  bossStatus,
  type AdventureChapter,
  type ModuleMap,
  type LevelProgress,
} from '../../services/adventureService.ts'
import {
  AdventureGate,
  ReadError,
  Star,
  StarLegend,
} from './AdventureShared.tsx'

function Briefing({ level, map }: { level: LevelProgress; map: ModuleMap }) {
  const load = useCallback(
    (signal: AbortSignal) => loadLevel(level.id, signal),
    [level.id],
  )
  const { state, retry } = useAdventureRead(load)
  const reason = levelLockReason(map, level)
  return (
    <>
      <p className="adventure-eyebrow">Level briefing</p>
      <h2 id="stop-title">{level.title}</h2>
      <p>{level.objective}</p>
      {reason && (
        <p className="adventure-notice">
          <strong>Locked:</strong> {reason}
        </p>
      )}
      {state.status === 'loading' && (
        <p role="status">Loading mission details…</p>
      )}
      {state.status === 'error' && (
        <ReadError error={state.error} retry={retry} />
      )}
      {state.status === 'ready' && (
        <>
          <h3>
            <Star /> Required missions
          </h3>
          <p>{state.data.level.completion_rule}</p>
          <p>
            {state.data.level.required_steps}{' '}
            {state.data.level.required_steps === 1 ? 'step' : 'steps'} ·{' '}
            {state.data.level.standard_star
              ? 'Normal star earned'
              : 'Normal star not yet earned'}
          </p>
          {state.data.level.bonus_steps > 0 && (
            <>
              <h3>
                <Star special /> Optional bonus
              </h3>
              <p>{state.data.level.bonus_rule}</p>
              <p>
                {state.data.level.bonus_steps} bonus{' '}
                {state.data.level.bonus_steps === 1 ? 'step' : 'steps'} ·{' '}
                {state.data.level.bonus_star
                  ? 'Special star earned'
                  : 'Special star not yet earned'}
              </p>
            </>
          )}
          {state.data.level.active_run_id && (
            <p>Your required mission is saved in progress.</p>
          )}
          <p className="adventure-footnote">
            Preview only. Playing and resuming missions is not available here
            yet.
          </p>
        </>
      )}
    </>
  )
}

function CheckpointDetails({
  stop,
  map,
  chapter,
}: {
  stop: string
  map: ModuleMap
  chapter: AdventureChapter
}) {
  if (stop === 'diagnostic')
    return (
      <>
        <p className="adventure-eyebrow">Start of the learning route</p>
        <h2 id="stop-title">Introductory assessment</h2>
        <p>
          A short check of your starting understanding. Complete it before the
          chapter’s required levels. Incorrect answers do not block learning.
        </p>
        <p>
          <strong>Status:</strong>{' '}
          {!map.diagnostic.required
            ? 'Not required for this chapter'
            : map.diagnostic.completed
              ? 'Completed'
              : map.diagnostic.run_id
                ? 'In progress'
                : map.unlocked
                  ? 'Available'
                  : 'Unlock this chapter first'}
        </p>
        <p className="adventure-footnote">
          Preview only. This assessment is not available to play here yet.
        </p>
      </>
    )
  if (stop === 'assessment')
    return (
      <>
        <p className="adventure-eyebrow">Separate learning evidence</p>
        <h2 id="stop-title">Chapter learning check</h2>
        <p>
          Complete the introductory assessment and all required levels first.
          Pass with at least 80% correct and every critical risk item correct.
          Bonus missions are optional.
        </p>
        <p>
          <strong>Status:</strong>{' '}
          {map.mastered
            ? 'Module check passed'
            : map.assessment_available
              ? 'Available'
              : 'Complete the learning prerequisites first'}
        </p>
        <p>
          This check records learning progress separately from the profit-based
          boss result.
        </p>
        <p className="adventure-footnote">
          Preview only. This learning check is not available to play here yet.
        </p>
      </>
    )
  const entry = stop === 'entry'
  const boss = entry ? chapter.entry_boss : chapter.exit_boss
  return (
    <>
      <p className="adventure-eyebrow">Challenge against AI</p>
      <h2 id="stop-title">{entry ? 'Entry boss' : 'Chapter boss'}</h2>
      {entry ? (
        <>
          <p>{chapter.beginner_recommendation}</p>
          <p>
            Win to unlock this chapter early. Earlier chapters will not be
            marked complete, and this chapter’s introductory assessment and
            level order still apply.
          </p>
        </>
      ) : (
        <p>
          Complete this chapter’s introductory assessment and required levels to
          attempt its boss. Winning unlocks the next chapter, where one exists.
        </p>
      )}
      <p>
        <strong>Status:</strong>{' '}
        {bossStatus(
          boss,
          entry ? chapter.entry_boss_passed : chapter.exit_boss_passed,
        )}
      </p>
      {boss.active_attempt_ids.length > 0 && (
        <p>
          {boss.active_attempt_ids.length} saved{' '}
          {boss.active_attempt_ids.length === 1 ? 'attempt' : 'attempts'} in
          progress.
        </p>
      )}
      <p>
        Results rank players and AI opponents by net portfolio profit. A win
        requires outperforming every opponent; a tie is not a victory. Profit is
        a game outcome, not proof of learning.
      </p>
      <p className="adventure-footnote">
        Preview only. Playing and resuming boss fights is not available here
        yet.
      </p>
    </>
  )
}

function StopDialog({
  children,
  close,
}: {
  children: ReactNode
  close: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="adventure-dialog"
      aria-labelledby="stop-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <button
        className="adventure-dialog-close"
        onClick={close}
        autoFocus
        aria-label="Close briefing"
      >
        ×
      </button>
      {children}
      <button className="adventure-button" onClick={close}>
        Back to map
      </button>
    </dialog>
  )
}

function ChapterMap({ moduleId }: { moduleId: string }) {
  const load = useCallback(
    (signal: AbortSignal) => loadChapter(moduleId, signal),
    [moduleId],
  )
  const { state, retry } = useAdventureRead(load)
  const [search, setSearch] = useSearchParams()
  const selected = search.get('stop')
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    title.current?.focus()
  }, [])
  function select(stop: string | null) {
    const next = new URLSearchParams(search)
    if (stop) next.set('stop', stop)
    else next.delete('stop')
    void setSearch(next, { preventScrollReset: true, replace: stop === null })
  }
  if (state.status !== 'ready')
    return (
      <main className="adventure-page">
        <Link className="adventure-back" to="/adventure">
          ← All chapters
        </Link>
        <h1 ref={title} tabIndex={-1}>
          Chapter map
        </h1>
        {state.status === 'loading' ? (
          <p className="adventure-notice" role="status">
            Loading your chapter route…
          </p>
        ) : (
          <ReadError error={state.error} retry={retry} />
        )}
      </main>
    )
  const { chapter, map, chapters } = state.data
  const chosenLevel = map.levels.find((level) => level.id === selected)
  const validStop =
    chosenLevel ||
    selected === 'diagnostic' ||
    selected === 'assessment' ||
    selected === 'exit' ||
    (selected === 'entry' && chapter.order > 1)
  const prerequisites = chapters.filter((item) =>
    map.prerequisite_module_ids.includes(item.module_id),
  )
  const position = chapters.findIndex((item) => item.module_id === moduleId)
  const previous = chapters[position - 1]
  const next = chapters[position + 1]
  const routeStops = [
    ...(map.diagnostic.required
      ? [
          {
            id: 'diagnostic',
            title: 'Introductory assessment',
            marker: 'Start',
            status: map.diagnostic.completed
              ? 'Completed'
              : !map.unlocked
                ? 'Locked'
                : map.diagnostic.run_id
                  ? 'In progress'
                  : 'Available',
            level: null,
          },
        ]
      : []),
    ...map.levels.map((level, index) => ({
      id: level.id,
      title: level.title,
      marker: String(index + 1).padStart(2, '0'),
      status: level.standard_star
        ? 'Completed'
        : level.active_run_id
          ? 'In progress'
          : level.unlocked
            ? 'Available'
            : 'Locked',
      level,
    })),
    {
      id: 'exit',
      title: 'Chapter boss',
      marker: 'Boss',
      status: bossStatus(chapter.exit_boss, chapter.exit_boss_passed),
      level: null,
    },
  ]
  return (
    <main className="adventure-page">
      <Link className="adventure-back" to="/adventure">
        ← All chapters
      </Link>
      <header className="adventure-heading">
        <div>
          <p className="adventure-eyebrow">
            Chapter {String(chapter.order).padStart(2, '0')} ·{' '}
            {map.unlocked ? 'Unlocked' : 'Locked preview'}
          </p>
          <h1 ref={title} tabIndex={-1}>
            {chapter.title}
          </h1>
          <p>
            Follow the route. Open a stop to see its objective and
            prerequisites.
          </p>
        </div>
        <div className="adventure-chapter-totals">
          <span>
            <Star /> {chapter.normal_stars.earned}/{chapter.normal_stars.total}{' '}
            normal stars
          </span>
          <span>
            <Star special /> {chapter.special_stars.earned}/
            {chapter.special_stars.total} special stars
          </span>
        </div>
      </header>
      {!map.unlocked && (
        <div className="adventure-notice">
          <strong>This chapter is locked.</strong>
          <p>
            Pass the earlier chapter checks, win the previous chapter’s boss, or
            pass this chapter’s entry boss to unlock it.
          </p>
          {prerequisites.length > 0 && (
            <details>
              <summary>
                Earlier learning checks still needed ({prerequisites.length})
              </summary>
              <ul>
                {prerequisites.map((item) => (
                  <li key={item.module_id}>
                    <Link
                      to={`/adventure/chapters/${encodeURIComponent(item.module_id)}`}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {chapter.order > 1 && (
        <section className="adventure-entry" aria-labelledby="entry-heading">
          <div>
            <p className="adventure-eyebrow">An alternative way in</p>
            <h2 id="entry-heading">Entry boss</h2>
            <p>{chapter.beginner_recommendation}</p>
            <p className="adventure-muted">
              {bossStatus(chapter.entry_boss, chapter.entry_boss_passed)}
            </p>
          </div>
          <button
            className="adventure-button adventure-button-secondary"
            onClick={() => select('entry')}
          >
            View entry challenge
          </button>
        </section>
      )}
      <section className="adventure-map" aria-label="Chapter adventure map">
        <div className="adventure-map-caption">
          <span>Your learning route</span>
          <span>
            {chapter.completed_required_levels}/{chapter.total_required_levels}{' '}
            levels completed
          </span>
        </div>
        <ol className="adventure-route">
          {routeStops.map((stop, index) => (
            <li
              key={stop.id}
              className={`adventure-map-row${stop.status === 'Completed' || stop.status === 'Defeated' ? ' is-complete' : ''}`}
            >
              {index < routeStops.length - 1 && (
                <svg
                  className="adventure-connector"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M30 0 C30 55 70 45 70 100" />
                </svg>
              )}
              <button
                className="adventure-map-stop"
                onClick={() => select(stop.id)}
                aria-label={`${stop.marker === 'Start' || stop.marker === 'Boss' ? '' : `Level ${index + (map.diagnostic.required ? 0 : 1)}: `}${stop.title}. ${stop.status}. View details.`}
              >
                <span className="adventure-node-number">{stop.marker}</span>
                <span className="adventure-node-title">{stop.title}</span>
                <span className="adventure-node-status">{stop.status}</span>
                {stop.level && (
                  <span className="adventure-node-star">
                    <Star earned={stop.level.standard_star} />
                    {stop.level.standard_star
                      ? 'Normal star earned'
                      : 'Required missions'}
                  </span>
                )}
              </button>
              {stop.level &&
                (stop.level.bonus_available || stop.level.bonus_star) && (
                  <button
                    className="adventure-bonus-branch"
                    onClick={() => select(stop.id)}
                    aria-label={`View optional bonus for ${stop.title}`}
                  >
                    <Star special />
                    <span>Bonus</span>
                    <small>
                      {stop.level.bonus_star ? 'Star earned' : 'Optional'}
                    </small>
                  </button>
                )}
            </li>
          ))}
        </ol>
        {map.levels.length === 0 && (
          <p className="adventure-notice">
            No levels have been published in this chapter.
          </p>
        )}
        <div className="adventure-learning-check">
          <div>
            <h2>Chapter learning check</h2>
            <p>
              {map.mastered
                ? 'Module check passed'
                : map.assessment_available
                  ? 'Available after your required missions'
                  : 'Complete the introductory assessment and required levels first.'}
            </p>
            <p className="adventure-muted">
              Separate from the boss result. Bonus missions are not required.
            </p>
          </div>
          <button
            className="adventure-button adventure-button-secondary"
            onClick={() => select('assessment')}
          >
            View learning check
          </button>
        </div>
      </section>
      <StarLegend />
      <p className="adventure-footnote">
        Open any level to inspect its required and optional missions. This map
        currently supports browsing; missions and boss fights are not yet
        playable here.
      </p>
      <nav className="adventure-chapter-nav" aria-label="Adjacent chapters">
        {previous && (
          <Link
            to={`/adventure/chapters/${encodeURIComponent(previous.module_id)}`}
          >
            ← Chapter {previous.order}
          </Link>
        )}
        {next && (
          <Link
            to={`/adventure/chapters/${encodeURIComponent(next.module_id)}`}
          >
            Chapter {next.order} →
          </Link>
        )}
      </nav>
      {selected && validStop && (
        <StopDialog close={() => select(null)}>
          {chosenLevel ? (
            <Briefing key={chosenLevel.id} level={chosenLevel} map={map} />
          ) : (
            <CheckpointDetails stop={selected} chapter={chapter} map={map} />
          )}
        </StopDialog>
      )}
      {selected && !validStop && (
        <div className="adventure-notice" role="alert">
          <p>This map stop could not be found.</p>
          <button className="adventure-button" onClick={() => select(null)}>
            Return to map
          </button>
        </div>
      )}
    </main>
  )
}

export default function ChapterPage() {
  const { moduleId = '' } = useParams()
  return (
    <AdventureGate>
      {(userId) => (
        <ChapterMap key={`${userId}:${moduleId}`} moduleId={moduleId} />
      )}
    </AdventureGate>
  )
}
