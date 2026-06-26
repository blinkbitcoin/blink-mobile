import { PersistentState } from "./state-migrations"

export const getStableTokenTransferBlocked = (state: PersistentState): boolean =>
  state.stableTokenTransferBlocked ?? false

export const withStableTokenTransferBlocked = (
  state: PersistentState,
): PersistentState => ({
  ...state,
  stableTokenTransferBlocked: true,
})
