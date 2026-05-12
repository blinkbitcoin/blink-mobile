import { DefaultAccountId } from "@app/types/wallet"

import { PersistentState } from "./state-migrations"

export const DEFAULT_LANGUAGE = "DEFAULT"

const resolveActiveSelfCustodialId = (state: PersistentState): string | null => {
  const id = state.activeAccountId
  if (!id || id === DefaultAccountId.Custodial) return null
  return id
}

export const getSelfCustodialLanguage = (state: PersistentState): string => {
  const id = resolveActiveSelfCustodialId(state)
  if (!id) return DEFAULT_LANGUAGE
  return state.selfCustodialLanguageByAccountId?.[id] ?? DEFAULT_LANGUAGE
}

export const withSelfCustodialLanguage = (
  state: PersistentState,
  language: string,
): PersistentState => {
  const id = resolveActiveSelfCustodialId(state)
  if (!id) return state
  return {
    ...state,
    selfCustodialLanguageByAccountId: {
      ...state.selfCustodialLanguageByAccountId,
      [id]: language,
    },
  }
}
