import { Link } from 'react-router-dom'
import type {
  AdventureChapter,
  PublicAdventureChapter,
} from '../../../services/adventureService.ts'
import { Star } from '../mission-stars/MissionStars.tsx'
import './ChapterCard.css'

export default function ChapterCard({
  chapter,
}: {
  chapter: AdventureChapter | PublicAdventureChapter
}) {
  const preview = 'levels' in chapter
  const total = preview ? chapter.levels.length : chapter.total_required_levels
  return (
    <li className="adventure-chapter-card">
      <Link to={`/adventure/chapters/${encodeURIComponent(chapter.module_id)}`}>
        <div className="adventure-card-top">
          <span>Chapter {String(chapter.order).padStart(2, '0')}</span>
          <span className="adventure-status">
            {preview ? 'Preview' : chapter.unlocked ? 'Unlocked' : 'Locked'}
          </span>
        </div>
        <h2>{chapter.title}</h2>
        <div className="adventure-card-route" aria-hidden="true">
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={
                !preview && index < chapter.completed_required_levels
                  ? 'is-complete'
                  : ''
              }
            >
              {index + 1}
            </span>
          ))}
        </div>
        {preview ? (
          <p>Sign in to track progress</p>
        ) : (
          <>
            <p>
              {chapter.completed_required_levels}/{chapter.total_required_levels} levels
            </p>
            <div className="adventure-star-counts">
              <span>
                <Star />
                {chapter.normal_stars.earned}/{chapter.normal_stars.total}{' '}
              </span>
              <span>
                <Star special />
                {chapter.special_stars.earned}/{chapter.special_stars.total}{' '}
              </span>
            </div>
            <progress
              aria-label={`Chapter ${chapter.order} required levels completed`}
              value={chapter.completed_required_levels}
              max={Math.max(chapter.total_required_levels, 1)}
            />
          </>
        )}
        <span className="adventure-card-link">
          {!preview && chapter.unlocked ? 'Explore' : 'Preview'}{' '}
          <span aria-hidden="true">→</span>
        </span>
      </Link>
    </li>
  )
}
