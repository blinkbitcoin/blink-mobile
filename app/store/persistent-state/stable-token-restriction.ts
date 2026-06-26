import { PersistentState } from "./state-migrations"

export const getStableTokenRestricted = (state: PersistentState): boolean =>
  state.stableTokenRestricted ?? false

export const withStableTokenRestricted = (state: PersistentState): PersistentState => ({
  ...state,
  stableTokenRestricted: true,
})
