import { PersistentState } from "./state-migrations"

export const getFirstSeenCountryCode = (state: PersistentState): string | undefined =>
  state.firstSeenCountryCode

export const withFirstSeenCountryCode = (
  state: PersistentState,
  countryCode: string,
): PersistentState => ({
  ...state,
  firstSeenCountryCode: countryCode,
})
