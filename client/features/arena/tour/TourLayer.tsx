import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import Button from '../../../ui/Button.tsx'
import {
  PINNED_TARGETS,
  SHEET_BELOW,
  placeCard,
  scrollDelta,
  tourSelector,
  type Box,
  type Size,
  type TourStep,
  type TourTarget,
} from './tour.ts'
import type { ArenaTour } from './useArenaTour.ts'
import styles from './Tour.module.css'

const PAD = 6

function targetBox(step: TourStep): Box | null {
  let top = Infinity
  let left = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const target of step.targets) {
    for (const element of document.querySelectorAll(tourSelector(target))) {
      const rect = element.getBoundingClientRect()
      if (!rect.width && !rect.height) continue
      top = Math.min(top, rect.top)
      left = Math.min(left, rect.left)
      right = Math.max(right, rect.right)
      bottom = Math.max(bottom, rect.bottom)
    }
  }
  if (top === Infinity) return null
  return { top, left, width: right - left, height: bottom - top }
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (!a || !b) return a === b
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

function viewportSize(): Size {
  return {
    width: document.documentElement.clientWidth,
    height: window.innerHeight,
  }
}

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Where focus goes when the card closes and the element focused before it is
 * gone: into the target of a step the player acts on, else "How to play".
 */
function fallbackFocus(step: TourStep): HTMLElement | null {
  const help = document.querySelector<HTMLElement>(tourSelector('help'))
  const inTarget = firstInTarget(step)
  return step.interactive ? (inTarget ?? help) : (help ?? inTarget)
}

function firstInTarget(step: TourStep): HTMLElement | null {
  for (const target of step.targets) {
    const element = document
      .querySelector(tourSelector(target))
      ?.querySelector<HTMLElement>(FOCUSABLE)
    if (element) return element
  }
  return null
}

interface CardProps {
  tour: ArenaTour
  step: TourStep
}

