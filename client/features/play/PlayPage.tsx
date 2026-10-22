import { Link, Navigate, useLocation } from 'react-router-dom'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import HubCards, { type HubCard } from './HubCards.tsx'
import ResumeMatches from './ResumeMatches.tsx'
import styles from './Play.module.css'

const CARDS: HubCard[] = [
  {
    to: '/play/daily',
    emblem: 'calendar',
    tone: 'gold',
    title: 'Daily Challenge',
    text: 'A new rival every day',
    cta: 'Play',
    primary: true,
  },
  {
    to: '/play/practice',
    emblem: 'infinity',
    tone: 'green',
    title: 'Practice Arena',
    text: 'Trade without limits',
    cta: 'Practise',
  },
  {
    to: '/play/bosses',
    emblem: 'crown',
    tone: 'gem',
    title: 'Boss Battles',
    text: 'Face each chapter’s bosses',
    cta: 'Battle',
  },
  {
    to: '/multiplayer',
    emblem: 'swords',
    tone: 'info',
    title: 'Multiplayer',
    text: 'Lobbies and ranked matches',
    cta: 'Compete',
  },
]

export default function PlayPage() {
  const { hash } = useLocation()
  if (hash === '#practice') return <Navigate to="/play/practice" replace />

  return (
    <div className={styles.page}>
      <PageHeader
        title="Play"
        subtitle="Pick a challenge. Profit decides the match; your missions show what you learned."
      />
      <ResumeMatches />
      <HubCards cards={CARDS} label="Game modes" />
      <Link to="/leaderboard" className={styles.entry}>
        <Emblem name="podium" size={56} tone="gold" />
        <span className={styles.entryText}>
          <strong>Leaderboard</strong>
          <span className={styles.muted}>See where you rank</span>
        </span>
        <Icon name="chevron-right" />
      </Link>
    </div>
  )
}
