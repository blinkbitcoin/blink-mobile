import {
  migratePersistentState,
  MigrationStatus,
} from "../app/store/persistent-state/state-migrations"

// A blob that exists but can't be read is Failed, not NoData: NoData now means
// "genuinely fresh install" and triggers the reinstall keychain wipe, so any
// present-but-unreadable blob must never be classified as it.

it("reports failed for an empty object (no schemaVersion key)", async () => {
  const rawData = {}
  const result = await migratePersistentState(rawData)
  expect(result.status).toBe(MigrationStatus.Failed)
  if (result.status === MigrationStatus.Failed) {
    expect(result.error.message).toContain("schemaVersion")
    expect(result.rawData).toBe(rawData)
  }
})

it("reports failed for an unknown schemaVersion", async () => {
  const rawData = { schemaVersion: 0, isUsdDisabled: true }
  const result = await migratePersistentState(rawData)
  expect(result.status).toBe(MigrationStatus.Failed)
  if (result.status === MigrationStatus.Failed) {
    expect(result.rawData).toBe(rawData)
  }
})

it("reports failed for a negative schemaVersion", async () => {
  const result = await migratePersistentState({ schemaVersion: -2 })
  expect(result.status).toBe(MigrationStatus.Failed)
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
      schemaVersion: 21,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "myToken",
    },
  })
})
