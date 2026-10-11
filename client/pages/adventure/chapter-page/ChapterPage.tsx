import { useCallback, useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useAdventureRead from '../../../hooks/useAdventureRead.ts'
import { loadChapter, bossStatus } from '../../../services/adventureService.ts'
import { AdventureGate } from '../AdventureShared.tsx'
import ReadError from '../../../components/adventure/read-error/ReadError.tsx'
import ChapterMap from '../../../components/adventure/chapter-map/ChapterMap.tsx'
import StopDetails from '../../../components/adventure/stop-details/StopDetails.tsx'
import {
  Star,
  StarLegend,
} from '../../../components/adventure/mission-stars/MissionStars.tsx'
import './ChapterPage.css'

function ChapterContent({ moduleId }: { moduleId: string }) {
  const load = useCallback(
    (signal: AbortSignal) => loadChapter(moduleId, signal),
    [moduleId],
  )
  const { state, retry } = useAdventureRead(load)
  const [search, setSearch] = useSearchParams()
  const selected = search.get('stop')
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    title.current?.focus()
  }, [])
  function select(stop: string | null) {
    const next = new URLSearchParams(search)
    if (stop) next.set('stop', stop)
    else next.delete('stop')
    void setSearch(next, { preventScrollReset: true, replace: stop === null })
  }
  if (state.status !== 'ready')
    return (
      <main className="adventure-page adventure-chapter-page">
        <Link className="adventure-back" to="/adventure">
          ← All chapters
        </Link>
        <h1 ref={title} tabIndex={-1}>
          Chapter map
        </h1>
        {state.status === 'loading' ? (
          <p className="adventure-notice" role="status">
            Loading your chapter route…
          </p>
        ) : (
          <ReadError error={state.error} retry={retry} />
        )}
      </main>
    )
  const { chapter, map, chapters, bonusLevelIds } = state.data
  const chosenLevel = map.levels.find((level) => level.id === selected)
  const validStop =
    chosenLevel ||
    selected === 'diagnostic' ||
    selected === 'assessment' ||
    selected === 'exit' ||
    (selected === 'entry' && chapter.order > 1)
  const prerequisites = chapters.filter((item) =>
    map.prerequisite_module_ids.includes(item.module_id),
  )
  const position = chapters.findIndex((item) => item.module_id === moduleId)
  const previous = chapters[position - 1]
  const next = chapters[position + 1]
  return (
    <main className="adventure-page adventure-chapter-page">
      <Link className="adventure-back" to="/adventure">
        ← All chapters
      </Link>
      <header className="adventure-heading">
        <div>
          <p className="adventure-eyebrow">
            Chapter {String(chapter.order).padStart(2, '0')} ·{' '}
            {map.unlocked ? 'Unlocked' : 'Locked preview'}
          </p>
          <h1 ref={title} tabIndex={-1}>
            {chapter.title}
          </h1>
          <p>
            Follow the route. Open a stop to see its objective and
            prerequisites.
          </p>
        </div>
        <div className="adventure-chapter-totals">
          <span>
            <Star /> {chapter.normal_stars.earned}/{chapter.normal_stars.total}
          </span>
          <span>
            <Star special /> {chapter.special_stars.earned}/
            {chapter.special_stars.total}
          </span>
        </div>
      </header>
      {!map.unlocked && (
        <div className="adventure-notice">
          <strong>This chapter is locked.</strong>
          <p>
            Pass the earlier chapters, or defeat this chapter’s entry boss to
            unlock it.
          </p>
          {prerequisites.length > 0 && (
            <details>
              <summary>
                Earlier learning checks still needed ({prerequisites.length})
              </summary>
              <ul>
                {prerequisites.map((item) => (
                  <li key={item.module_id}>
                    <Link
                      to={`/adventure/chapters/${encodeURIComponent(item.module_id)}`}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {chapter.order > 1 && (
        <section className="adventure-entry" aria-labelledby="entry-heading">
          <div>
            <p className="adventure-eyebrow">An alternative way in</p>
            <h2 id="entry-heading">Entry boss</h2>
            <p>{chapter.beginner_recommendation}</p>
            <p className="adventure-muted">
              {bossStatus(chapter.entry_boss, chapter.entry_boss_passed)}
            </p>
          </div>
          <button
            className="adventure-button adventure-button-secondary"
            onClick={() => select('entry')}
          >
            View entry challenge
          </button>
        </section>
      )}
      <ChapterMap
        map={map}
        chapter={chapter}
        bonusLevelIds={bonusLevelIds}
        onSelect={select}
      />
      <StarLegend />
      <nav className="adventure-chapter-nav" aria-label="Adjacent chapters">
        {previous && (
          <Link
            to={`/adventure/chapters/${encodeURIComponent(previous.module_id)}`}
          >
            ← Chapter {previous.order}
          </Link>
        )}
        {next && (
          <Link
            className="next-chapter"
            to={`/adventure/chapters/${encodeURIComponent(next.module_id)}`}
          >
            Chapter {next.order} →
          </Link>
        )}
      </nav>
      {selected && validStop && (
        <StopDetails
          selected={selected}
          map={map}
          chapter={chapter}
          close={() => select(null)}
        />
      )}
      {selected && !validStop && (
        <div className="adventure-notice" role="alert">
          <p>This map stop could not be found.</p>
          <button className="adventure-button" onClick={() => select(null)}>
            Return to map
          </button>
        </div>
      )}
    </main>
  )
}

export default function ChapterPage() {
  const { moduleId = '' } = useParams()
  return (
    <AdventureGate>
      {(userId) => (
        <ChapterContent key={`${userId}:${moduleId}`} moduleId={moduleId} />
      )}
    </AdventureGate>
  )
}
