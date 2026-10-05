import { useResource, dateLabel } from '../hooks'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { api, post } from '../api'
import type { Profile, Source } from '../api'
import { Notice, PageTitle, ResourceState, Sources } from '../components/ui'

export function Journal() {
  const resource = useResource<{
    entries: {
      id: string
      text: string
      lesson_id: string | null
      created_at: string
    }[]
  }>('/journal')
  const [text, setText] = useState(''),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await post('/journal', { text })
      setText('')
      setSaved(true)
      resource.reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="Your explanations"
        description="Record a decision you would reconsider, a risk you noticed or a question to return to."
      >
        Learning journal
      </PageTitle>
      <form onSubmit={submit} className="journal-form">
        <label htmlFor="journal">What would you like to remember?</label>
        <textarea
          id="journal"
          required
          minLength={10}
          maxLength={2000}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setSaved(false)
          }}
        />
        <p className="small">
          10–2,000 characters. Avoid personal account numbers and identifying
          financial details.
        </p>
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : 'Save learning note'}
        </button>
      </form>
      {error && <Notice error>{error}</Notice>}
      {saved && <Notice>Your learning note is saved.</Notice>}
      <section className="learning-section">
        <h2>Saved notes</h2>
        <ResourceState {...resource} />
        {resource.data?.entries.length === 0 && (
          <p>No notes yet. Start with a decision you can explain.</p>
        )}
        <ul className="journal-list">
          {resource.data?.entries.map((entry) => (
            <li key={entry.id}>
              <p className="small">{dateLabel(entry.created_at)}</p>
              <p className="prose">{entry.text}</p>
              {entry.lesson_id && (
                <a className="text-link" href={`#/lesson/${entry.lesson_id}`}>
                  Revisit the lesson →
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
export function Archive() {
  const resource = useResource<{
    terms: {
      id: string
      term: string
      definition: string
      source_basis: string[]
    }[]
    sources: Source[]
    review_status: string
  }>('/archive')
  const [query, setQuery] = useState('')
  const terms = resource.data?.terms.filter((term) =>
    `${term.term} ${term.definition}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <>
      <PageTitle
        eyebrow="Definitions in plain language"
        description="Look up a term without leaving your learning behind."
      >
        Learning archive
      </PageTitle>
      <label htmlFor="term-search">Find a term</label>
      <input
        type="search"
        id="term-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="For example, diversification"
      />
      <ResourceState {...resource} />
      {terms?.length === 0 && (
        <Notice>No matching terms. Try a broader word.</Notice>
      )}
      <dl className="term-list">
        {terms?.map((term) => (
          <div key={term.id}>
            <dt>{term.term}</dt>
            <dd>
              <p>{term.definition}</p>
              <Sources
                ids={term.source_basis}
                sources={resource.data?.sources ?? []}
              />
            </dd>
          </div>
        ))}
      </dl>
    </>
  )
}
export function ProfilePage({
  profile,
  onSaved,
}: {
  profile: Profile
  onSaved: () => void
}) {
  const [name, setName] = useState(profile.display_name),
    [leaderboard, setLeaderboard] = useState(profile.leaderboard_opt_in),
    [analytics, setAnalytics] = useState(profile.analytics_opt_in),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api('/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: name,
          leaderboard_opt_in: leaderboard,
          analytics_opt_in: analytics,
        }),
      })
      setMessage('Your preferences are saved.')
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="Your learning account"
        description="This guest profile is saved on the server and linked to this browser's private session cookie."
      >
        Profile and preferences
      </PageTitle>
      <Notice>
        Keep this browser's cookies to return to this guest profile. Guest
        progress is not transferable to another browser, and clearing cookies
        removes your access to it.
      </Notice>
      <form onSubmit={submit} className="profile-form">
        <label htmlFor="display-name">Display name</label>
        <input
          id="display-name"
          minLength={2}
          maxLength={40}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="small">
          Use a pseudonym if you join the optional leaderboard.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={leaderboard}
            onChange={(e) => setLeaderboard(e.target.checked)}
          />
          <span>
            Show my display name and learning XP on the learning leaderboard.
          </span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={analytics}
            onChange={(e) => setAnalytics(e.target.checked)}
          />
          <span>Allow optional learning analytics.</span>
        </label>
        <button className="button" disabled={busy}>
          {busy ? 'Saving preferences…' : 'Save preferences'}
        </button>
      </form>
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}
      <section className="learning-section">
        <h2>Your learning record</h2>
        <dl className="stats">
          <div>
            <dt>Lessons completed</dt>
            <dd>{profile.completed_lesson_ids.length}</dd>
          </div>
          <div>
            <dt>Mastery checks passed</dt>
            <dd>{profile.mastered_module_ids.length}</dd>
          </div>
          <div>
            <dt>Learning XP</dt>
            <dd>{profile.xp}</dd>
          </div>
        </dl>
        <p className="small">
          XP records verified learning checks and reviews. It does not measure
          financial performance.
        </p>
        <a className="text-link" href="#/leaderboard">
          View leaderboard settings and rankings →
        </a>
      </section>
    </>
  )
}
export function Leaderboard() {
  const resource = useResource<{
    opted_in: boolean
    basis: string
    entries: { rank: number; display_name: string; xp: number }[]
  }>('/leaderboard')
  return (
    <>
      <PageTitle
        eyebrow="Optional community view"
        description="Learning checks and delayed reviews are the only basis for this list."
      >
        Learning leaderboard
      </PageTitle>
      <ResourceState {...resource} />
      {resource.data && (
        <>
          <p className="intro">{resource.data.basis}.</p>
          {!resource.data.opted_in ? (
            <Notice>
              You are not taking part. Join through profile preferences if you
              want to share your display name and learning XP.{' '}
              <a href="#/profile">Open preferences →</a>
            </Notice>
          ) : resource.data.entries.length === 0 ? (
            <Notice>
              No opted-in learning records yet. Your progress remains available
              in your profile.
            </Notice>
          ) : (
            <ol className="ranking-list">
              {resource.data.entries.map((entry) => (
                <li key={`${entry.rank}-${entry.display_name}`}>
                  <span>{entry.rank}.</span>
                  <strong>{entry.display_name}</strong>
                  <span>{entry.xp} learning XP</span>
                </li>
              ))}
            </ol>
          )}
          <a className="text-link" href="#/profile">
            Manage participation →
          </a>
        </>
      )}
    </>
  )
}
