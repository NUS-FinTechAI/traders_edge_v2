import type { ReactNode } from 'react'
import type { Source } from '../api'
import foxImage from '../assets/fox-guide.webp'

export function Fox({ children }: { children: ReactNode }) {
  return (
    <div className="guide-note">
      <img
        src={foxImage}
        width="1211"
        height="1299"
        alt=""
        loading="lazy"
        decoding="async"
      />
      <p>{children}</p>
    </div>
  )
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode
  error?: boolean
}) {
  return (
    <div
      className={`notice${error ? ' error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}
export function PageTitle({
  eyebrow,
  children,
  description,
}: {
  eyebrow?: string
  children: ReactNode
  description?: string
}) {
  return (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h1 tabIndex={-1}>{children}</h1>
      {description && <p className="intro">{description}</p>}
    </>
  )
}
export function ResourceState({
  loading,
  error,
  reload,
}: {
  loading: boolean
  error: string
  reload: () => void
}) {
  return (
    <>
      {loading && <Notice>Loading your learning content…</Notice>}
      {error && (
        <Notice error>
          <p>{error}</p>
          <button className="button secondary" onClick={reload}>
            Try again
          </button>
        </Notice>
      )}
    </>
  )
}
export function Sources({
  ids,
  sources,
}: {
  ids?: string[]
  sources: Source[]
}) {
  const selected = ids
    ? sources.filter((source) => ids.includes(source.id))
    : sources
  if (!selected.length) return null
  return (
    <details className="definition">
      <summary>Sources for this explanation</summary>
      <ul className="source-list">
        {selected.map((source) => (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
              <span className="visually-hidden"> (opens a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  )
}
