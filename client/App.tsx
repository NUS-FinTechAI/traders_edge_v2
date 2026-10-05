import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, post } from './api'
import type { Curriculum, Profile } from './api'
import {
  Dashboard,
  Path,
  ModulePage,
  LessonPage,
  AssessmentPage,
  Reviews,
} from './pages/Learning'
import { Archive, Journal, Leaderboard, ProfilePage } from './pages/Personal'
import { Fox, Notice, PageTitle } from './components/ui'
import { Simulations } from './pages/Simulation'
import './App.css'

function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || '/')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [loading, setLoading] = useState(true)
  const [guest, setGuest] = useState(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const refresh = useCallback((initial = false) => {
    return api<Profile>('/me/profile')
      .then(async (nextProfile) => {
        const nextCurriculum = await api<Curriculum>('/curriculum')
        setError('')
        setProfile(nextProfile)
        setCurriculum(nextCurriculum)
        setGuest(false)
      })
      .catch((reason) => {
        if (reason instanceof ApiError && reason.status === 401) {
          setGuest(true)
          setProfile(null)
          setCurriculum(null)
        } else setError((reason as Error).message)
      })
      .finally(() => {
        if (initial) setLoading(false)
      })
  }, [])
  useEffect(() => {
    void refresh(true)
  }, [refresh])
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(1) || '/')
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  useEffect(() => {
    requestAnimationFrame(() => {
      document.querySelector('.more-nav')?.removeAttribute('open')
      mainRef.current?.focus()
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
  }, [route])
  async function start() {
    setStarting(true)
    setError('')
    try {
      await post('/session', {})
      await refresh()
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setStarting(false)
    }
  }
  const [page, id] = route.split('/').filter(Boolean)
  const onSaved = () => {
    void refresh()
  }
  const module = curriculum?.modules.find((item) => item.id === id)
  let content
  if (loading) content = <Notice>Opening your learning space…</Notice>
  else if (guest)
    content = (
      <div className="welcome">
        <PageTitle
          eyebrow="Learn before you take risk"
          description="Start with essential money, uncertainty and the reasons behind a financial decision."
        >
          Build your financial understanding.
        </PageTitle>
        <button className="button" onClick={start} disabled={starting}>
          {starting
            ? 'Opening your learning space…'
            : 'Start a guest learning profile'}{' '}
          →
        </button>
        <Fox>
          A thoughtful decision starts with a question: what do you need this
          money to do?
        </Fox>
        <p className="small">
          Your progress is saved to a guest profile linked to this browser. Keep
          its cookies to return. No email or real money is needed.
        </p>
      </div>
    )
  else if (profile && curriculum) {
    switch (page) {
      case undefined:
        content = <Dashboard profile={profile} curriculum={curriculum} />
        break
      case 'path':
        content = <Path curriculum={curriculum} />
        break
      case 'module':
        content = module ? (
          <ModulePage key={id} module={module} curriculum={curriculum} />
        ) : (
          <Notice error>
            That module was not found. <a href="#/path">View your path</a>
          </Notice>
        )
        break
      case 'lesson':
        content = <LessonPage key={id} id={id} onSaved={onSaved} />
        break
      case 'assessment':
        content = <AssessmentPage key={id} id={id} onSaved={onSaved} />
        break
      case 'reviews':
      case 'review':
        content = (
          <Reviews
            key={id || 'reviews'}
            id={page === 'review' ? id : undefined}
            onSaved={onSaved}
          />
        )
        break
      case 'journal':
        content = <Journal />
        break
      case 'archive':
        content = <Archive />
        break
      case 'profile':
        content = (
          <ProfilePage key={profile.id} profile={profile} onSaved={onSaved} />
        )
        break
      case 'leaderboard':
        content = <Leaderboard />
        break
      case 'simulation':
        content = (
          <Simulations key={id || 'list'} curriculum={curriculum} id={id} />
        )
        break
      default:
        content = (
          <>
            <PageTitle>Page not found</PageTitle>
            <a className="button" href="#/">
              Return to learning
            </a>
          </>
        )
    }
  }
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          mainRef.current?.focus()
        }}
      >
        Skip to content
      </a>
      <header className="masthead">
        <a className="brand" href="#/">
          Trader’s Edge
        </a>
        {profile && (
          <nav aria-label="Main navigation">
            <a href="#/" aria-current={!page ? 'page' : undefined}>
              Learn
            </a>
            <a
              href="#/path"
              aria-current={
                ['path', 'module', 'lesson', 'assessment'].includes(page)
                  ? 'page'
                  : undefined
              }
            >
              Path
            </a>
            <a
              href="#/reviews"
              aria-current={
                ['reviews', 'review'].includes(page) ? 'page' : undefined
              }
            >
              Review
              {profile.due_review_count > 0 && (
                <span className="nav-count">{profile.due_review_count}</span>
              )}
            </a>
            <details className="more-nav">
              <summary>More</summary>
              <div>
                <a href="#/journal">Journal</a>
                <a href="#/archive">Archive</a>
                <a href="#/simulation">Simulation</a>
                <a href="#/profile">Profile</a>
                <a href="#/leaderboard">Leaderboard</a>
              </div>
            </details>
          </nav>
        )}
      </header>
      <main className="folio" id="main" tabIndex={-1} ref={mainRef}>
        {error && (
          <Notice error>
            <p>{error}</p>
            <button
              className="button secondary"
              onClick={() => void refresh(true)}
            >
              Try again
            </button>
          </Notice>
        )}
        {content}
      </main>
      <footer className="footer">
        <span>
          Learn to reason about risk. Financial outcomes remain uncertain.
        </span>
        {profile && (
          <span>
            Guest profile · <a href="#/profile">Profile preferences</a>
          </span>
        )}
      </footer>
    </>
  )
}
export default App
