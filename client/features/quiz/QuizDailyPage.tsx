import { getQuizzes } from '../../services/quizService.ts'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState } from '../../ui/States.tsx'
import useResource from '../../ui/useResource.ts'
import TopicList from './TopicList.tsx'
import styles from './Quiz.module.css'

export default function QuizDailyPage() {
  const resource = useResource(getQuizzes)
  return (
    <div className={styles.hub}>
      <PageHeader
        back={{ to: '/quiz', label: 'Quiz' }}
        title="Daily Quiz"
        subtitle="A new review each day from the chapters you have opened, plus a longer mixed quiz."
      />
      <ResourceView resource={resource} label="Loading quizzes…">
        {({ topics }) => {
          const review = topics.filter((topic) => topic.kind !== 'chapter')
          return review.length ? (
            <TopicList topics={review} featured />
          ) : (
            <EmptyState icon="calendar" title="No review quizzes yet" />
          )
        }}
      </ResourceView>
    </div>
  )
}
