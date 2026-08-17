import { useCallback, useMemo } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getCompletedQuizIds,
  withCompletedQuizId,
} from "@app/store/persistent-state/quiz-completions"

type QuizCompletionsReturn = {
  completedQuizIds: string[]
  markQuizCompleted: (quizId: string) => void
}

export const useQuizCompletions = (): QuizCompletionsReturn => {
  const { persistentState, updateState } = usePersistentStateContext()

  const markQuizCompleted = useCallback(
    (quizId: string) => {
      updateState((prev) => prev && withCompletedQuizId(prev, quizId))
    },
    [updateState],
  )

  const completedQuizIds = useMemo(
    () => getCompletedQuizIds(persistentState),
    [persistentState],
  )

  return { completedQuizIds, markQuizCompleted }
}
