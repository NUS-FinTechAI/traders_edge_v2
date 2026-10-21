/** Duolingo-style check: a wrong answer sends the question to the back. */
export interface CheckQueue {
  queue: string[]
  firstTry: Record<string, boolean>
  streak: number
}

export function startQueue(ids: string[]): CheckQueue {
  return { queue: [...ids], firstTry: {}, streak: 0 }
}

export function answerQueue(
  state: CheckQueue,
  id: string,
  correct: boolean,
): CheckQueue {
  const rest = state.queue.filter((item) => item !== id)
  return {
    queue: correct ? rest : [...rest, id],
    firstTry:
      id in state.firstTry
        ? state.firstTry
        : { ...state.firstTry, [id]: correct },
    streak: correct ? state.streak + 1 : 0,
  }
}

export function firstTryCount(state: CheckQueue): number {
  return Object.values(state.firstTry).filter(Boolean).length
}
