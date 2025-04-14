import {
  defaultLocalStorageState,
  migrateAndGetLocalStorageState,
} from "@app/store/persistent-state/state-migrations"

describe("migrateAndGetLocalStorageState", () => {
  it("uses default state when none is present", async () => {
    const state = await migrateAndGetLocalStorageState({})
    expect(state).toEqual(defaultLocalStorageState)
  })

  it("migrates persistent state", async () => {
    const state = await migrateAndGetLocalStorageState({
      schemaVersion: 0,
      isUsdDisabled: true,
    })
    expect(state).toEqual({
      ...defaultLocalStorageState,
    })
  })

  it("returns default when schema is not present", async () => {
    const state = await migrateAndGetLocalStorageState({
      schemaVersion: -2,
    })
    expect(state).toEqual(defaultLocalStorageState)
  })

  it("migrates instance from 3 to 7 ", async () => {
    const state3 = {
      schemaVersion: 3,
      hasShownStableSatsWelcome: true,
      isUsdDisabled: true,
      galoyInstance: { id: "Main", name: "Blink" },
      galoyAuthToken: "token",
      isAnalyticsEnabled: false,
    }

    const state7 = {
      schemaVersion: 7,
      galoyInstance: { id: "Main" },
    }

    const res = await migrateAndGetLocalStorageState(state3)

    expect(res).toStrictEqual(state7)
  })

  it("migrates unknown instance from 3 to 7 ", async () => {
    const state3 = {
      schemaVersion: 3,
      hasShownStableSatsWelcome: true,
      isUsdDisabled: true,
      galoyInstance: { id: "Main", name: "Unknown" },
      galoyAuthToken: "token",
      isAnalyticsEnabled: false,
    }

    const state7 = {
      schemaVersion: 7,
      galoyInstance: { id: "Main" },
    }

    const res = await migrateAndGetLocalStorageState(state3)

    expect(res).toStrictEqual(state7)
  })

  it("migrates Blink instance from 4 to 7 ", async () => {
    const state4 = {
      schemaVersion: 4,
      hasShownStableSatsWelcome: true,
      isUsdDisabled: true,
      galoyInstance: { id: "Main", name: "Blink" },
      galoyAuthToken: "token",
      isAnalyticsEnabled: false,
    }

    const state7 = {
      schemaVersion: 7,
      galoyInstance: { id: "Main" },
    }

    const res = await migrateAndGetLocalStorageState(state4)

    expect(res).toStrictEqual(state7)
  })

  it("migrates Staging instance from 4 to 7 ", async () => {
    const state4 = {
      schemaVersion: 4,
      hasShownStableSatsWelcome: true,
      isUsdDisabled: true,
      galoyInstance: { id: "Main", name: "Staging" },
      galoyAuthToken: "token",
      isAnalyticsEnabled: false,
    }

    const state7 = {
      schemaVersion: 7,
      galoyInstance: { id: "Staging" },
    }

    const res = await migrateAndGetLocalStorageState(state4)

    expect(res).toStrictEqual(state7)
  })

  it("migrates Local instance from 4 to 7 ", async () => {
    const state4 = {
      schemaVersion: 4,
      hasShownStableSatsWelcome: true,
      isUsdDisabled: true,
      galoyInstance: { id: "Main", name: "Local" },
      galoyAuthToken: "token",
      isAnalyticsEnabled: false,
    }

    const state7 = {
      schemaVersion: 7,
      galoyInstance: { id: "Local" },
    }

    const res = await migrateAndGetLocalStorageState(state4)

    expect(res).toStrictEqual(state7)
  })

  it("migrates BBW instance from 4 to 7", async () => {
    const state4 = {
      schemaVersion: 4,
      hasShownStableSatsWelcome: true,
      isUsdDisabled: true,
      galoyInstance: { id: "Main", name: "BBW" },
      galoyAuthToken: "token",
      isAnalyticsEnabled: false,
    }

    const state7 = {
      schemaVersion: 7,
      galoyInstance: { id: "Main" },
    }

    const res = await migrateAndGetLocalStorageState(state4)

    expect(res).toStrictEqual(state7)
  })

  it("migrates Custom instance from 4 to 7", async () => {
    const state4 = {
      schemaVersion: 4,
      hasShownStableSatsWelcome: true,
      isUsdDisabled: true,
      galoyInstance: { id: "Main", name: "Custom" },
      galoyAuthToken: "token",
      isAnalyticsEnabled: false,
    }

    const state7 = {
      schemaVersion: 7,
      galoyInstance: { id: "Custom", name: "Custom" },
    }

    const res = await migrateAndGetLocalStorageState(state4)

    expect(res).toStrictEqual(state7)
  })

  it("migration from 5 to 7", async () => {
    const state5 = {
      schemaVersion: 5,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "myToken",
    }

    const state7 = {
      schemaVersion: 7,
      galoyInstance: { id: "Main" },
    }

    const res = await migrateAndGetLocalStorageState(state5)

    expect(res).toStrictEqual(state7)
  })
})
