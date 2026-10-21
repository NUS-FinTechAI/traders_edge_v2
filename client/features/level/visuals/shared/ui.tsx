import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import s from '../visuals.module.css'
import { clamp, type Scale } from './scale.ts'
import { C } from './theme.ts'

/** Figure shell: caption, measured plot, live readout and controls. */
export function Figure({
  caption,
  readout,
  controls,
  children,
}: {
  caption: ReactNode
  readout?: ReactNode
  controls?: ReactNode
  children: (width: number) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () =>
      setWidth(clamp(Math.round(element.clientWidth), 260, 720))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <figure className={s.figure}>
      <figcaption className={s.caption}>{caption}</figcaption>
      <div ref={ref} className={s.plot}>
        {children(width)}
      </div>
      {readout !== undefined && (
        <div className={s.readout} aria-live="polite">
          {readout}
        </div>
      )}
      {controls && <div className={s.controls}>{controls}</div>}
    </figure>
  )
}

/** SVG whose viewBox matches its measured width, so text stays 12px. */
export function Svg({
  width,
  height,
  label,
  group,
  children,
}: {
  width: number
  height: number
  label: string
  group?: boolean
  children: ReactNode
}) {
  return (
    <svg
      className={s.svg}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={group ? 'group' : 'img'}
      aria-label={label}
    >
      {children}
    </svg>
  )
}

export function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: ReactNode
  color?: string
}) {
  return (
    <span className={s.stat}>
      <span className={s.statLabel}>{label}</span>{' '}
      <span className={s.statValue} style={color ? { color } : undefined}>
        {value}
      </span>
    </span>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <span className={s.note}>{children}</span>
}

/** Single-choice button group with roving focus and arrow-key selection. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  stacked,
}: {
  label: string
  options: readonly { id: T; label: ReactNode }[]
  value: T
  onChange: (id: T) => void
  stacked?: boolean
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function onKeyDown(event: KeyboardEvent, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    refs.current[next]?.focus()
    onChange(options[next].id)
  }
  return (
    <div
      className={stacked ? `${s.seg} ${s.segStacked}` : s.seg}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option, index) => (
        <button
          key={option.id}
          ref={(element) => {
            refs.current[index] = element
          }}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          tabIndex={option.id === value ? 0 : -1}
          className={s.segBtn}
          onClick={() => onChange(option.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** On/off button with a visible check box, not colour alone. */
export function Toggle({
  pressed,
  onChange,
  children,
}: {
  pressed: boolean
  onChange: (pressed: boolean) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={s.toggle}
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
    >
      <span className={s.box} aria-hidden="true">
        {pressed ? '✓' : ''}
      </span>
      {children}
    </button>
  )
}

export function Range({
  label,
  value,
  min,
  max,
  step,
  display,
  valueText,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: ReactNode
  valueText?: string
  onChange: (value: number) => void
}) {
  return (
    <label className={s.range}>
      <span className={s.rangeHead}>
        <span>{label}</span>
        <span className={s.statValue}>{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

const snap = (value: number, step: number, min: number, max: number) =>
  clamp(Number((Math.round(value / step) * step).toFixed(6)), min, max)

/**
 * Horizontal price line dragged vertically. It is a slider for assistive
 * technology and moves with arrow keys (Page keys move ten steps).
 */
export function DragLine({
  label,
  tag,
  value,
  min,
  max,
  step,
  y,
  x0,
  x1,
  color,
  valueText,
  tagX = x0 + 2,
  tagSide = 'on',
  onChange,
}: {
  label: string
  tag: string
  tagX?: number
  tagSide?: 'on' | 'above' | 'below'
  value: number
  min: number
  max: number
  step: number
  y: Scale
  x0: number
  x1: number
  color: string
  valueText: string
  onChange: (value: number) => void
}) {
  const py = y(value)
  const top = Math.min(y(min), y(max))
  const bottom = Math.max(y(min), y(max))
  const ty = clamp(
    py + (tagSide === 'above' ? -17 : tagSide === 'below' ? 17 : 0),
    top + 4,
    bottom - 4,
  )
  const tagWidth = Math.round(tag.length * 7.6 + 30)

  function move(event: PointerEvent<SVGGElement>) {
    const svg = event.currentTarget.ownerSVGElement
    const matrix = svg?.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    )
    onChange(snap(y.invert(point.y), step, min, max))
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>) {
    const keys: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: step * 10,
      PageDown: -step * 10,
    }
    let next: number | undefined
    if (event.key in keys) next = value + keys[event.key]
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    if (next === undefined) return
    event.preventDefault()
    onChange(snap(next, step, min, max))
  }

  return (
    <g
      className={s.drag}
      tabIndex={0}
      role="slider"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        event.currentTarget.focus()
        move(event)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event)
      }}
    >
      <rect className={s.hit} x={x0} y={py - 22} width={x1 - x0} height={44} />
      <line
        x1={x0}
        x2={x1}
        y1={py}
        y2={py}
        style={{ stroke: color, strokeWidth: 2 }}
        strokeDasharray="6 4"
      />
      <rect
        className={s.ring}
        x={tagX - 1}
        y={ty - 14}
        width={tagWidth + 2}
        height={28}
        rx={8}
      />
      <rect
        x={tagX}
        y={ty - 12}
        width={tagWidth}
        height={24}
        rx={7}
        style={{ fill: C.surface3, stroke: color, strokeWidth: 1.5 }}
      />
      <text
        x={tagX + 10}
        y={ty + 4}
        className={s.strong}
        aria-hidden="true"
        style={{ fill: C.text }}
      >
        <tspan style={{ fill: color }}>⇕</tspan> {tag}
      </text>
    </g>
  )
}

/** Inline legend row: a line sample (solid or dashed) and a text label per series. */
export function Legend({
  items,
  x = 4,
  y = 12,
}: {
  items: readonly { text: string; color: string; dash?: boolean }[]
  x?: number
  y?: number
}) {
  const starts = items.map((_, i) =>
    items
      .slice(0, i)
      .reduce((total, item) => total + 40 + item.text.length * 7, x),
  )
  return (
    <g aria-hidden="true">
      {items.map((item, i) => {
        const start = starts[i]
        return (
          <g key={item.text}>
            <line
              x1={start}
              x2={start + 20}
              y1={y - 4}
              y2={y - 4}
              style={{ stroke: item.color, strokeWidth: 2.5 }}
              strokeDasharray={item.dash ? '5 3' : undefined}
            />
            <text x={start + 26} y={y} className={`${s.small} ${s.word}`}>
              {item.text}
            </text>
          </g>
        )
      })}
    </g>
  )
}
