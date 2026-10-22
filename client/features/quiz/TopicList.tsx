import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startAttempt, type QuizTopic } from '../../services/quizService.ts'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'
import { attemptPath } from './paths.ts'
import TopicCard from './TopicCard.tsx'
import styles from './Quiz.module.css'

/** Quiz topic cards whose Start button opens a new attempt. */
export default function TopicList({
  topics,
  featured = false,
}: {
  topics: QuizTopic[]
  featured?: boolean
}) {
  const navigate = useNavigate()
  const notify = useToast()
  const [busy, setBusy] = useState(false)

  async function begin(topicId: string) {
    setBusy(true)
    try {
      const attempt = await startAttempt({ topic_id: topicId })
      void navigate(attemptPath(attempt.id, topicId))
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(false)
    }
  }

  return (
    <ul className={featured ? styles.featuredGrid : styles.topics}>
      {topics.map((topic) => (
        <TopicCard
          key={topic.id}
          topic={topic}
          busy={busy}
          onStart={() => void begin(topic.id)}
        />
      ))}
    </ul>
  )
}
