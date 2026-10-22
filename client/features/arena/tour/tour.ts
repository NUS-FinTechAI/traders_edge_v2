/** Elements the first-match tour can point at, marked with `data-tour`. */
export type TourTarget =
  | 'briefing-mission'
  | 'briefing-rivals'
  | 'briefing-plan'
  | 'top-bar'
  | 'day'
  | 'clock'
  | 'help'
  | 'symbols'
  | 'chart'
  | 'ticket'
  | 'trade-actions'
  | 'account'
  | 'rivals'
  | 'missions'
  | 'news'
  | 'details'

/** Spread onto an element to register it as a tour target. */
export function tourTarget(id: TourTarget): { 'data-tour': TourTarget } {
  return { 'data-tour': id }
}

export function tourSelector(id: TourTarget): string {
  return `[data-tour="${id}"]`
}

/** Targets in the sticky top bar or the fixed action bar: scrolling never moves them. */
export const PINNED_TARGETS: ReadonlySet<TourTarget> = new Set([
  'top-bar',
  'day',
  'clock',
  'help',
  'missions',
  'trade-actions',
])

export type TourPhase = 'briefing' | 'trading'
/** Mobile match-detail tabs a step can open before it points at them. */
export type ArenaTab = 'account' | 'rivals' | 'news' | 'trades'

export type TourStepId =
  | 'mission'
  | 'plan'
  | 'clock'
  | 'chart'
  | 'symbols'
  | 'ticket'
  | 'try'
  | 'account'
  | 'rivals'
  | 'missions'
  | 'news'
  | 'finish'

const ORDER: TourStepId[] = [
  'mission',
  'plan',
  'clock',
  'chart',
  'symbols',
  'ticket',
  'try',
  'account',
  'rivals',
  'missions',
  'news',
  'finish',
]

export interface TourStep {
  id: TourStepId
  phase: TourPhase
  title: string
  body: string
  /** Highlighted elements; none centres the card over a dimmed screen. */
  targets: TourTarget[]
  /** Mobile tab to open before highlighting. */
  tab?: ArenaTab
  /** The page stays usable so the player can act on the step. */
  interactive?: boolean
  /** Advances by itself once the player's first order fills. */
  waitForFill?: boolean
  /** Label of the forward button when it is not "Next". */
  nextLabel?: string
}

export interface TourContext {
  /** Phase the tour started in; a tour started while trading skips the briefing. */
  startPhase: TourPhase
  /** Solo matches have a clock the player controls. */
  solo: boolean
  rivals: number
  /** The scenario allows stop-loss orders. */
  allowStop: boolean
  /** Desktop layout (side column) rather than mobile tabs. */
  desktop: boolean
  /** Include the hands-on "buy a few shares" step. */
  practice: boolean
}

