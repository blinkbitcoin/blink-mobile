import { AccountMode } from "@app/types/account"

import { withSelfCustodialAccountMode } from "./self-custodial-account-mode"
import { PersistentState } from "./state-migrations"

/**
 * The mode the LNURL server last confirmed, kept beside the chosen mode rather than folded
 * into it so a push that never landed stays visible as work still owed: the two
 * disagreeing is the signal to push again.
 */
export const getSelfCustodialServerAccountMode = (
  state: PersistentState,
  accountId: string,
): AccountMode | null =>
  state.selfCustodialServerAccountModeByAccountId?.[accountId] ?? null

export const withSelfCustodialServerAccountMode = (
  state: PersistentState,
  accountId: string,
  mode: AccountMode,
): PersistentState => ({
  ...state,
  selfCustodialServerAccountModeByAccountId: {
    ...state.selfCustodialServerAccountModeByAccountId,
    [accountId]: mode,
  },
})

/**
 * Settles an account's mode from what the server reported. A mode it holds is adopted and
 * recorded as confirmed, so nothing is pushed back at it.
 *
 * **A null answer settles nothing.** This used to write `Enhanced` for an account the
 * server held no mode for, so that the sync would push it and the Lightning Address would
 * come alive — and every consumer downstream, the telemetry gate included, then read that
 * default as a choice the user had made. It was the fail-open the whole mode design exists
 * to prevent, sitting in the one place a default looked like an answer (AD-25). An account
 * the server holds no mode for stays mode-less until the user picks one; nothing is
 * assumed on their behalf.
 *
 * Only ever called with an answer the server actually gave: assuming one it never gave
 * would push Enhanced over an Anon it holds but could not report.
 */
export const withSelfCustodialModeFromServer = (
  state: PersistentState,
  accountId: string,
  serverMode: AccountMode | null,
): PersistentState => {
  if (!serverMode) return state
  return withSelfCustodialServerAccountMode(
    withSelfCustodialAccountMode(state, accountId, serverMode),
    accountId,
    serverMode,
  )
}
