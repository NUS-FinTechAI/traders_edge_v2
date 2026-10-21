import s from '../visuals.module.css'
import { linear, smoothPath } from './scale.ts'
import { C } from './theme.ts'
import { Figure, Note, Segmented, Stat, Svg } from './ui.tsx'

export interface Stage<T extends string> {
  id: T
  label: string
  /** Point indices [from, to] for the highlighted stretch, and the marker point. */
  span: [number, number]
  at: number
  text: string
}

/** A stylised price curve with numbered, selectable stages. */
export default function StageCurve<T extends string>({
  caption,
  points,
  stages,
  value,
  onChange,
  notes = [],
  baseline,
  summary,
}: {
  caption: string
  points: readonly (readonly [number, number])[]
  stages: readonly Stage<T>[]
  value: T
  onChange: (id: T) => void
  notes?: readonly { at: number; text: string; below?: boolean }[]
  baseline?: { y: number; text: string }
  summary: string
}) {
  const index = stages.findIndex((stage) => stage.id === value)
  const stage = stages[index]
  return (
    <Figure
      caption={caption}
      readout={
        <>
          <Stat
            label={`Stage ${index + 1} of ${stages.length}`}
            value={stage.label}
            color={C.gold}
          />
          <Note>{stage.text}</Note>
        </>
      }
      controls={
        <Segmented
          label="Stage"
          value={value}
          onChange={onChange}
          options={stages.map((st, i) => ({
            id: st.id,
            label: `${i + 1} ${st.label}`,
          }))}
        />
      }
    >
      {(width) => {
        const height = 210
        const x = linear([0, 100], [16, width - 16])
        const y = linear([0, 100], [height - 16, 30])
        const mapped = points.map(([px, py]) => [x(px), y(py)] as const)
        const part = mapped.slice(stage.span[0], stage.span[1] + 1)
        const [mx, my] = mapped[stage.at]
        return (
          <Svg
            width={width}
            height={height}
            label={`${summary} Selected: ${stage.label}. ${stage.text}`}
          >
            {baseline && (
              <g aria-hidden="true">
                <line
                  x1={x(0)}
                  x2={x(100)}
                  y1={y(baseline.y)}
                  y2={y(baseline.y)}
                  style={{ stroke: C.border }}
                  strokeDasharray="4 4"
                />
                <text
                  x={x(100)}
                  y={y(baseline.y) + 14}
                  textAnchor="end"
                  className={`${s.small} ${s.word}`}
                >
                  {baseline.text}
                </text>
              </g>
            )}
            <path
              d={smoothPath(mapped)}
              style={{ fill: 'none', stroke: C.borderStrong, strokeWidth: 3 }}
            />
            <path
              d={smoothPath(part)}
              style={{
                fill: 'none',
                stroke: C.gold,
                strokeWidth: 4,
                strokeLinecap: 'round',
              }}
            />
            {notes.map((note) => {
              const [nx, ny] = mapped[note.at]
              return (
                <text
                  key={note.text}
                  x={nx}
                  y={note.below ? ny + 22 : ny - 14}
                  textAnchor="middle"
                  className={`${s.small} ${s.word} ${s.halo}`}
                  aria-hidden="true"
                >
                  {note.text}
                </text>
              )
            })}
            {stages.map((st, i) => {
              const [sx, sy] = mapped[st.at]
              const on = st.id === value
              return (
                <g
                  key={st.id}
                  className={s.tap}
                  onClick={() => onChange(st.id)}
                  aria-hidden="true"
                >
                  <circle cx={sx} cy={sy} r={22} className={s.hit} />
                  <circle
                    cx={sx}
                    cy={sy}
                    r={on ? 12 : 10}
                    style={{
                      fill: on ? C.gold : C.surface3,
                      stroke: on ? C.bg : C.borderStrong,
                      strokeWidth: 2,
                    }}
                  />
                  <text
                    x={sx}
                    y={sy + 4}
                    textAnchor="middle"
                    className={`${s.small} ${s.strong}`}
                    style={{ fill: on ? C.bg : C.text }}
                  >
                    {i + 1}
                  </text>
                </g>
              )
            })}
            <text
              x={Math.min(Math.max(mx, 50), width - 50)}
              y={my < 60 ? my + 32 : my - 20}
              textAnchor="middle"
              className={`${s.word} ${s.strong} ${s.halo}`}
              style={{ fill: C.gold }}
            >
              {stage.label}
            </text>
          </Svg>
        )
      }}
    </Figure>
  )
}