/** The steps for one run of the tour, in order. */
export function planTour(ctx: TourContext): TourStep[] {
  const stopLine = ctx.allowStop
    ? ' Attach stop-loss sells for you if the price falls, and shows your risk if stopped.'
    : ''
  const steps: TourStep[] = []
  if (ctx.startPhase === 'briefing') {
    steps.push(
      {
        id: 'mission',
        phase: 'briefing',
        title: 'Your mission',
        body:
          ctx.rivals > 0
            ? 'This is your mission and what this market teaches. Below are your rivals: whoever ends with the most profit wins.'
            : 'This is your mission and what this market teaches. The missions and rules are listed below.',
        targets:
          ctx.rivals > 0
            ? ['briefing-mission', 'briefing-rivals']
            : ['briefing-mission'],
      },
      {
        id: 'plan',
        phase: 'briefing',
        title: 'Pick a game plan',
        body: 'Choose a strategy (how you mean to trade) and the most you’re willing to lose. Then press Start trading and the tour carries on.',
        targets: ['briefing-plan'],
        interactive: true,
        nextLabel: 'Got it',
      },
    )
  }
  steps.push(
    {
      id: 'clock',
      phase: 'trading',
      title: 'One day at a time',
      body: ctx.solo
        ? 'The day counter shows how far the match has come. The clock is paused for this tour; afterwards use Pause, Next day and the speed buttons to set your own pace.'
        : 'The market moves one day at a time for everyone. The day counter shows how far the match has come.',
      targets: ctx.solo ? ['day', 'clock'] : ['day'],
    },
    {
      id: 'chart',
      phase: 'trading',
      title: 'Reading the chart',
      body: 'Each candle is one day: hollow (green) candles closed higher, filled (red) ones closed lower. Candles left of the Start line are history; hover or tap the chart to see prices.',
      targets: ['chart'],
    },
    {
      id: 'symbols',
      phase: 'trading',
      title: 'Pick a stock',
      body: 'Each tab shows a stock’s latest price and its change since the day before. Choose one to see its chart and trade it.',
      targets: ['symbols'],
    },
    {
      id: 'ticket',
      phase: 'trading',
      title: 'Place an order',
      body: ctx.desktop
        ? `Choose Buy or Sell and how many shares (10, 25, 50 or Max); the estimated cost includes the fee and the spread.${stopLine}`
        : `Tap Buy or Sell to open the order ticket, then choose how many shares (10, 25, 50 or Max); the estimated cost includes the fee and the spread.${stopLine}`,
      targets: [ctx.desktop ? 'ticket' : 'trade-actions'],
    },
  )
  if (ctx.practice && ctx.solo) {
    steps.push({
      id: 'try',
      phase: 'trading',
      title: 'Try it: buy a few shares',
      body: ctx.desktop
        ? 'Use the order ticket to buy a few shares of any stock. The tour carries on when your order fills.'
        : 'Tap Buy, choose a few shares and confirm. The tour carries on when your order fills.',
      targets: [ctx.desktop ? 'ticket' : 'trade-actions'],
      interactive: true,
      waitForFill: true,
    })
  }
  const panel = (target: TourTarget, tab: ArenaTab) =>
    ctx.desktop ? { targets: [target] } : { targets: ['details' as const], tab }
  steps.push({
    id: 'account',
    phase: 'trading',
    title: 'Your account',
    body: 'Cash is what you can spend and Total value adds what your shares are worth. Profit is how far Total value is above or below your starting Sim cash.',
    ...panel('account', 'account'),
  })
  if (ctx.rivals > 0) {
    steps.push({
      id: 'rivals',
      phase: 'trading',
      title: 'Rivals',
      body: 'Your rivals trade the same market. The leaderboard ranks everyone by total profit as the days go by.',
      ...panel('rivals', 'rivals'),
    })
  }
  steps.push(
    {
      id: 'missions',
      phase: 'trading',
      title: 'Missions',
      body: 'Open the Missions star icon next to How to play to see your Star and Bonus star missions. Each label shows whether you’re On track, Behind or Missed.',
      targets: ['missions'],
    },
    {
      id: 'news',
      phase: 'trading',
      title: 'News',
      body: 'Headlines can move prices. New ones appear here as the days pass; open one to read more.',
      ...panel('news', 'news'),
    },
    {
      id: 'finish',
      phase: 'trading',
      title: 'You’re ready',
      body: 'Profit decides the match; missions show what you learned. Good luck!',
      targets: [],
      nextLabel: 'Done',
    },
  )
  return steps
}

/** Index of `id`, or of the next step that still exists after a re-plan. */
export function locate(steps: TourStep[], id: TourStepId): number {
  const exact = steps.findIndex((step) => step.id === id)
  if (exact >= 0) return exact
  const rank = ORDER.indexOf(id)
  const later = steps.findIndex((step) => ORDER.indexOf(step.id) > rank)
  return later >= 0 ? later : steps.length - 1
}

export type TourMove =
  | { kind: 'show'; index: number }
  /** The step belongs to a later phase: hide the tour until it starts. */
  | { kind: 'wait'; index: number }
  | { kind: 'end' }
  /** Nothing earlier to go back to. */
  | { kind: 'stay' }

const PHASES: TourPhase[] = ['briefing', 'trading']

/**
 * The step after (`dir` 1) or before (`dir` -1) index `from` that can show
 * now: steps of an earlier phase and steps whose target is not on screen are
 * skipped. Start a tour, or recheck the current step, with `from` one before it.
 */
export function moveTour(
  steps: TourStep[],
  from: number,
  dir: 1 | -1,
  phase: TourPhase,
  present: (step: TourStep) => boolean,
): TourMove {
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    const step = steps[i]
    if (step.phase !== phase) {
      if (dir === 1 && PHASES.indexOf(step.phase) > PHASES.indexOf(phase))
        return { kind: 'wait', index: i }
      continue
    }
    if (present(step)) return { kind: 'show', index: i }
  }
  return dir === 1 ? { kind: 'end' } : { kind: 'stay' }
}

