import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import useAdventureRead from '../../../hooks/useAdventureRead.ts'
import { loadAdventure } from '../../../services/adventureService.ts'
import { AdventureGate } from '../AdventureShared.tsx'
import ReadError from '../../../components/adventure/read-error/ReadError.tsx'
import ChapterCard from '../../../components/adventure/chapter/chapter-card/ChapterCard.tsx'
import RouteEmblem from '../../../components/icons/route-emblem/RouteEmblem.tsx'
import { StarLegend } from '../../../components/icons/mission-stars/MissionStars.tsx'
import './AdventurePage.css'

function ChapterSelection() {
  const { state } = useAdventureRead(loadAdventure)
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
    <main className="adventure-page adventure-overview-page">
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
      {state.status === 'error' && <ReadError fatal error={state.error} />}
      {state.status === 'ready' &&
        (state.data.chapters.length ? (
          <>
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
