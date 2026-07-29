import { AccountMode } from "@app/types/account"

import { PersistentState } from "./state-migrations"

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