function StepCard({ tour, step }: CardProps) {
  const titleId = useId()
  const bodyId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const returnTo = useRef<Element | null>(null)
  const lastStep = useRef(step)
  const [box, setBox] = useState<Box | null>(() => targetBox(step))
  const [card, setCard] = useState<Size>({ width: 360, height: 200 })
  const [viewport, setViewport] = useState<Size>(viewportSize)

  // Steps are rebuilt on every match update; effects key on what they use.
  const targetsKey = step.targets.join(' ')
  useLayoutEffect(() => {
    lastStep.current = step
  })

  const measure = useCallback(() => {
    const next = targetBox(lastStep.current)
    setBox((previous) => (sameBox(previous, next) ? previous : next))
    setViewport((previous) => {
      const size = viewportSize()
      return previous.width === size.width && previous.height === size.height
        ? previous
        : size
    })
    const element = cardRef.current
    if (element) {
      setCard((previous) =>
        previous.width === element.offsetWidth &&
        previous.height === element.offsetHeight
          ? previous
          : { width: element.offsetWidth, height: element.offsetHeight },
      )
    }
  }, [])

  // Follow the highlighted element after every update, scroll and resize.
  useLayoutEffect(measure)
  useEffect(() => {
    const observer = new ResizeObserver(measure)
    observer.observe(document.body)
    for (const target of targetsKey.split(' ').filter(Boolean)) {
      for (const element of document.querySelectorAll(
        tourSelector(target as TourTarget),
      ))
        observer.observe(element)
    }
    window.addEventListener('scroll', measure, { capture: true, passive: true })
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', measure, { capture: true })
      window.removeEventListener('resize', measure)
    }
  }, [measure, targetsKey])

  // Remember where focus was, and give it back when the card closes. The
  // first value is kept, so a development double run cannot overwrite it.
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!returnTo.current && !card?.contains(document.activeElement))
      returnTo.current = document.activeElement
    return () => {
      const previous = returnTo.current
      const usable =
        previous instanceof HTMLElement &&
        previous !== document.body &&
        previous.isConnected &&
        !previous.matches(':disabled') &&
        !card?.contains(previous)
      const target = usable ? previous : fallbackFocus(lastStep.current)
      target?.focus()
    }
  }, [])

  // Bring the target into view, clear of the sticky top bar and the card.
  useEffect(() => {
    const step = lastStep.current
    if (step.targets.every((target) => PINNED_TARGETS.has(target))) return
    const target = targetBox(step)
    if (!target) return
    const header =
      document.querySelector(tourSelector('top-bar'))?.getBoundingClientRect()
        .bottom ?? 0
    const size = viewportSize()
    const reserve =
      size.width < SHEET_BELOW ? (cardRef.current?.offsetHeight ?? 220) : 0
    const delta = scrollDelta(target, {
      top: Math.max(0, header) + 8,
      bottom: size.height - reserve - 16,
    })
    if (!delta) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollBy({ top: delta, behavior: reduce ? 'auto' : 'smooth' })
  }, [step.id, targetsKey])

  // Keep focus in the card on each new step.
  useEffect(() => {
    const card = cardRef.current
    if (card && !card.contains(document.activeElement))
      card.querySelector<HTMLElement>('[data-primary]')?.focus()
  }, [step.id])

  // Escape ends the tour, unless a dialog such as the order sheet is open.
  const { skip } = tour
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]'))
        return
      event.preventDefault()
      skip()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [skip])

  // Tab cycles inside the card; on a step the player acts on, Tab from the
  // last button moves into the highlighted controls instead.
  function trapTab(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return
    const items = [
      ...(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    ]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (step.interactive) {
      const into = firstInTarget(step)
      if (!event.shiftKey && document.activeElement === last && into) {
        event.preventDefault()
        into.focus()
      }
      return
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const placement = placeCard(
    box && {
      top: box.top - PAD,
      left: box.left - PAD,
      width: box.width + PAD * 2,
      height: box.height + PAD * 2,
    },
    card,
    viewport,
    step.targets.every((target) => PINNED_TARGETS.has(target)),
  )
  const cardStyle =
    placement.mode === 'anchored'
      ? { top: placement.top, left: placement.left }
      : undefined
  const cardClass = [
    styles.card,
    placement.mode === 'sheet'
      ? placement.edge === 'top'
        ? styles.sheetTop
        : styles.sheetBottom
      : styles.anchored,
  ].join(' ')

  return (
    <>
      {!step.interactive && (
        <div
          className={styles.blocker}
          aria-hidden="true"
          onMouseDown={(event) => event.preventDefault()}
        />
      )}
      {box ? (
        <div
          className={styles.spotlight}
          aria-hidden="true"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
          }}
        />
      ) : (
        <div className={styles.dim} aria-hidden="true" />
      )}
      <div
        ref={cardRef}
        className={cardClass}
        style={cardStyle}
        role="dialog"
        aria-modal={step.interactive ? undefined : true}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={trapTab}
      >
        <p className={styles.counter}>
          <span className="num">{tour.position.n}</span> of{' '}
          <span className="num">{tour.position.of}</span>
        </p>
        <h2 id={titleId} className={styles.title}>
          {step.title}
        </h2>
        <p id={bodyId} className={styles.body}>
          {step.body}
        </p>
        <div className={styles.actions}>
          <Button variant="ghost" className={styles.skip} onClick={skip}>
            Skip tour
          </Button>
          <span className={styles.nav}>
            {tour.canGoBack && (
              <Button variant="secondary" onClick={tour.back}>
                Back
              </Button>
            )}
            {step.waitForFill ? (
              <Button data-primary variant="secondary" onClick={tour.next}>
                Skip this step
              </Button>
            ) : (
              <Button data-primary onClick={tour.next}>
                {step.nextLabel ?? 'Next'}
              </Button>
            )}
          </span>
        </div>
      </div>
    </>
  )
}

/** The tour's overlay and its screen-reader announcements. */
export default function TourLayer({ tour }: { tour: ArenaTour }) {
  const { step, position } = tour
  const announcement = step
    ? `Tour step ${position.n} of ${position.of}: ${step.title}. ${step.body}`
    : ''
  return (
    <>
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
      {step &&
        createPortal(
          <div className={styles.layer}>
            <StepCard tour={tour} step={step} />
          </div>,
          document.body,
        )}
    </>
  )
}
