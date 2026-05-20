import {
  migratePersistentState,
  MigrationStatus,
} from "../app/store/persistent-state/state-migrations"

it("reports no-data for an empty object (no schemaVersion key)", async () => {
  const result = await migratePersistentState({})
  expect(result).toEqual({ status: MigrationStatus.NoData })
})

it("reports no-data for an unknown schemaVersion", async () => {
  const result = await migratePersistentState({
    schemaVersion: 0,
    isUsdDisabled: true,
  })
  expect(result).toEqual({ status: MigrationStatus.NoData })
})

it("reports no-data for a negative schemaVersion", async () => {
  const result = await migratePersistentState({ schemaVersion: -2 })
  expect(result).toEqual({ status: MigrationStatus.NoData })
})

it("migration from 5 to current returns ok with the migrated state", async () => {
  const state5 = {
    schemaVersion: 5,
    galoyInstance: { id: "Main" },
    galoyAuthToken: "myToken",
  }

  const result = await migratePersistentState(state5)

  expect(result).toEqual({
    status: MigrationStatus.Ok,
    state: {
      schemaVersion: 11,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "myToken",
    },
  })
})
