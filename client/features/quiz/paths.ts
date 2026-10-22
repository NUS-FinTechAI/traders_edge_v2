/** Quiz attempt URL; `topic` lets the results screen offer a retry. */
export function attemptPath(attemptId: string, topicId?: string): string {
  const path = `/quiz/attempt/${encodeURIComponent(attemptId)}`
  return topicId ? `${path}?topic=${encodeURIComponent(topicId)}` : path
}

/** The quiz page that lists a topic: the chapter quizzes or the daily quiz. */
export function topicListPath(topicId: string | null): string {
  if (!topicId) return '/quiz'
  return topicId.startsWith('chapter-') ? '/quiz/chapters' : '/quiz/daily'
}
