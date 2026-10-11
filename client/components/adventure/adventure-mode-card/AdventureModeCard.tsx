import { Link } from 'react-router-dom'
import RouteEmblem from '../../icons/route-emblem/RouteEmblem.tsx'
import './AdventureModeCard.css'

export default function AdventureModeCard() {
  return (
    <Link className="adventure-home-card" to="/adventure">
      <RouteEmblem />
      <h3>Adventure Mode</h3>
      <p>
        Learn through chapters, complete missions and follow your progress on
        the map.
      </p>
      <span className="adventure-mode-link">
        Explore chapters <span aria-hidden="true">→</span>
      </span>
    </Link>
  )
}
