import {
  defaultPersistentState,
  migrateAndGetPersistentState,
} from "@app/store/persistent-state/state-migrations"

describe("state-migrations schema 7", () => {
  it("migrates schema 6 to 7 with activeAccountId undefined", async () => {
    const state6 = {
      schemaVersion: 6,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "test-token",
    }

    const result = await migrateAndGetPersistentState(state6)

    expect(result.schemaVersion).toBe(7)
    expect(result.galoyAuthToken).toBe("test-token")
    expect(result.galoyInstance).toEqual({ id: "Main" })
    expect(result.activeAccountId).toBeUndefined()
  })

  it("preserves schema 7 data as-is", async () => {
    const state7 = {
      schemaVersion: 7,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "custodial-default",
    }

    const result = await migrateAndGetPersistentState(state7)

    expect(result.schemaVersion).toBe(7)
    expect(result.activeAccountId).toBe("custodial-default")
  })

  it("migrates schema 5 through to 7", async () => {
    const state5 = {
      schemaVersion: 5,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "old-token",
    }

    const result = await migrateAndGetPersistentState(state5)

    expect(result.schemaVersion).toBe(7)
    expect(result.galoyAuthToken).toBe("old-token")
    expect(result.activeAccountId).toBeUndefined()
  })

  it("returns default state for invalid data", async () => {
    const result = await migrateAndGetPersistentState({ schemaVersion: 999 })

    expect(result).toEqual(defaultPersistentState)
  })

  it("returns default state for null data", async () => {
    const result = await migrateAndGetPersistentState(null)

    expect(result).toEqual(defaultPersistentState)
  })

  it("default state has schema version 7", () => {
    expect(defaultPersistentState.schemaVersion).toBe(7)
    expect(defaultPersistentState.activeAccountId).toBeUndefined()
  })
})
