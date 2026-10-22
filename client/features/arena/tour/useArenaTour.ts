import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClockAction, GameState } from '../../../services/gameService.ts'
import { useMediaQuery } from '../../../ui/hooks.ts'
import { isMultiplayer } from '../arenaLogic.ts'
import {
  createTourMemory,
  locate,
  moveTour,
  planTour,
  shouldAutoStart,
  tourSelector,
  type ArenaTab,
  type TourPhase,
  type TourStep,
  type TourStepId,
} from './tour.ts'

const memory = createTourMemory(() => localStorage)
const everywhere = () => true

interface Run {
  /** The automatic first-match run, which includes the hands-on step. */
  first: boolean
  startPhase: TourPhase
  stepId: TourStepId
  /** Fills already made when the current step began. */
  fillsAtStep: number
}

export interface ArenaTour {
  /** The step on screen, or null while the tour is off or waiting for trading. */
  step: TourStep | null
  position: { n: number; of: number }
  canGoBack: boolean
  /** Mobile tab the current step needs open. */
  tab: ArenaTab | null
  next: () => void
  back: () => void
  skip: () => void
  replay: () => void
}

/** True when at least one of the step's targets is rendered and visible. */
function targetsPresent(step: TourStep): boolean {
  return (
    step.targets.length === 0 ||
    step.targets.some((target) =>
      [...document.querySelectorAll(tourSelector(target))].some(
        (element) => element.getClientRects().length > 0,
      ),
    )
  )
}

/**
 * The first-match coach-mark tour. It starts by itself on a player's first
 * solo match, can be replayed at any time and pauses a running solo clock
 * while it is on the trading screen, resuming it afterwards.
 */
export default function useArenaTour({
  state,
  phase,
  playerId,
  onClock,
}: {
  state: GameState | null
  phase: string
  playerId: string | null
  onClock: (action: ClockAction) => void
}): ArenaTour {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [run, setRun] = useState<Run | null>(null)
  const [autoChecked, setAutoChecked] = useState(false)
  const tourPaused = useRef(false)

  const tourPhase: TourPhase | null =
    phase === 'briefing' || phase === 'trading' ? phase : null
  const solo = !!state && !isMultiplayer(state)
  const fills = state?.me.fills.length ?? 0
  const paused = !!state?.paused
  const running = state?.status === 'running'

  if (!autoChecked && state && playerId && tourPhase) {
    setAutoChecked(true)
    if (
      shouldAutoStart({
        playerId,
        multiplayer: !solo,
        phase: tourPhase,
        seen: memory.seen(playerId),
      })
    ) {
      setRun({
        first: true,
        startPhase: tourPhase,
        stepId: tourPhase === 'briefing' ? 'mission' : 'clock',
        fillsAtStep: fills,
      })
    }
  }

  const rivals = state?.leaderboard.filter((entry) => !entry.is_me).length ?? 0
  const allowStop = !!state?.scenario.allow.stop
  const startPhase = run?.startPhase ?? null
  const first = !!run?.first
  // Rebuilt only when the plan changes, not on every match update.
  const steps = useMemo(
    () =>
      startPhase
        ? planTour({
            startPhase,
            solo,
            rivals,
            allowStop,
            desktop,
            practice: first,
          })
        : [],
    [startPhase, solo, rivals, allowStop, desktop, first],
  )

  // Briefing steps still open when trading starts are passed over, and
  // trading steps wait, hidden, until the trading screen opens.
  const stored = run ? locate(steps, run.stepId) : -1
  const settled =
    stored >= 0 && tourPhase
      ? moveTour(steps, stored - 1, 1, tourPhase, everywhere)
      : null
  const index =
    settled?.kind === 'show' || settled?.kind === 'wait'
      ? settled.index
      : stored
  const current = index >= 0 ? steps[index] : null
  const showing = settled?.kind === 'show'

  // The hands-on step moves on once the player's order fills.
  if (
    run &&
    showing &&
    current?.waitForFill &&
    tourPhase &&
    fills > run.fillsAtStep
  ) {
    const move = moveTour(steps, index, 1, tourPhase, everywhere)
    if (move.kind === 'show')
      setRun({ ...run, stepId: steps[move.index].id, fillsAtStep: fills })
  }

  function finish() {
    if (playerId) memory.markSeen(playerId)
    if (tourPaused.current) {
      tourPaused.current = false
      if (paused && running) onClock('resume')
    }
    setRun(null)
  }

  /** Move in `dir`, skipping steps whose target is not on screen. */
  function go(dir: 1 | -1) {
    if (!tourPhase || index < 0) return
    const move = moveTour(steps, index, dir, tourPhase, targetsPresent)
    if (move.kind === 'stay') return
    if (move.kind === 'end') {
      finish()
      return
    }
    setRun(
      (previous) =>
        previous && {
          ...previous,
          stepId: steps[move.index].id,
          fillsAtStep: fills,
        },
    )
  }

  function replay() {
    if (run || !tourPhase) return
    setRun({
      first: false,
      startPhase: tourPhase,
      stepId: tourPhase === 'briefing' ? 'mission' : 'clock',
      fillsAtStep: fills,
    })
  }

  // Hold a running solo clock while the tour is on the trading screen.
  useEffect(() => {
    if (!run || tourPhase !== 'trading' || !solo || !running) return
    if (paused || tourPaused.current) return
    tourPaused.current = true
    onClock('pause')
  }, [run, tourPhase, solo, running, paused, onClock])

  return {
    step: showing ? current : null,
    position: { n: index + 1, of: steps.length },
    canGoBack:
      showing &&
      !!tourPhase &&
      moveTour(steps, index, -1, tourPhase, everywhere).kind === 'show',
    tab: showing && !desktop ? (current?.tab ?? null) : null,
    next: () => go(1),
    back: () => go(-1),
    skip: finish,
    replay,
  }
}
