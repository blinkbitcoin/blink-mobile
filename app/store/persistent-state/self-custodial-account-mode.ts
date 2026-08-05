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

/**
 * The account's stored mode, or undefined when it never passed the mode screen. Absent is
 * a real state consumers must handle rather than substitute a default for: it is not the
 * same as an explicit choice.
 */
export const getSelfCustodialAccountMode = (
  state: PersistentState,
  accountId: string,
): AccountMode | undefined => state.selfCustodialAccountModeByAccountId?.[accountId]
