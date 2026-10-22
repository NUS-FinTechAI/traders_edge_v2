import PageHeader from '../../ui/PageHeader.tsx'
import HubCards, { type HubCard } from '../play/HubCards.tsx'
import styles from './Quiz.module.css'

const CARDS: HubCard[] = [
  {
    to: '/quiz/daily',
    emblem: 'calendar',
    tone: 'info',
    title: 'Daily Quiz',
    text: 'A short daily review and a mixed quiz',
    cta: 'Review',
    primary: true,
  },
  {
    to: '/quiz/chapters',
    emblem: 'book',
    tone: 'gem',
    title: 'Chapter Quizzes',
    text: 'One quiz per chapter, passed at 80%',
    cta: 'Choose',
  },
  {
    to: '/quiz/classroom',
    emblem: 'users',
    tone: 'gold',
    title: 'Classroom',
    text: 'Join or host a quiz with your class',
    cta: 'Open',
  },
]

export default function QuizHubPage() {
  return (
    <div className={styles.hub}>
      <PageHeader
        title="Quiz"
        subtitle="Test what you know. No timers, retry any time."
      />
      <HubCards cards={CARDS} label="Quiz types" />
    </div>
  )
}
