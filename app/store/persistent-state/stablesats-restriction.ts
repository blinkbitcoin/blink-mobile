import { PersistentState } from "./state-migrations"

export const getStablesatsRestricted = (state: PersistentState): boolean =>
  state.stablesatsRestrictedCustodial ?? false

export const withStablesatsRestricted = (state: PersistentState): PersistentState => ({
  ...state,
  stablesatsRestrictedCustodial: true,
})
