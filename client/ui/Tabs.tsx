import { useRef, type KeyboardEvent } from 'react'
import styles from './ui.module.css'

interface TabsProps<T extends string> {
  label: string
  tabs: readonly { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  idPrefix: string
}

/** Tab list with roving focus; pair each panel with id `${idPrefix}-panel-${tab}`. */
export default function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
}: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + tabs.length) % tabs.length
    refs.current[next]?.focus()
    onChange(tabs[next].id)
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            refs.current[index] = element
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${tab.id}`}
          aria-selected={tab.id === value}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          tabIndex={tab.id === value ? 0 : -1}
          className={styles.tab}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
