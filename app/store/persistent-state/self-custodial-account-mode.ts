import { AccountMode } from "@app/types/account"

import { resolveActiveSelfCustodialId } from "./active-self-custodial-account"
import { PersistentState } from "./state-migrations"

/** Null when the active account is custodial or has not chosen a mode yet. */
export const getSelfCustodialAccountMode = (
  state: PersistentState,
): AccountMode | null => {
  const id = resolveActiveSelfCustodialId(state)
  if (!id) return null
  return state.selfCustodialAccountModeByAccountId?.[id] ?? null
}

/**
 * Stores the mode against an explicit account id, like the mnemonic and backup state: at
 * onboarding the target account is not always the active one (a migration provisions it
 * while custodial is still active), and each account keeps its own mode.
 */
export const withSelfCustodialAccountMode = (
  state: PersistentState,
  accountId: string,
  mode: AccountMode,
): PersistentState => ({
  ...state,
  selfCustodialAccountModeByAccountId: {
    ...state.selfCustodialAccountModeByAccountId,
    [accountId]: mode,
  },
})
