import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import useAdventureRead from '../../../../hooks/useAdventureRead.ts'
import {
  loadLevel,
  levelLockReason,
  bossStatus,
  type AdventureChapter,
  type ModuleMap,
  type LevelProgress,
} from '../../../../services/adventureService.ts'
import ReadError from '../../read-error/ReadError.tsx'
import LearningLaunch from '../../learning/learning-launch/LearningLaunch.tsx'
import {
  NormalStar,
  SpecialStar,
} from '../../../icons/mission-stars/MissionStars.tsx'
import './NodeDetails.css'

function Briefing({
  level,
  map,
  chapter,
}: {
  level: LevelProgress
  map: ModuleMap
  chapter: AdventureChapter
}) {
  const load = useCallback(
    (signal: AbortSignal) => loadLevel(level.id, signal),
    [level.id],
  )
  const { state } = useAdventureRead(load)
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
      {state.status === 'error' && <ReadError error={state.error} />}
      {state.status === 'ready' && (
        <>
          <h3>
            <NormalStar earned={state.data.level.standard_star} /> Required
            missions
          </h3>
          <p>{state.data.level.completion_rule}</p>
          <p>
            {state.data.level.required_steps}{' '}
            {state.data.level.required_steps === 1 ? 'step' : 'steps'} ·{' '}
            {state.data.level.standard_star
              ? 'Normal star earned'
              : 'Normal star not yet earned'}
          </p>
          <LearningLaunch
            purpose="practice"
            target={level.id}
            available={state.data.level.unlocked}
            runId={state.data.level.active_run_id}
            label={
              state.data.level.standard_star
                ? 'Practise required missions again'
                : 'Start required missions'
            }
            resumeLabel="Resume required missions"
          />
          {state.data.level.bonus_steps > 0 && (
            <>
              <h3>
                <SpecialStar earned={state.data.level.bonus_star} /> Optional
                bonus
              </h3>
              <p>{state.data.level.bonus_rule}</p>
              <p>
                {state.data.level.bonus_steps} bonus{' '}
                {state.data.level.bonus_steps === 1 ? 'step' : 'steps'} ·{' '}
                {state.data.level.bonus_star
                  ? 'Special star earned'
                  : 'Special star not yet earned'}
              </p>
              <LearningLaunch
                purpose="bonus"
                target={level.id}
                available={state.data.level.bonus_available}
                runId={
                  chapter.active_learning_runs.find(
                    (run) =>
                      run.purpose === 'bonus' && run.level_id === level.id,
                  )?.run_id
                }
                label={
                  state.data.level.bonus_star
                    ? 'Practise bonus again'
                    : 'Start bonus missions'
                }
                resumeLabel="Resume bonus missions"
              />
              {!state.data.level.bonus_available &&
                !state.data.level.bonus_star && (
                  <p>
                    Complete the required missions to unlock this optional
                    bonus.
                  </p>
                )}
            </>
          )}
          {state.data.level.active_run_id && (
            <p>Your required mission is saved in progress.</p>
          )}
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
        <LearningLaunch
          purpose="diagnostic"
          target={map.module_id}
          available={map.unlocked && map.diagnostic.required}
          runId={map.diagnostic.run_id}
          label="Start introductory assessment"
          resumeLabel={
            map.diagnostic.completed
              ? 'View assessment results'
              : 'Resume introductory assessment'
          }
        />
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
        <LearningLaunch
          purpose="assessment"
          target={map.module_id}
          available={map.assessment_available}
          runId={
            chapter.active_learning_runs.find(
              (run) => run.purpose === 'assessment',
            )?.run_id
          }
          label={
            map.mastered
              ? 'Practise chapter check again'
              : 'Start chapter learning check'
          }
          resumeLabel="Resume chapter learning check"
        />
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
    </>
  )
}

export function NodeDialog({
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
    dialog?.querySelector<HTMLButtonElement>('button')?.focus()
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
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], [tabindex="0"]',
        )
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
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
    </dialog>
  )
}

export default function NodeDetails({
  selected,
  map,
  chapter,
  close,
}: {
  selected: string
  map: ModuleMap
  chapter: AdventureChapter
  close: () => void
}) {
  const level = map.levels.find((item) => item.id === selected)
  return (
    <NodeDialog close={close}>
      {level ? (
        <Briefing key={level.id} level={level} map={map} chapter={chapter} />
      ) : (
        <CheckpointDetails stop={selected} chapter={chapter} map={map} />
      )}
    </NodeDialog>
  )
}
