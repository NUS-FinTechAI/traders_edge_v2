import { useRef, type KeyboardEvent } from 'react'
import styles from './ui.module.css'

interface TabsProps<T extends string> {
  label: string
  tabs: readonly { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  idPrefix: string
}

/**
 * Tab list with roving focus. Only the selected tab's panel is rendered, so
 * only that tab points at it; give the panel id `${idPrefix}-panel-${tab}`.
 */
export default function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
}: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent, index: number) {
    let next: number
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft')
      next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
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
          aria-controls={
            tab.id === value ? `${idPrefix}-panel-${tab.id}` : undefined
          }
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
