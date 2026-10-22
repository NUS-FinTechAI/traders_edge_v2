import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createTourMemory,
  locate,
  moveTour,
  placeCard,
  PINNED_TARGETS,
  planTour,
  scrollDelta,
  shouldAutoStart,
  type TourContext,
  type TourStep,
} from '../features/arena/tour/tour.ts'

const firstMatch: TourContext = {
  startPhase: 'briefing',
  solo: true,
  rivals: 2,
  allowStop: false,
  desktop: true,
  practice: true,
}

const ids = (steps: TourStep[]) => steps.map((step) => step.id)
const everywhere = () => true

function fakeStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

function brokenStorage() {
  return {
    getItem: (): string | null => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
  }
}

test('a first solo match tours the briefing, the trading screen and a practice buy', () => {
  assert.deepEqual(ids(planTour(firstMatch)), [
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
  ])
})

test('a player without rivals gets no rivals step', () => {
  const steps = planTour({ ...firstMatch, rivals: 0 })

  assert.equal(ids(steps).includes('rivals'), false)
  assert.deepEqual(steps[0].targets, ['briefing-mission'])
})

test('a tour replayed while trading starts at the clock without the practice buy', () => {
  const steps = planTour({
    ...firstMatch,
    startPhase: 'trading',
    practice: false,
  })

  assert.equal(steps[0].id, 'clock')
  assert.equal(ids(steps).includes('try'), false)
  assert.equal(ids(steps).includes('plan'), false)
})

test('multiplayer tours point at the day counter only and never ask for a buy', () => {
  const steps = planTour({ ...firstMatch, solo: false })
  const clock = steps.find((step) => step.id === 'clock')!

  assert.deepEqual(clock.targets, ['day'])
  assert.doesNotMatch(clock.body, /paused/)
  assert.equal(ids(steps).includes('try'), false)
})

test('the ticket step explains the attached stop-loss only when stops are allowed', () => {
  const ticket = (allowStop: boolean) =>
    planTour({ ...firstMatch, allowStop }).find((s) => s.id === 'ticket')!

  assert.match(ticket(true).body, /Attach stop-loss.*risk if stopped/)
  assert.doesNotMatch(ticket(false).body, /stop-loss/)
})

test('on mobile, panel steps open their tab and the ticket step points at Buy and Sell', () => {
  const steps = planTour({ ...firstMatch, desktop: false })
  const byId = (id: string) => steps.find((step) => step.id === id)!

  assert.deepEqual(byId('ticket').targets, ['trade-actions'])
  assert.deepEqual(byId('rivals').targets, ['details'])
  assert.equal(byId('rivals').tab, 'rivals')
  assert.equal(byId('news').tab, 'news')
})

for (const desktop of [true, false]) {
  test(`the ${desktop ? 'desktop' : 'mobile'} missions tour points to the pinned dialog trigger`, () => {
    const steps = planTour({ ...firstMatch, desktop })

    const missions = steps.find((step) => step.id === 'missions')!

    assert.deepEqual(missions.targets, ['missions'])
    assert.equal(missions.tab, undefined)
    assert.equal(PINNED_TARGETS.has('missions'), true)
  })
}

test('the practice buy waits for a fill and leaves the page usable', () => {
  const step = planTour(firstMatch).find((s) => s.id === 'try')!

  assert.equal(step.waitForFill, true)
  assert.equal(step.interactive, true)
})

test('moving forward skips steps whose target is not on screen', () => {
  const steps = planTour({ ...firstMatch, startPhase: 'trading' })
  const chart = steps.findIndex((step) => step.id === 'chart')

  const move = moveTour(
    steps,
    chart,
    1,
    'trading',
    (step) => step.id !== 'symbols',
  )

  assert.deepEqual(move, {
    kind: 'show',
    index: steps.findIndex((step) => step.id === 'ticket'),
  })
})

test('leaving the briefing waits for the trading screen', () => {
  const steps = planTour(firstMatch)

  assert.deepEqual(moveTour(steps, 1, 1, 'briefing', everywhere), {
    kind: 'wait',
    index: 2,
  })
})

test('once trading starts, unfinished briefing steps are skipped', () => {
  const steps = planTour(firstMatch)

  assert.deepEqual(moveTour(steps, 0, 1, 'trading', everywhere), {
    kind: 'show',
    index: 2,
  })
})

test('going back stops at the first step of the current screen', () => {
  const steps = planTour(firstMatch)

  assert.deepEqual(moveTour(steps, 2, -1, 'trading', everywhere), {
    kind: 'stay',
  })
  assert.deepEqual(moveTour(steps, 3, -1, 'trading', everywhere), {
    kind: 'show',
    index: 2,
  })
})

