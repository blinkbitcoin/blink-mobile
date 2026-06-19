import { PersistentState } from "./state-migrations"

export const getCustodialMigrationRequired = (state: PersistentState): boolean =>
  state.custodialMigrationRequired ?? false

export const withCustodialMigrationRequired = (
  state: PersistentState,
): PersistentState => ({
  ...state,
  custodialMigrationRequired: true,
})
