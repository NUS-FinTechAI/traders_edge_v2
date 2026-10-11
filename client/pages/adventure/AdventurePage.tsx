import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import useAdventureRead from '../../hooks/useAdventureRead.ts'
import {
  loadAdventure,
  type AdventureChapter,
} from '../../services/adventureService.ts'
import {
  AdventureGate,
  ReadError,
  RouteEmblem,
  Star,
  StarLegend,
} from './AdventureShared.tsx'

function ChapterCard({ chapter }: { chapter: AdventureChapter }) {
  return (
    <li className="adventure-chapter-card">
      <Link to={`/adventure/chapters/${encodeURIComponent(chapter.module_id)}`}>
        <div className="adventure-card-top">
          <span>Chapter {String(chapter.order).padStart(2, '0')}</span>
          <span className="adventure-status">
            {chapter.unlocked ? 'Unlocked' : 'Locked'}
          </span>
        </div>
        <h2>{chapter.title}</h2>
        <div className="adventure-card-route" aria-hidden="true">
          {Array.from({ length: chapter.total_required_levels }, (_, index) => (
            <span
              key={index}
              className={
                index < chapter.completed_required_levels ? 'is-complete' : ''
              }
            >
              {index + 1}
            </span>
          ))}
        </div>
        <p>
          {chapter.completed_required_levels} of {chapter.total_required_levels}{' '}
          levels completed
        </p>
        <div className="adventure-star-counts">
          <span>
            <Star />
            {chapter.normal_stars.earned}/{chapter.normal_stars.total} normal
          </span>
          <span>
            <Star special />
            {chapter.special_stars.earned}/{chapter.special_stars.total} special
          </span>
        </div>
        <progress
          aria-label={`Chapter ${chapter.order} required levels completed`}
          value={chapter.completed_required_levels}
          max={Math.max(chapter.total_required_levels, 1)}
        />
        <span className="adventure-card-link">
          {chapter.unlocked ? 'Explore chapter' : 'Preview chapter'}{' '}
          <span aria-hidden="true">→</span>
        </span>
      </Link>
    </li>
  )
}

function ChapterSelection() {
  const { state, retry } = useAdventureRead(loadAdventure)
  const rail = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })
  useEffect(() => {
    const list = rail.current
    if (!list) return
    function updateEdges() {
      if (!list) return
      setEdges({
        start: list.scrollLeft <= 1,
        end: list.scrollLeft + list.clientWidth >= list.scrollWidth - 1,
      })
    }
    const observer = new ResizeObserver(updateEdges)
    observer.observe(list)
    list.addEventListener('scroll', updateEdges)
    updateEdges()
    return () => {
      observer.disconnect()
      list.removeEventListener('scroll', updateEdges)
    }
  }, [state.status])

  function move(direction: number) {
    const list = rail.current
    if (!list) return
    const card = list.firstElementChild
    list.scrollBy({
      left: direction * ((card?.getBoundingClientRect().width ?? 280) + 20),
      behavior: 'instant',
    })
  }

  return (
    <main className="adventure-page">
      <Link className="adventure-back" to="/">
        ← Home
      </Link>
      <header className="adventure-heading">
        <div>
          <p className="adventure-eyebrow">Learn one chapter at a time</p>
          <h1>Adventure Mode</h1>
          <p>
            Build your understanding of markets, starting with the money you
            need to protect.
          </p>
        </div>
        <RouteEmblem />
      </header>
      <div className="adventure-section-heading">
        <h2>Your chapters</h2>
        {state.status === 'ready' && state.data.chapters.length > 1 && (
          <div className="adventure-rail-controls">
            <button
              onClick={() => move(-1)}
              aria-label="Scroll to earlier chapters"
              disabled={edges.start}
            >
              ←
            </button>
            <button
              onClick={() => move(1)}
              aria-label="Scroll to later chapters"
              disabled={edges.end}
            >
              →
            </button>
          </div>
        )}
      </div>
      {state.status === 'loading' && (
        <p className="adventure-notice" role="status">
          Loading chapters and saved stars…
        </p>
      )}
      {state.status === 'error' && (
        <ReadError error={state.error} retry={retry} />
      )}
      {state.status === 'ready' &&
        (state.data.chapters.length ? (
          <>
            <p className="adventure-muted">
              Scroll sideways to explore. Locked chapters can still be
              previewed.
            </p>
            <ul
              className="adventure-chapter-rail"
              ref={rail}
              aria-label="Chapters"
            >
              {state.data.chapters.map((chapter) => (
                <ChapterCard key={chapter.module_id} chapter={chapter} />
              ))}
            </ul>
          </>
        ) : (
          <p className="adventure-notice">
            No chapters are available yet. Check back later.
          </p>
        ))}
      <StarLegend />
      <p className="adventure-footnote">
        New to trading? Follow the chapters in order. Stars record mission
        completion, not trading competence.
      </p>
    </main>
  )
}

export default function AdventurePage() {
  return (
    <AdventureGate>
      {(userId) => <ChapterSelection key={userId} />}
    </AdventureGate>
  )
}
