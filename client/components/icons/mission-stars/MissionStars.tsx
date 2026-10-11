import './MissionStars.css'

export function NormalStar({ earned = true }: { earned?: boolean }) {
  return (
    <svg
      className={`adventure-star${earned ? '' : ' adventure-star-unearned'}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m12 2 3 6.5 7 1-5 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-5 7-1Z" />
    </svg>
  )
}

export function SpecialStar({ earned = true }: { earned?: boolean }) {
  return (
    <svg
      className={`adventure-star adventure-star-special${earned ? '' : ' adventure-star-unearned'}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m12 2 3 6 7 4-7 4-3 6-3-6-7-4 7-4Z" />
    </svg>
  )
}

export function StarLegend() {
  return (
    <ul className="adventure-legend" aria-label="Mission stars">
      <li>
        <NormalStar />
        <span>Normal star · required missions</span>
      </li>
      <li>
        <SpecialStar />
        <span>Special star · optional bonus</span>
      </li>
    </ul>
  )
}
