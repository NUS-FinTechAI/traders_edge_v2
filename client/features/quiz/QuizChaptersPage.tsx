import { getQuizzes } from '../../services/quizService.ts'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState } from '../../ui/States.tsx'
import useResource from '../../ui/useResource.ts'
import TopicList from './TopicList.tsx'
import styles from './Quiz.module.css'

export default function QuizChaptersPage() {
  const resource = useResource(getQuizzes)
  return (
    <div className={styles.hub}>
      <PageHeader
        back={{ to: '/quiz', label: 'Quiz' }}
        eyebrow="Pass at 80%"
        title="Chapter Quizzes"
        subtitle="Each chapter’s quiz opens with that chapter on the Adventure map."
      />
      <ResourceView resource={resource} label="Loading quizzes…">
        {({ topics }) => {
          const chapters = topics.filter((topic) => topic.kind === 'chapter')
          return chapters.length ? (
            <TopicList topics={chapters} />
          ) : (
            <EmptyState icon="quiz" title="No chapter quizzes yet" />
          )
        }}
      </ResourceView>
    </div>
  )
}
