import './RouteEmblem.css'

export default function RouteEmblem() {
  return (
    <svg className="adventure-emblem" viewBox="0 0 160 112" aria-hidden="true">
      <path
        className="emblem-paper"
        d="m12 20 44-12 48 12 44-12v83l-44 13-48-13-44 13Z"
      />
      <path d="M56 8v83m48-71v84" />
      <path
        className="emblem-trail"
        d="M30 75c-2-30 48 12 47-20S124 68 125 34"
      />
      <circle cx="30" cy="75" r="5" />
      <path d="m119 27 12 12m0-12-12 12" />
    </svg>
  )
}
