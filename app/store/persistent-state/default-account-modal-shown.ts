import { resolveAccountKey } from "./account-key"
import { PersistentState } from "./state-migrations"

export const getDefaultAccountModalShown = (state: PersistentState): boolean => {
  const key = resolveAccountKey(state)
  return state.defaultAccountModalShownByAccountId?.[key] ?? false
}

export const withDefaultAccountModalShown = (state: PersistentState): PersistentState => {
  const key = resolveAccountKey(state)
  return {
    ...state,
    defaultAccountModalShownByAccountId: {
      ...state.defaultAccountModalShownByAccountId,
      [key]: true,
    },
  }
}
