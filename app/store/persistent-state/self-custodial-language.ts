import { DefaultAccountId } from "@app/types/wallet"

import { PersistentState } from "./state-migrations"

const resolveActiveSelfCustodialId = (state: PersistentState): string | null => {
  const id = state.activeAccountId
  if (!id || id === DefaultAccountId.Custodial) return null
  return id
}

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
  return withSelfCustodialLanguageForAccount(state, id, language)
}

/** Writes for an explicit account id so a not-yet-active account (e.g. one provisioned
 *  mid-migration while the custodial account is still active) can be seeded. */
export const withSelfCustodialLanguageForAccount = (
  state: PersistentState,
  accountId: string,
  language: string,
): PersistentState => {
  if (!accountId || accountId === DefaultAccountId.Custodial) return state
  return {
    ...state,
    selfCustodialLanguageByAccountId: {
      ...state.selfCustodialLanguageByAccountId,
      [accountId]: language,
    },
  }
}
