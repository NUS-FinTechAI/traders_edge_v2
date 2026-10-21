import { useState } from 'react'
import StageCurve, { type Stage } from '../shared/StageCurve.tsx'

type Id = 'optimism' | 'euphoria' | 'anxiety' | 'panic' | 'hope'

const POINTS: [number, number][] = Array.from({ length: 21 }, (_, i) => {
  const t = i * 5
  return [t, 50 + 42 * Math.sin(((t - 5) / 90) * 2 * Math.PI)]
})

const STAGES: Stage<Id>[] = [
  {
    id: 'optimism',
    label: 'Optimism',
    span: [0, 3],
    at: 2,
    text: 'Prices are rising and the plan feels sensible. A good time to write down your exit, before emotions grow.',
  },
  {
    id: 'euphoria',
    label: 'Euphoria',
    span: [3, 6],
    at: 5,
    text: '"I can\'t lose." Risk feels lowest exactly where it is highest. People size up and skip their stops.',
  },
  {
    id: 'anxiety',
    label: 'Anxiety',
    span: [6, 10],
    at: 8,
    text: 'The first drop is called "just a dip". Stops get moved or cancelled to avoid taking the loss.',
  },
  {
    id: 'panic',
    label: 'Panic',
    span: [10, 15],
    at: 14,
    text: 'Selling to make the pain stop, often near the lows. Decisions are driven by fear, not the plan.',
  },
  {
    id: 'hope',
    label: 'Hope',
    span: [15, 20],
    at: 18,
    text: 'The recovery begins, yet many stay out because the last fall still hurts. Then the cycle can start again.',
  },
]

export default function EmotionCycle() {
  const [stage, setStage] = useState<Id>('euphoria')
  return (
    <StageCurve
      caption="How traders often feel as prices rise and fall. Tap each point. Your plan is what keeps these feelings from trading for you."
      summary="Price cycle curve rising to a peak, falling to a trough and starting to recover."
      points={POINTS}
      stages={STAGES}
      value={stage}
      onChange={setStage}
    />
  )
}
