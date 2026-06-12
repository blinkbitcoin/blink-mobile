import { resolveAccountKey } from "./account-key"
import { PersistentState } from "./state-migrations"

export const getStablesatsRestricted = (state: PersistentState): boolean => {
  const key = resolveAccountKey(state)
  return state.stablesatsRestrictedByAccountId?.[key] ?? false
}

export const withStablesatsRestricted = (state: PersistentState): PersistentState => {
  const key = resolveAccountKey(state)
  return {
    ...state,
    stablesatsRestrictedByAccountId: {
      ...state.stablesatsRestrictedByAccountId,
      [key]: true,
    },
  }
}
