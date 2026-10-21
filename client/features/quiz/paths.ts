/** Quiz attempt URL; `topic` lets the results screen offer a retry. */
export function attemptPath(attemptId: string, topicId?: string): string {
  const path = `/quiz/attempt/${encodeURIComponent(attemptId)}`
  return topicId ? `${path}?topic=${encodeURIComponent(topicId)}` : path
}
