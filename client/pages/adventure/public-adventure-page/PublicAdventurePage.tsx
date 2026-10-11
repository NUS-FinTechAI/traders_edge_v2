import { useRef } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import useAdventureRead from '../../../hooks/useAdventureRead.ts'
import { loadPublicAdventure } from '../../../services/adventureService.ts'
import ChapterCard from '../../../components/adventure/chapter/chapter-card/ChapterCard.tsx'
import { ChapterRoute } from '../../../components/adventure/chapter/chapter-map/ChapterMap.tsx'
import ReadError from '../../../components/adventure/read-error/ReadError.tsx'
import PublicNodeDetails from '../../../components/adventure/chapter/node-details/PublicNodeDetails.tsx'
import './PublicAdventurePage.css'

export default function PublicAdventurePage() {
  const { moduleId } = useParams()
  const { state, retry } = useAdventureRead(loadPublicAdventure)
  const [search, setSearch] = useSearchParams()
  const location = useLocation()
  const rail = useRef<HTMLUListElement>(null)
  const selected = search.get('stop')
  const signIn = `/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`
  function select(stop: string | null) {
    const next = new URLSearchParams(search)
    if (stop) next.set('stop', stop)
    else next.delete('stop')
    void setSearch(next, { preventScrollReset: true, replace: stop === null })
  }
  const chapter =
    state.status === 'ready'
      ? state.data.chapters.find((item) => item.module_id === moduleId)
      : undefined
  const level = chapter?.levels.find((item) => item.id === selected)
  const validStop =
    level ||
    selected === 'exit' ||
    selected === 'assessment' ||
    (selected === 'diagnostic' && chapter?.introductory_assessment) ||
    (selected === 'entry' && chapter && chapter.order > 1)

  return (
    <main className="public-adventure-page">
      <Link className="adventure-back" to={moduleId ? '/adventure' : '/'}>
        {moduleId ? '← All chapters' : '← Home'}
      </Link>
      <header className="adventure-heading">
        <p className="adventure-eyebrow">
          {chapter
            ? `Chapter ${chapter.order} · Preview`
            : 'Explore the learning journey'}
        </p>
        <h1>
          {chapter?.title ?? (moduleId ? 'Chapter preview' : 'Adventure Mode')}
        </h1>
        <p>
          {chapter?.description ||
            'Browse the chapters and levels. Sign in to play and save your progress.'}
        </p>
        <Link className="adventure-button" to={signIn}>
          Sign in to play
        </Link>
      </header>
      {state.status === 'loading' && <p role="status">Loading chapters…</p>}
      {state.status === 'error' && (
        <ReadError error={state.error} retry={retry} />
      )}
      {state.status === 'ready' && !moduleId && (
        <>
          <div className="adventure-section-heading">
            <h2>Offered chapters</h2>
            {state.data.chapters.length > 1 && (
              <div className="adventure-rail-controls">
                <button
                  aria-label="Scroll to earlier chapters"
                  onClick={() =>
                    rail.current?.scrollBy({ left: -320, behavior: 'instant' })
                  }
                >
                  ←
                </button>
                <button
                  aria-label="Scroll to later chapters"
                  onClick={() =>
                    rail.current?.scrollBy({ left: 320, behavior: 'instant' })
                  }
                >
                  →
                </button>
              </div>
            )}
          </div>
          <p>Scroll sideways to explore each chapter.</p>
          <ul
            className="adventure-chapter-rail"
            ref={rail}
            aria-label="Chapters"
          >
            {state.data.chapters.map((item) => (
              <ChapterCard key={item.module_id} chapter={item} />
            ))}
          </ul>
          {!state.data.chapters.length && (
            <p>No chapters are available yet. Check back later.</p>
          )}
        </>
      )}
      {state.status === 'ready' && moduleId && !chapter && (
        <p role="alert">This chapter could not be found.</p>
      )}
      {chapter && (
        <>
          {chapter.order > 1 && (
            <section className="public-entry">
              <h2>Entry boss</h2>
              <p>
                New to trading? Learn the chapters in order before trying an
                early boss fight.
              </p>
              <button
                className="adventure-button"
                onClick={() => select('entry')}
              >
                View entry challenge
              </button>
            </section>
          )}
          <section className="adventure-map" aria-label="Chapter adventure map">
            <div className="adventure-map-caption">
              <span>Chapter route</span>
              <span>{chapter.levels.length} levels</span>
            </div>
            <ChapterRoute
              onSelect={select}
              nodes={[
                ...(chapter.introductory_assessment
                  ? [
                      {
                        id: 'diagnostic',
                        title: 'Introductory assessment',
                        marker: 'Start',
                        status: 'Sign in to play',
                        isLocked: true,
                      },
                    ]
                  : []),
                ...chapter.levels.map((item, index) => ({
                  id: item.id,
                  title: item.title,
                  marker: String(index + 1).padStart(2, '0'),
                  status: 'Sign in to play',
                  isLocked: true,
                  starEarned: false,
                  bonus: item.bonus_steps > 0,
                })),
                {
                  id: 'exit',
                  title: 'Chapter boss',
                  marker: 'Boss',
                  status: 'Sign in to play',
                  isLocked: true,
                },
              ]}
            />
            {!chapter.levels.length && (
              <p>No levels have been published in this chapter.</p>
            )}
            <div className="adventure-learning-check">
              <div>
                <h2>Chapter learning check</h2>
                <p>
                  Separate from the boss result. Bonus missions are not
                  required.
                </p>
              </div>
              <button
                className="adventure-button"
                onClick={() => select('assessment')}
              >
                View learning check
              </button>
            </div>
          </section>
          <p>
            Signing in lets you see your progress. Chapter and level
            prerequisites still apply.
          </p>
          {selected && validStop && (
            <PublicNodeDetails
              chapter={chapter}
              selected={selected}
              signIn={signIn}
              close={() => select(null)}
            />
          )}
          {selected && !validStop && (
            <div role="alert">
              <p>This map stop could not be found.</p>
              <button className="adventure-button" onClick={() => select(null)}>
                Return to map
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
