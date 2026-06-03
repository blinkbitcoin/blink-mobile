import { DefaultAccountId } from "@app/types/wallet"

import { PersistentState } from "./state-migrations"

const resolveAccountKey = (state: PersistentState): string =>
  state.activeAccountId ?? DefaultAccountId.Custodial

export const getDefaultAccountModalShown = (state: PersistentState): boolean => {
  const key = resolveAccountKey(state)
  return state.defaultAccountModalShownByAccountId?.[key] ?? false
}

export const markDefaultAccountModalShown = (state: PersistentState): PersistentState => {
  const key = resolveAccountKey(state)
  return {
    ...state,
    defaultAccountModalShownByAccountId: {
      ...state.defaultAccountModalShownByAccountId,
      [key]: true,
    },
  }
}
