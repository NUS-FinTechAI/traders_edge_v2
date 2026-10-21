import { useState } from 'react'
import { formatSignedPct } from '../../../../ui/format.ts'
import s from '../visuals.module.css'
import { Candles, PriceGrid } from '../shared/Chart.tsx'
import { candlesFromCloses } from '../shared/data.ts'
import { bands, extent, linear, ticks } from '../shared/scale.ts'
import { arrow, C, signColor } from '../shared/theme.ts'
import type { Candle } from '../shared/trading.ts'
import { Figure, Note, Segmented, Stat, Svg } from '../shared/ui.tsx'

type Id = 'beat' | 'rumor' | 'cut'

const BEFORE = [40.1, 39.8, 40.3, 40.0, 40.2, 40.0]
const NEWS_DAY = BEFORE.length

interface Story {
  headline: string
  after: number[]
  gaps: Record<number, number>
  marks: { day: number; text: string }[]
  note: string
}

const STORIES: Record<Id, Story> = {
  beat: {
    headline: 'Orchard Foods beats estimates and raises its outlook',
    after: [43.1, 43.6, 44.0, 44.3, 44.9, 44.6, 45.2],
    gaps: { [NEWS_DAY]: 42.8 },
    marks: [{ day: NEWS_DAY, text: 'results' }],
    note: 'Gap and follow-through: confirmed good news kept attracting buyers for days.',
  },
  rumor: {
    headline: 'Rumor: Pebble Games to be acquired (unconfirmed)',
    after: [44.3, 44.6, 39.6, 39.2, 38.9, 39.1, 38.8],
    gaps: { [NEWS_DAY]: 44.0, [NEWS_DAY + 2]: 39.9 },
    marks: [
      { day: NEWS_DAY, text: 'rumor' },
      { day: NEWS_DAY + 2, text: 'denied' },
    ],
    note: 'Gap and fade: the rumor was denied two days later and the whole jump disappeared. Check sources before acting.',
  },
  cut: {
    headline: 'Nimbus Cloud beats on EPS but cuts its guidance',
    after: [36.5, 36.0, 35.7, 35.9, 35.3, 35.0, 34.8],
    gaps: { [NEWS_DAY]: 36.8 },
    marks: [{ day: NEWS_DAY, text: 'results' }],
    note: 'A lower outlook outweighed the beat: a gap down, then more selling.',
  },
}

function build(story: Story): Candle[] {
  const candles = candlesFromCloses([...BEFORE, ...story.after], 52)
  for (const [day, open] of Object.entries(story.gaps)) {
    const c = candles[Number(day)]
    candles[Number(day)] = {
      ...c,
      o: open,
      h: Math.round((Math.max(open, c.c) + 0.3) * 100) / 100,
      l: Math.round((Math.min(open, c.c) - 0.25) * 100) / 100,
    }
  }
  return candles
}

const DATA: Record<Id, Candle[]> = {
  beat: build(STORIES.beat),
  rumor: build(STORIES.rumor),
  cut: build(STORIES.cut),
}

export default function NewsImpact() {
  const [id, setId] = useState<Id>('beat')
  const story = STORIES[id]
  const data = DATA[id]
  const base = data[NEWS_DAY - 1].c
  const gap = ((data[NEWS_DAY].o - base) / base) * 100
  const total = ((data[data.length - 1].c - base) / base) * 100

  return (
    <Figure
      caption="Pick a headline and see how the price reacted the next morning and over the following days."
      readout={
        <>
          <Stat
            label="Opening gap"
            value={`${arrow(gap)} ${formatSignedPct(gap)}`}
            color={signColor(gap)}
          />
          <Stat
            label={`After ${data.length - NEWS_DAY} days`}
            value={`${arrow(total)} ${formatSignedPct(total)}`}
            color={signColor(total)}
          />
          <Note>{story.note}</Note>
        </>
      }
      controls={
        <Segmented
          label="Headline"
          value={id}
          onChange={setId}
          stacked
          options={(Object.keys(STORIES) as Id[]).map((key) => ({
            id: key,
            label: `“${STORIES[key].headline}”`,
          }))}
        />
      }
    >
      {(width) => {
        const height = 200
        const x0 = 4
        const x1 = width - 56
        const domain = extent(
          data.flatMap((c) => [c.h, c.l]),
          0.08,
        )
        const y = linear(domain, [height - 10, 22])
        const band = bands(data.length, x0, x1)
        return (
          <Svg
            width={width}
            height={height}
            label={`${story.headline}. Opening gap ${formatSignedPct(gap)}; ${formatSignedPct(total)} after ${data.length - NEWS_DAY} days.`}
          >
            <PriceGrid
              y={y}
              values={ticks(...domain, 4)}
              x0={x0}
              x1={x1}
              format={(v) => `$${v}`}
            />
            <line
              x1={x0}
              x2={x1}
              y1={y(base)}
              y2={y(base)}
              style={{ stroke: C.muted }}
              strokeDasharray="3 3"
            />
            <text
              x={x1 - 2}
              y={total > 0 ? y(base) + 15 : y(base) - 6}
              textAnchor="end"
              className={`${s.small} ${s.word}`}
            >
              before the news
            </text>
            {story.marks.map((mark) => {
              const mx = band.x(mark.day) - band.step / 2
              return (
                <g key={mark.day}>
                  <line
                    x1={mx}
                    x2={mx}
                    y1={16}
                    y2={height - 10}
                    style={{ stroke: C.gold }}
                    strokeDasharray="2 3"
                  />
                  <text
                    x={mx}
                    y={12}
                    textAnchor="middle"
                    className={`${s.small} ${s.word} ${s.strong}`}
                    style={{ fill: C.gold }}
                  >
                    {mark.text}
                  </text>
                </g>
              )
            })}
            <Candles data={data} x={band.x} y={y} width={band.body} />
          </Svg>
        )
      }}
    </Figure>
  )
}
