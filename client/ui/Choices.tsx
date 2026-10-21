import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import Button from './Button.tsx'
import Icon from './Icon.tsx'
import styles from './Choices.module.css'

export interface ChoiceOption {
  id: string
  text: string
}

interface ChoicesProps {
  label: string
  options: ChoiceOption[]
  selected: string | null
  onSelect: (id: string) => void
  /** After grading: the correct option and the player's answer. */
  result?: { correct: string; chosen: string } | null
  disabled?: boolean
  trueFalse?: boolean
}

const LETTERS = 'ABCDEFGH'

/** A–D answer cards; arrow keys move between them like a radio group. */
export function Choices({
  label,
  options,
  selected,
  onSelect,
  result,
  disabled,
  trueFalse,
}: ChoicesProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const locked = disabled || !!result
  const focusIndex = Math.max(
    0,
    options.findIndex((option) => option.id === selected),
  )

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0
    if (!step || locked) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    refs.current[next]?.focus()
    onSelect(options[next].id)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={[styles.choices, trueFalse && styles.pair]
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((option, index) => {
        const isCorrect = result?.correct === option.id
        const isWrong = result?.chosen === option.id && !isCorrect
        const state = isCorrect
          ? styles.correct
          : isWrong
            ? styles.wrong
            : result
              ? styles.dim
              : selected === option.id
                ? styles.selected
                : undefined
        return (
          <button
            key={option.id}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={selected === option.id}
            aria-disabled={locked || undefined}
            tabIndex={index === focusIndex ? 0 : -1}
            className={[styles.choice, state].filter(Boolean).join(' ')}
            onClick={() => !locked && onSelect(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className={styles.letter} aria-hidden="true">
              {trueFalse ? (
                <Icon
                  name={
                    option.text.toLowerCase().startsWith('t')
                      ? 'check'
                      : 'close'
                  }
                  size={18}
                />
              ) : (
                LETTERS[index]
              )}
            </span>
            <span className={styles.text}>{option.text}</span>
            {isCorrect && (
              <span className={styles.mark}>
                <Icon name="check" size={20} />
                <span className="visually-hidden">Correct answer</span>
              </span>
            )}
            {isWrong && (
              <span className={styles.mark}>
                <Icon name="close" size={20} />
                <span className="visually-hidden">
                  Your answer, not correct
                </span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface FeedbackProps {
  correct: boolean
  explanation: string
  correctText?: string
  reward?: ReactNode
  actionLabel: string
  onAction: () => void
}

/** Answer feedback that slides up under the choices and is announced. */
export function Feedback({
  correct,
  explanation,
  correctText,
  reward,
  actionLabel,
  onAction,
}: FeedbackProps) {
  return (
    <div
      className={[styles.feedback, correct ? styles.good : styles.bad].join(
        ' ',
      )}
      role="status"
    >
      <div className={styles.feedbackBody}>
        <span className={styles.feedbackIcon} aria-hidden="true">
          <Icon name={correct ? 'check' : 'close'} size={22} />
        </span>
        <div>
          <p className={styles.feedbackTitle}>
            {correct ? 'Great choice!' : 'Not quite'}
          </p>
          {!correct && correctText && (
            <p className={styles.feedbackAnswer}>Answer: {correctText}</p>
          )}
          <p className={styles.feedbackText}>{explanation}</p>
        </div>
        {reward && <div className={styles.feedbackReward}>{reward}</div>}
      </div>
      <Button
        variant={correct ? 'primary' : 'secondary'}
        size="lg"
        className={styles.feedbackAction}
        onClick={onAction}
        autoFocus
      >
        {actionLabel}
      </Button>
    </div>
  )
}
