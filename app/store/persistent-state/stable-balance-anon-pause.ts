import { PersistentState } from "./state-migrations"

/**
 * Marks Stable Balance as switched off by Anon Mode rather than by the user, so leaving
 * Anon can put back what the mode took away. Keyed by account, like the mode itself:
 * one account entering Anon says nothing about another's setting.
 */
export const isStableBalanceAnonPaused = (
  state: PersistentState,
  accountId: string,
): boolean => Boolean(state.stableBalanceAnonPausedByAccountId?.[accountId])

export const withStableBalanceAnonPaused = (
  state: PersistentState,
  accountId: string,
  paused: boolean,
): PersistentState => ({
  ...state,
  stableBalanceAnonPausedByAccountId: {
    ...state.stableBalanceAnonPausedByAccountId,
    [accountId]: paused,
  },
})
