import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../../app/PlayerContext.ts'
import { hasNewUnlocks, unreadUnlocks } from '../../app/unlockNotifications.ts'
import { getArchive, type ArchiveTerm } from '../../services/campaignService.ts'
import Chip from '../../ui/Chip.tsx'
import Icon from '../../ui/Icon.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState } from '../../ui/States.tsx'
import NotificationDot from '../../ui/NotificationDot.tsx'
import useResource from '../../ui/useResource.ts'
import styles from './Archive.module.css'
import useKeywordReadBatch from './useKeywordReadBatch.ts'

function chapterLabel(chapterId: string): string {
  const number = chapterId.replace(/\D/g, '')
  return number ? `Chapter ${number}` : chapterId
}

/** Group terms under their first letter (A–Z, others under #). */
function groupTerms(terms: ArchiveTerm[]): [string, ArchiveTerm[]][] {
  const groups = new Map<string, ArchiveTerm[]>()
  for (const term of [...terms].sort((a, b) =>
    a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }),
  )) {
    const first = term.term.charAt(0).toUpperCase()
    const letter = /[A-Z]/.test(first) ? first : '#'
    groups.set(letter, [...(groups.get(letter) ?? []), term])
  }
  return [...groups.entries()]
}

export default function ArchivePage() {
  const { player } = usePlayer()
  return <Archive key={player?.id ?? 'visitor'} />
}

function Archive() {
  const { player } = usePlayer()
  const resource = useResource(getArchive)
  const reloadArchive = resource.reload
  const previousPlayer = useRef(player)
  useEffect(() => {
    if (hasNewUnlocks(previousPlayer.current, player, 'archive'))
      reloadArchive()
    previousPlayer.current = player
  }, [player, reloadArchive])
  const unread = new Set(
    unreadUnlocks(player, 'archive', 'keywords').map((item) => item.item_id),
  )
  const recordVisible = useKeywordReadBatch()
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()

  return (
    <div>
      <PageHeader
        eyebrow="Dictionary"
        title="Trading Archive"
        subtitle="Every term you meet on your adventure, in one place."
      />
      <label className={styles.search}>
        <Icon name="search" size={20} />
        <span className="visually-hidden">Search terms</span>
        <input
          type="search"
          value={query}
          placeholder="Search terms"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ResourceView resource={resource} label="Opening the archive…">
        {({ terms }) => {
          const matches = needle
            ? terms.filter(
                (term) =>
                  term.term.toLowerCase().includes(needle) ||
                  term.definition.toLowerCase().includes(needle),
              )
            : terms
          const groups = groupTerms(matches)
          if (!terms.length)
            return (
              <EmptyState icon="book" title="The archive is empty">
                Finish lessons to fill it with new terms.
              </EmptyState>
            )
          return (
            <>
              <p className={styles.count} role="status">
                {matches.length} {matches.length === 1 ? 'term' : 'terms'}
              </p>
              {groups.length > 1 && (
                <nav className={styles.letters} aria-label="Jump to letter">
                  {groups.map(([letter]) => (
                    <a key={letter} href={`#letter-${letter}`}>
                      {letter}
                    </a>
                  ))}
                </nav>
              )}
              {groups.length ? (
                groups.map(([letter, items]) => (
                  <section
                    key={letter}
                    id={`letter-${letter}`}
                    className={styles.group}
                    aria-labelledby={`heading-${letter}`}
                  >
                    <h2 id={`heading-${letter}`} className={styles.letter}>
                      {letter}
                    </h2>
                    <dl className={styles.terms}>
                      {items.map((item) => (
                        <div key={item.id} className={styles.term}>
                          <dt>
                            {item.term}
                            {unread.has(item.id) && (
                              <NotificationDot
                                label="New archive keyword"
                                onVisible={() => recordVisible(item.id)}
                              />
                            )}
                          </dt>
                          <dd>{item.definition}</dd>
                          <dd className={styles.source}>
                            <Chip>{chapterLabel(item.chapter_id)}</Chip>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))
              ) : (
                <EmptyState icon="search" title="No matching terms">
                  Try a shorter word.
                </EmptyState>
              )}
            </>
          )
        }}
      </ResourceView>
    </div>
  )
}
