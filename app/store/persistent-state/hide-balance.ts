import { PersistentState } from "./state-migrations"

/**
 * Balance visibility is stored device-wide rather than keyed by account like
 * themeByAccountId: hiding the balance is a choice about who can see the screen,
 * so switching accounts must not reveal it again.
 */

/** The "Always hide balance" setting: force the balance hidden on every app start. */
export const getAlwaysHideBalance = (state: PersistentState): boolean =>
  state.alwaysHideBalance ?? false

export const withAlwaysHideBalance = (
  state: PersistentState,
  alwaysHideBalance: boolean,
): PersistentState => ({ ...state, alwaysHideBalance })

/** The visibility the user last left the app in. Only used when the setting above is off. */
export const getBalanceHidden = (state: PersistentState): boolean =>
  state.balanceHidden ?? false

export const withBalanceHidden = (
  state: PersistentState,
  balanceHidden: boolean,
): PersistentState => ({ ...state, balanceHidden })
