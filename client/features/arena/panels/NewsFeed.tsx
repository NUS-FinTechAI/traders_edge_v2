import { useState } from 'react'
import type { NewsItem } from '../../../services/gameService.ts'
import Icon from '../../../ui/Icon.tsx'
import { dayNumber } from '../arenaLogic.ts'
import { TONE_LABEL } from '../labels.ts'
import Panel from './Panel.tsx'
import styles from './panels.module.css'

const toneClass = {
  positive: styles.tonePositive,
  negative: styles.toneNegative,
  neutral: styles.toneNeutral,
}

export default function NewsFeed({
  news,
  bare,
}: {
  news: NewsItem[]
  bare?: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  const items = [...news].sort((a, b) => b.t - a.t)
  return (
    <Panel title="News" bare={bare}>
      {items.length === 0 ? (
        <p className={styles.empty}>
          No news yet. Headlines appear here as the days go by.
        </p>
      ) : (
        <ul className={styles.news}>
          {items.map((item) => {
            const expanded = open === item.id
            return (
              <li key={item.id} className={styles.newsItem}>
                <button
                  type="button"
                  className={styles.newsButton}
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : item.id)}
                >
                  <span className={styles.newsMeta}>
                    <span className={`${styles.tone} ${toneClass[item.tone]}`}>
                      {TONE_LABEL[item.tone]}
                    </span>
                    {item.kind && (
                      <span className={styles.newsKind}>{item.kind}</span>
                    )}
                    <span className="num">Day {dayNumber(item.t)}</span>
                    {item.symbols.length > 0 && (
                      <span className={styles.newsSymbols}>
                        {item.symbols.join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className={styles.headline}>{item.headline}</span>
                  <Icon
                    name="chevron-right"
                    size={18}
                    className={expanded ? styles.chevronOpen : styles.chevron}
                  />
                </button>
                {expanded && <p className={styles.newsBody}>{item.body}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
