import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../../ui/Icon.tsx'
import Modal from '../../ui/Modal.tsx'
import Tabs from '../../ui/Tabs.tsx'
import { EARN, EARN_TOPICS, type EarnTopic } from './earnRules.ts'
import styles from './EarnGuide.module.css'

const ICON: Record<EarnTopic, IconName> = {
  doubloons: 'coin',
  gems: 'gem',
  xp: 'bolt',
  streak: 'flame',
}

const TONE: Record<EarnTopic, string | undefined> = {
  doubloons: styles.gold,
  gems: styles.gem,
  xp: styles.info,
  streak: styles.flame,
}

/** What one currency is for and every way to earn it. */
export function EarnGuide({
  topic,
  heading,
  onNavigate,
  showNotes = true,
}: {
  topic: EarnTopic
  heading?: boolean
  onNavigate?: () => void
  showNotes?: boolean
}) {
  const info = EARN[topic]
  return (
    <div className={styles.guide}>
      {heading && (
        <h3 className={styles.heading}>
          <span className={TONE[topic]}>
            <Icon name={ICON[topic]} size={20} />
          </span>
          {info.label}
        </h3>
      )}
      <p className={styles.summary}>{info.summary}</p>
      <div className={styles.rows}>
        {info.rows.map((row) => (
          <Link
            key={row.source}
            to={row.to}
            onClick={onNavigate}
            className={styles.row}
          >
            <span className={styles.source}>
              {row.source}
              {row.note && <span className={styles.note}>{row.note}</span>}
            </span>
            {row.amount && (
              <span className={`${styles.amount} num ${TONE[topic]}`}>
                {row.amount}
              </span>
            )}
            <Icon name="chevron-right" size={18} />
          </Link>
        ))}
      </div>
      {showNotes &&
        info.notes.map((note) => (
          <p key={note} className={styles.note}>
            {note}
          </p>
        ))}
    </div>
  )
}

/** Dialog with one tab per currency, opened on `topic`. */
export function EarnDialog({
  topic,
  onClose,
}: {
  topic: EarnTopic | null
  onClose: () => void
}) {
  return (
    <Modal open={topic !== null} title="How to earn" onClose={onClose}>
      {topic && <EarnTabs initial={topic} onNavigate={onClose} />}
    </Modal>
  )
}

function EarnTabs({
  initial,
  onNavigate,
}: {
  initial: EarnTopic
  onNavigate: () => void
}) {
  const [tab, setTab] = useState(initial)
  return (
    <div className={styles.dialog}>
      <Tabs
        label="Currency"
        tabs={EARN_TOPICS.map((id) => ({ id, label: EARN[id].label }))}
        value={tab}
        onChange={setTab}
        idPrefix="earn"
      />
      <div
        role="tabpanel"
        id={`earn-panel-${tab}`}
        aria-labelledby={`earn-tab-${tab}`}
      >
        <EarnGuide topic={tab} onNavigate={onNavigate} showNotes={false} />
      </div>
    </div>
  )
}

/** A balance chip that opens the earning guide for its currency. */
export function EarnButton({
  topic,
  label,
  children,
}: {
  topic: EarnTopic
  /** Accessible name, for example "120 Doubloons". */
  label: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-label={`${label}. ${topic === 'streak' ? 'How streaks work' : `How to earn ${EARN[topic].label}`}`}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <EarnDialog topic={open ? topic : null} onClose={() => setOpen(false)} />
    </>
  )
}
