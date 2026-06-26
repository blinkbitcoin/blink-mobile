import { PersistentState } from "./state-migrations"

export const getStablesatsTransferBlocked = (state: PersistentState): boolean =>
  state.stablesatsTransferBlocked ?? false

export const withStablesatsTransferBlocked = (
  state: PersistentState,
): PersistentState => ({
  ...state,
  stablesatsTransferBlocked: true,
})