test('moving past the last step ends the tour', () => {
  const steps = planTour(firstMatch)

  assert.deepEqual(
    moveTour(steps, steps.length - 1, 1, 'trading', everywhere),
    {
      kind: 'end',
    },
  )
})

test('a step dropped by a re-plan resumes at the next remaining step', () => {
  const steps = planTour({ ...firstMatch, rivals: 0 })

  assert.equal(steps[locate(steps, 'rivals')].id, 'missions')
  assert.equal(steps[locate(steps, 'chart')].id, 'chart')
})

test('the tour starts by itself only on a first solo match', () => {
  const base = {
    playerId: 'p1',
    multiplayer: false,
    phase: 'briefing',
    seen: false,
  }

  assert.equal(shouldAutoStart(base), true)
  assert.equal(shouldAutoStart({ ...base, phase: 'trading' }), true)
  assert.equal(shouldAutoStart({ ...base, multiplayer: true }), false)
  assert.equal(shouldAutoStart({ ...base, seen: true }), false)
  assert.equal(shouldAutoStart({ ...base, phase: 'results' }), false)
  assert.equal(shouldAutoStart({ ...base, playerId: null }), false)
})

test('a finished tour is remembered per profile', () => {
  const storage = fakeStorage()
  const memory = createTourMemory(() => storage)

  memory.markSeen('p1')

  assert.equal(memory.seen('p1'), true)
  assert.equal(memory.seen('p2'), false)
  assert.equal(createTourMemory(() => storage).seen('p1'), true)
})

test('without storage the tour shows once per session', () => {
  const memory = createTourMemory(brokenStorage)

  assert.equal(memory.seen('p1'), false)
  memory.markSeen('p1')

  assert.equal(memory.seen('p1'), true)
  assert.equal(createTourMemory(brokenStorage).seen('p1'), false)
})

const viewport = { width: 1280, height: 800 }
const card = { width: 360, height: 200 }

test('the card sits below its target and is clamped to the viewport', () => {
  const placement = placeCard(
    { top: 10, left: 1200, width: 70, height: 50 },
    card,
    viewport,
  )

  assert.deepEqual(placement, {
    mode: 'anchored',
    side: 'below',
    top: 72,
    left: 1280 - 360 - 16,
  })
})

test('the card flips above a target near the bottom', () => {
  const placement = placeCard(
    { top: 600, left: 100, width: 200, height: 150 },
    card,
    viewport,
  )

  assert.equal(placement.mode === 'anchored' && placement.side, 'above')
})

test('the card goes beside a target taller than the viewport allows', () => {
  const placement = placeCard(
    { top: 80, left: 880, width: 380, height: 700 },
    card,
    viewport,
  )

  assert.deepEqual(placement, {
    mode: 'anchored',
    side: 'left',
    top: 80,
    left: 508,
  })
})

test('without a target the card is centred', () => {
  assert.deepEqual(placeCard(null, card, viewport), {
    mode: 'anchored',
    side: 'center',
    top: 300,
    left: 460,
  })
})

test('on a phone the card is a bottom sheet', () => {
  const phone = { width: 390, height: 844 }

  assert.deepEqual(
    placeCard({ top: 120, left: 12, width: 366, height: 400 }, card, phone),
    { mode: 'sheet', edge: 'bottom' },
  )
  assert.deepEqual(
    placeCard({ top: 900, left: 12, width: 366, height: 400 }, card, phone),
    { mode: 'sheet', edge: 'bottom' },
  )
})

test('on a phone the sheet moves to the top for a pinned bar it would cover', () => {
  const phone = { width: 390, height: 844 }
  const actionBar = { top: 776, left: 0, width: 390, height: 68 }

  assert.deepEqual(placeCard(actionBar, card, phone, true), {
    mode: 'sheet',
    edge: 'top',
  })
  assert.deepEqual(
    placeCard({ top: 8, left: 0, width: 390, height: 50 }, card, phone, true),
    { mode: 'sheet', edge: 'bottom' },
  )
})

test('a visible target needs no scrolling', () => {
  assert.equal(
    scrollDelta(
      { top: 200, left: 0, width: 100, height: 100 },
      { top: 80, bottom: 700 },
    ),
    0,
  )
})

test('an off-screen target that fits is scrolled to the middle of the band', () => {
  assert.equal(
    scrollDelta(
      { top: 900, left: 0, width: 100, height: 200 },
      { top: 100, bottom: 700 },
    ),
    600,
  )
})

test('a target taller than the band is scrolled to its top edge', () => {
  assert.equal(
    scrollDelta(
      { top: 900, left: 0, width: 100, height: 900 },
      { top: 100, bottom: 700 },
    ),
    788,
  )
})