export function shouldAutoStart(options: {
  playerId: string | null | undefined
  multiplayer: boolean
  phase: string
  seen: boolean
}): boolean {
  return (
    !!options.playerId &&
    !options.multiplayer &&
    (options.phase === 'briefing' || options.phase === 'trading') &&
    !options.seen
  )
}

export interface TourMemory {
  seen: (playerId: string) => boolean
  markSeen: (playerId: string) => void
}

const memoryKey = (playerId: string) => `traders-edge:arena-tour:${playerId}`

/**
 * Tour completion per profile. Without working storage the tour still shows
 * only once per page session.
 */
export function createTourMemory(
  storage: () => Pick<Storage, 'getItem' | 'setItem'>,
): TourMemory {
  const session = new Set<string>()
  return {
    seen(playerId) {
      if (session.has(playerId)) return true
      try {
        return storage().getItem(memoryKey(playerId)) === 'done'
      } catch {
        return false
      }
    },
    markSeen(playerId) {
      session.add(playerId)
      try {
        storage().setItem(memoryKey(playerId), 'done')
      } catch {
        // The session set keeps the tour from repeating until a reload.
      }
    },
  }
}

export interface Box {
  top: number
  left: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export type CardPlacement =
  | { mode: 'sheet'; edge: 'top' | 'bottom' }
  | {
      mode: 'anchored'
      side: 'below' | 'above' | 'right' | 'left' | 'over' | 'center'
      top: number
      left: number
    }

/** Narrower viewports show the card as a sheet on the top or bottom edge. */
export const SHEET_BELOW = 600

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)))
}

/**
 * Where the step card goes: beside the highlighted box when it fits, flipped
 * or clamped to stay in the viewport. Narrow screens use a bottom sheet, which
 * moves to the top edge only for a `pinned` target it would cover; other
 * targets are scrolled clear of it.
 */
export function placeCard(
  target: Box | null,
  card: Size,
  viewport: Size,
  pinned = false,
  gap = 12,
  margin = 16,
): CardPlacement {
  if (viewport.width < SHEET_BELOW) {
    const covered =
      pinned &&
      target !== null &&
      target.top + Math.min(target.height, 120) >
        viewport.height - card.height - gap
    return { mode: 'sheet', edge: covered ? 'top' : 'bottom' }
  }
  const centreLeft = (viewport.width - card.width) / 2
  if (!target) {
    return {
      mode: 'anchored',
      side: 'center',
      top: Math.max(margin, (viewport.height - card.height) / 2),
      left: Math.max(margin, centreLeft),
    }
  }
  const bottom = target.top + target.height
  const right = target.left + target.width
  const alignedLeft = clamp(
    target.left + target.width / 2 - card.width / 2,
    margin,
    viewport.width - card.width - margin,
  )
  const alignedTop = clamp(
    target.top,
    margin,
    viewport.height - card.height - margin,
  )
  if (bottom + gap + card.height <= viewport.height - margin)
    return {
      mode: 'anchored',
      side: 'below',
      top: bottom + gap,
      left: alignedLeft,
    }
  if (target.top - gap - card.height >= margin)
    return {
      mode: 'anchored',
      side: 'above',
      top: target.top - gap - card.height,
      left: alignedLeft,
    }
  if (right + gap + card.width <= viewport.width - margin)
    return {
      mode: 'anchored',
      side: 'right',
      top: alignedTop,
      left: right + gap,
    }
  if (target.left - gap - card.width >= margin)
    return {
      mode: 'anchored',
      side: 'left',
      top: alignedTop,
      left: target.left - gap - card.width,
    }
  return {
    mode: 'anchored',
    side: 'over',
    top: Math.max(margin, viewport.height - card.height - margin),
    left: alignedLeft,
  }
}

/**
 * How far to scroll so `target` sits in the visible band between `top` and
 * `bottom` (viewport coordinates): centred when it fits, else its top edge
 * just below `top`. Zero when it is already fully visible.
 */
export function scrollDelta(
  target: Box,
  band: { top: number; bottom: number },
): number {
  const room = band.bottom - band.top
  if (target.top >= band.top && target.top + target.height <= band.bottom)
    return 0
  if (target.height <= room)
    return Math.round(target.top - band.top - (room - target.height) / 2)
  return Math.round(target.top - band.top - 12)
}
