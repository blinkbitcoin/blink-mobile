import { resolveAccountKey } from "./account-key"
import { PersistentState } from "./state-migrations"

export const getUsdbPrivacyWarningAcknowledged = (state: PersistentState): boolean => {
  const key = resolveAccountKey(state)
  return state.usdbPrivacyWarningAcknowledgedByAccountId?.[key] ?? false
}

export const withUsdbPrivacyWarningAcknowledged = (
  state: PersistentState,
): PersistentState => {
  const key = resolveAccountKey(state)
  return {
    ...state,
    usdbPrivacyWarningAcknowledgedByAccountId: {
      ...state.usdbPrivacyWarningAcknowledgedByAccountId,
      [key]: true,
    },
  }
}
