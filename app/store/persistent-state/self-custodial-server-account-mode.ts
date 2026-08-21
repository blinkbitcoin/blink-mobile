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
 * recorded as confirmed, so nothing is pushed back at it. No mode leaves the Enhanced
 * default unconfirmed, which is what makes the sync push it.
 *
 * Only ever called with an answer the server actually gave: assuming one it never gave
 * would push Enhanced over an Anon it holds but could not report.
 */
export const withSelfCustodialModeFromServer = (
  state: PersistentState,
  accountId: string,
  serverMode: AccountMode | null,
): PersistentState => {
  const withMode = withSelfCustodialAccountMode(
    state,
    accountId,
    serverMode ?? AccountMode.Enhanced,
  )
  if (!serverMode) return withMode
  return withSelfCustodialServerAccountMode(withMode, accountId, serverMode)
}
