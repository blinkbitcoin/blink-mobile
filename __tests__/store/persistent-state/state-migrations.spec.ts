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

  it("migrates schema 4 through to 7", async () => {
    const state4 = {
      schemaVersion: 4,
      hasShownStableSatsWelcome: false,
      isUsdDisabled: false,
      galoyInstance: {
        id: "Main",
        name: "Blink",
        graphqlUri: "https://api.blink.sv/graphql",
        graphqlWsUri: "wss://ws.blink.sv/graphql",
        authUrl: "https://api.blink.sv",
        posUrl: "https://pay.blink.sv",
        kycUrl: "https://kyc.blink.sv",
        lnAddressHostname: "blink.sv",
        blockExplorer: "https://mempool.space/tx/",
        fiatUrl: "https://fiat.blink.sv",
      },
      galoyAuthToken: "token-v4",
      isAnalyticsEnabled: true,
    }

    const result = await migrateAndGetPersistentState(state4)

    expect(result.schemaVersion).toBe(7)
    expect(result.galoyAuthToken).toBe("token-v4")
    expect(result.galoyInstance).toEqual({ id: "Main" })
    expect(result.activeAccountId).toBeUndefined()
  })

  it("migrates schema 3 through full chain to 7", async () => {
    const state3 = {
      schemaVersion: 3,
      hasShownStableSatsWelcome: false,
      isUsdDisabled: false,
      galoyInstance: {
        id: "Main",
        name: "Blink",
        graphqlUri: "https://api.blink.sv/graphql",
        graphqlWsUri: "wss://ws.blink.sv/graphql",
        authUrl: "https://api.blink.sv",
        posUrl: "https://pay.blink.sv",
        kycUrl: "https://kyc.blink.sv",
        lnAddressHostname: "blink.sv",
        blockExplorer: "https://mempool.space/tx/",
        fiatUrl: "https://fiat.blink.sv",
      },
      galoyAuthToken: "token-v3",
      isAnalyticsEnabled: true,
    }

    const result = await migrateAndGetPersistentState(state3)

    expect(result.schemaVersion).toBe(7)
    expect(result.galoyAuthToken).toBe("token-v3")
    expect(result.galoyInstance).toEqual({ id: "Main" })
    expect(result.activeAccountId).toBeUndefined()
  })

  it("default state has schema version 7", () => {
    expect(defaultPersistentState.schemaVersion).toBe(7)
    expect(defaultPersistentState.activeAccountId).toBeUndefined()
  })
})
