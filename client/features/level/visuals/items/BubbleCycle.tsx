import { useState } from 'react'
import StageCurve, { type Stage } from '../shared/StageCurve.tsx'

type Id = 'stealth' | 'awareness' | 'mania' | 'blowoff' | 'despair'

const POINTS: [number, number][] = [
  [0, 10],
  [8, 11],
  [16, 14],
  [22, 19],
  [27, 28],
  [31, 24],
  [36, 31],
  [42, 37],
  [47, 44],
  [53, 56],
  [58, 70],
  [62, 85],
  [65, 96],
  [69, 82],
  [72, 87],
  [76, 64],
  [80, 46],
  [85, 33],
  [90, 22],
  [95, 15],
  [100, 12],
]

const STAGES: Stage<Id>[] = [
  {
    id: 'stealth',
    label: 'Stealth',
    span: [0, 3],
    at: 2,
    text: 'A few early buyers accumulate quietly. Price drifts up and hardly anyone notices.',
  },
  {
    id: 'awareness',
    label: 'Awareness',
    span: [3, 8],
    at: 6,
    text: 'More investors notice. A first sell-off (a "bear trap") shakes out early holders before the climb resumes.',
  },
  {
    id: 'mania',
    label: 'Mania',
    span: [8, 12],
    at: 10,
    text: 'Media attention, easy stories and fear of missing out. Price rises faster and faster; "this time is different".',
  },
  {
    id: 'blowoff',
    label: 'Blow-off',
    span: [12, 16],
    at: 15,
    text: 'Buyers run out. A sharp drop, a brief bounce (a "bull trap") that feels like a second chance, then denial.',
  },
  {
    id: 'despair',
    label: 'Despair',
    span: [16, 20],
    at: 18,
    text: 'Fear and capitulation. Price falls back toward, or below, where the story began.',
  },
]

export default function BubbleCycle() {
  const [stage, setStage] = useState<Id>('mania')
  return (
    <StageCurve
      caption="A stylised bubble. Real markets rarely follow it neatly, but naming the stage helps you notice hype."
      summary="Stylised bubble curve: a slow rise, a steep parabolic climb, a peak and a collapse back to the starting level."
      points={POINTS}
      stages={STAGES}
      value={stage}
      onChange={setStage}
      notes={[
        { at: 5, text: 'bear trap', below: true },
        { at: 14, text: 'bull trap' },
      ]}
      baseline={{ y: 12, text: 'where it started' }}
    />
  )
}
