import { resolveAccountKey } from "./account-key"
import { PersistentState } from "./state-migrations"

/**
 * Learn/earn quiz progress kept on device. Custodial accounts read their progress
 * from the backend instead; this is the store for accounts the backend does not
 * track, so self-custodial users keep their place in the local quiz content.
 */
export const getCompletedQuizIds = (state: PersistentState): string[] =>
  state.completedQuizIdsByAccountId?.[resolveAccountKey(state)] ?? []

export const withCompletedQuizId = (
  state: PersistentState,
  quizId: string,
): PersistentState => {
  const key = resolveAccountKey(state)
  const completed = state.completedQuizIdsByAccountId?.[key] ?? []
  if (completed.includes(quizId)) return state

  return {
    ...state,
    completedQuizIdsByAccountId: {
      ...state.completedQuizIdsByAccountId,
      [key]: [...completed, quizId],
    },
  }
}
