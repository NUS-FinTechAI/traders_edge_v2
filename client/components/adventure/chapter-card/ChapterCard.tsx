import { Link } from 'react-router-dom'
import type { AdventureChapter } from '../../../services/adventureService.ts'
import { Star } from '../mission-stars/MissionStars.tsx'
import './ChapterCard.css'

export default function ChapterCard({
  chapter,
}: {
  chapter: AdventureChapter
}) {
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
