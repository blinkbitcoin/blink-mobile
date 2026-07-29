import { resolveActiveSelfCustodialId } from "./active-self-custodial-account"
import { PersistentState } from "./state-migrations"

export const getSelfCustodialLanguage = (state: PersistentState): string => {
  const id = resolveActiveSelfCustodialId(state)
  if (!id) return "DEFAULT"
  return state.selfCustodialLanguageByAccountId?.[id] ?? "DEFAULT"
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
