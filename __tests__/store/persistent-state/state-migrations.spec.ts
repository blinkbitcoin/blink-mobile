import {
  defaultPersistentState,
  migratePersistentState,
  MigrationStatus,
  type PersistentState,
} from "@app/store/persistent-state/state-migrations"

// Backwards-compat shim for the existing happy-path tests: prior signature
// returned the migrated state directly, falling back to defaults. New API
// returns a discriminated result; this shim mirrors the old getter.
const migrateAndGetPersistentState = async (data: unknown): Promise<PersistentState> => {
  const result = await migratePersistentState(data)
  return result.status === MigrationStatus.Ok ? result.state : defaultPersistentState
}

describe("state-migrations schema 10", () => {
  it("migrates schema 6 to current with activeAccountId undefined", async () => {
    const state6 = {
      schemaVersion: 6,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "test-token",
    }

    const result = await migrateAndGetPersistentState(state6)

    expect(result.schemaVersion).toBe(11)
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

    expect(result.schemaVersion).toBe(11)
    expect(result.activeAccountId).toBe("custodial-default")
  })

  it("migrates schema 5 through to current", async () => {
    const state5 = {
      schemaVersion: 5,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "old-token",
    }

    const result = await migrateAndGetPersistentState(state5)

    expect(result.schemaVersion).toBe(11)
    expect(result.galoyAuthToken).toBe("old-token")
    expect(result.activeAccountId).toBeUndefined()
  })

  it("moves legacy single-account currency into the active self-custodial slot and clears the legacy field", async () => {
    const state9 = {
      schemaVersion: 9,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id",
      selfCustodialDefaultWalletCurrency: "USD",
    }

    const result = await migrateAndGetPersistentState(state9)

    expect(result.schemaVersion).toBe(11)
    expect(result.selfCustodialDefaultWalletCurrency).toBeUndefined()
    expect(result.selfCustodialDefaultWalletCurrencyByAccountId).toEqual({
      "self-custodial-id": "USD",
    })
  })

  it("preserves schema 10 per-account currency map as-is", async () => {
    const state10 = {
      schemaVersion: 10,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      selfCustodialDefaultWalletCurrencyByAccountId: {
        "self-custodial-id-1": "USD",
        "self-custodial-id-2": "BTC",
      },
    }

    const result = await migrateAndGetPersistentState(state10)

    expect(result.schemaVersion).toBe(11)
    expect(result.selfCustodialDefaultWalletCurrencyByAccountId).toEqual({
      "self-custodial-id-1": "USD",
      "self-custodial-id-2": "BTC",
    })
  })

  it("migrates schema 10 to 11 leaving the new per-account maps undefined", async () => {
    const state10 = {
      schemaVersion: 10,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
    }

    const result = await migrateAndGetPersistentState(state10)

    expect(result.schemaVersion).toBe(11)
    expect(result.selfCustodialDisplayCurrencyByAccountId).toBeUndefined()
    expect(result.selfCustodialLanguageByAccountId).toBeUndefined()
  })

  it("preserves schema 11 per-account display currency and language maps as-is", async () => {
    const state11 = {
      schemaVersion: 11,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      selfCustodialDisplayCurrencyByAccountId: {
        "self-custodial-id-1": "EUR",
        "self-custodial-id-2": "JPY",
      },
      selfCustodialLanguageByAccountId: {
        "self-custodial-id-1": "es",
        "self-custodial-id-2": "fr",
      },
    }

    const result = await migrateAndGetPersistentState(state11)

    expect(result.schemaVersion).toBe(11)
    expect(result.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "self-custodial-id-1": "EUR",
      "self-custodial-id-2": "JPY",
    })
    expect(result.selfCustodialLanguageByAccountId).toEqual({
      "self-custodial-id-1": "es",
      "self-custodial-id-2": "fr",
    })
  })

  it("returns default state for invalid data", async () => {
    const result = await migrateAndGetPersistentState({ schemaVersion: 999 })

    expect(result).toEqual(defaultPersistentState)
  })

  it("returns default state for null data", async () => {
    const result = await migrateAndGetPersistentState(null)

    expect(result).toEqual(defaultPersistentState)
  })

  it("migrates schema 4 through to current", async () => {
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

    expect(result.schemaVersion).toBe(11)
    expect(result.galoyAuthToken).toBe("token-v4")
    expect(result.galoyInstance).toEqual({ id: "Main" })
    expect(result.activeAccountId).toBeUndefined()
  })

  it("migrates schema 3 through full chain to current", async () => {
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

    expect(result.schemaVersion).toBe(11)
    expect(result.galoyAuthToken).toBe("token-v3")
    expect(result.galoyInstance).toEqual({ id: "Main" })
    expect(result.activeAccountId).toBeUndefined()
  })

  it("default state has schema version 11", () => {
    expect(defaultPersistentState.schemaVersion).toBe(11)
    expect(defaultPersistentState.activeAccountId).toBeUndefined()
    expect(
      defaultPersistentState.selfCustodialDefaultWalletCurrencyByAccountId,
    ).toBeUndefined()
  })

  it("attributes legacy 'USD' from schema 8 to the active self-custodial slot and clears the legacy field", async () => {
    const state8 = {
      schemaVersion: 8,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id",
      selfCustodialDefaultWalletCurrency: "USD",
    }

    const result = await migrateAndGetPersistentState(state8)

    expect(result.schemaVersion).toBe(11)
    expect(result.selfCustodialDefaultWalletCurrency).toBeUndefined()
    expect(result.selfCustodialDefaultWalletCurrencyByAccountId).toEqual({
      "self-custodial-id": "USD",
    })
    expect(result.activeAccountId).toBe("self-custodial-id")
  })

  it("attributes legacy 'BTC' from schema 8 to the active self-custodial slot and clears the legacy field", async () => {
    const state8 = {
      schemaVersion: 8,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id",
      selfCustodialDefaultWalletCurrency: "BTC",
    }

    const result = await migrateAndGetPersistentState(state8)

    expect(result.schemaVersion).toBe(11)
    expect(result.selfCustodialDefaultWalletCurrency).toBeUndefined()
    expect(result.selfCustodialDefaultWalletCurrencyByAccountId).toEqual({
      "self-custodial-id": "BTC",
    })
  })

  it("leaves selfCustodialDefaultWalletCurrency undefined when absent from schema 8", async () => {
    const state8 = {
      schemaVersion: 8,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
    }

    const result = await migrateAndGetPersistentState(state8)

    expect(result.schemaVersion).toBe(11)
    expect(result.selfCustodialDefaultWalletCurrency).toBeUndefined()
    expect(result.selfCustodialDefaultWalletCurrencyByAccountId).toBeUndefined()
  })

  it("clears the legacy field on schema 9 → 11 even when no active account is set", async () => {
    const state9 = {
      schemaVersion: 9,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      selfCustodialDefaultWalletCurrency: "USD",
    }

    const result = await migrateAndGetPersistentState(state9)

    expect(result.schemaVersion).toBe(11)
    expect(result.selfCustodialDefaultWalletCurrency).toBeUndefined()
    expect(result.selfCustodialDefaultWalletCurrencyByAccountId).toBeUndefined()
  })

  it("clears the legacy field when active is custodial — preference cannot be attributed", async () => {
    const state10 = {
      schemaVersion: 10,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "custodial-default",
      selfCustodialDefaultWalletCurrency: "USD",
    }

    const result = await migrateAndGetPersistentState(state10)

    expect(result.schemaVersion).toBe(11)
    expect(result.selfCustodialDefaultWalletCurrency).toBeUndefined()
    expect(result.selfCustodialDefaultWalletCurrencyByAccountId).toBeUndefined()
  })

  it("does NOT overwrite an existing per-account entry with the legacy value", async () => {
    const state10 = {
      schemaVersion: 10,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      selfCustodialDefaultWalletCurrency: "USD",
      selfCustodialDefaultWalletCurrencyByAccountId: {
        "self-custodial-id-1": "BTC",
        "self-custodial-id-2": "USD",
      },
    }

    const result = await migrateAndGetPersistentState(state10)

    expect(result.schemaVersion).toBe(11)
    expect(result.selfCustodialDefaultWalletCurrency).toBeUndefined()
    expect(result.selfCustodialDefaultWalletCurrencyByAccountId).toEqual({
      "self-custodial-id-1": "BTC",
      "self-custodial-id-2": "USD",
    })
  })

  describe("migratePersistentState — discriminated result", () => {
    it("returns status='failed' with the thrown Error and the original rawData when a migration throws", async () => {
      // Schema 3 with a galoyInstance.name not in GALOY_INSTANCES triggers
      // migrate3ToCurrent's `throw new Error("Galoy instance not found")`.
      const corruptedState3 = {
        schemaVersion: 3,
        hasShownStableSatsWelcome: false,
        isUsdDisabled: false,
        galoyInstance: { id: "Main", name: "DefinitelyNotARealInstance" },
        galoyAuthToken: "token-v3",
        isAnalyticsEnabled: true,
      }

      const result = await migratePersistentState(corruptedState3)

      expect(result.status).toBe(MigrationStatus.Failed)
      if (result.status === MigrationStatus.Failed) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toContain("Galoy instance not found")
        expect(result.rawData).toEqual(corruptedState3)
      }
    })

    it("returns status='no-data' for an unknown schemaVersion (no error, no rawData payload)", async () => {
      const result = await migratePersistentState({ schemaVersion: 999 })
      expect(result).toEqual({ status: MigrationStatus.NoData })
    })

    it("returns status='no-data' for null input", async () => {
      const result = await migratePersistentState(null)
      expect(result).toEqual({ status: MigrationStatus.NoData })
    })

    it("wraps a non-Error rejection into an Error when a migration throws a primitive", async () => {
      const state = {
        schemaVersion: 3,
        hasShownStableSatsWelcome: false,
        isUsdDisabled: false,
        galoyInstance: { id: "Main", name: "definitely-not-real" },
        galoyAuthToken: "token",
        isAnalyticsEnabled: false,
      }

      const result = await migratePersistentState(state)

      expect(result.status).toBe(MigrationStatus.Failed)
      if (result.status === MigrationStatus.Failed) {
        expect(result.error).toBeInstanceOf(Error)
      }
    })
  })
})
