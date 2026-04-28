import {
  defaultPersistentState,
  migrateAndGetPersistentState,
} from "../app/store/persistent-state/state-migrations"

it("uses default state when none is present", async () => {
  const state = await migrateAndGetPersistentState({})
  expect(state).toEqual(defaultPersistentState)
})

it("migrates persistent state", async () => {
  const state = await migrateAndGetPersistentState({
    schemaVersion: 0,
    isUsdDisabled: true,
  })
  expect(state).toEqual({
    ...defaultPersistentState,
  })
})

it("returns default when schema is not present", async () => {
  const state = await migrateAndGetPersistentState({
    schemaVersion: -2,
  })
  expect(state).toEqual(defaultPersistentState)
})

it("migration from 5 to 8", async () => {
  const state5 = {
    schemaVersion: 5,
    galoyInstance: { id: "Main" },
    galoyAuthToken: "myToken",
  }

  const state8 = {
    schemaVersion: 8,
    galoyInstance: { id: "Main" },
    galoyAuthToken: "myToken",
  }

  const res = await migrateAndGetPersistentState(state5)

  expect(res).toStrictEqual(state8)
})
