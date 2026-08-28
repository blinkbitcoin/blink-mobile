import {
  defaultPersistentState,
  migratePersistentState,
  MigrationStatus,
  type PersistentState,
} from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"

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

    expect(result.schemaVersion).toBe(21)
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

    expect(result.schemaVersion).toBe(21)
    expect(result.activeAccountId).toBe("custodial-default")
  })

  it("migrates schema 5 through to current", async () => {
    const state5 = {
      schemaVersion: 5,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "old-token",
    }

    const result = await migrateAndGetPersistentState(state5)

    expect(result.schemaVersion).toBe(21)
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

    expect(result.schemaVersion).toBe(21)
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

    expect(result.schemaVersion).toBe(21)
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

    expect(result.schemaVersion).toBe(21)
    expect(result.selfCustodialDisplayCurrencyByAccountId).toBeUndefined()
    expect(result.selfCustodialLanguageByAccountId).toBeUndefined()
  })

  it("preserves per-account display currency and language maps when migrating v12 to v13", async () => {
    const state12 = {
      schemaVersion: 12,
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

    const result = await migrateAndGetPersistentState(state12)

    expect(result.schemaVersion).toBe(21)
    expect(result.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "self-custodial-id-1": "EUR",
      "self-custodial-id-2": "JPY",
    })
    expect(result.selfCustodialLanguageByAccountId).toEqual({
      "self-custodial-id-1": "es",
      "self-custodial-id-2": "fr",
    })
  })

  it("migrates a v12 state to v13 preserving themeByAccountId", async () => {
    const state12 = {
      schemaVersion: 12,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      themeByAccountId: {
        "self-custodial-id-1": "dark" as const,
        "self-custodial-id-2": "light" as const,
      },
    }

    const result = await migrateAndGetPersistentState(state12)

    expect(result.schemaVersion).toBe(21)
    expect(result.themeByAccountId).toEqual({
      "self-custodial-id-1": "dark",
      "self-custodial-id-2": "light",
    })
  })

  it("migrates a v13 state to current preserving defaultAccountModalShownByAccountId", async () => {
    const state13 = {
      schemaVersion: 13,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      defaultAccountModalShownByAccountId: {
        "self-custodial-id-1": true,
        "self-custodial-id-2": false,
      },
    }

    const result = await migrateAndGetPersistentState(state13)

    expect(result.schemaVersion).toBe(21)
    expect(result.defaultAccountModalShownByAccountId).toEqual({
      "self-custodial-id-1": true,
      "self-custodial-id-2": false,
    })
  })

  it("drops the four persisted region latches when migrating v14 to current", async () => {
    const state14 = {
      schemaVersion: 14,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      stablesatsRestrictedCustodial: true,
      stableTokenRestricted: true,
      stablesatsTransferBlocked: true,
      stableTokenTransferBlocked: true,
    }

    const result = await migrateAndGetPersistentState(state14)

    expect(result.schemaVersion).toBe(21)
    expect(result).not.toHaveProperty("stablesatsRestrictedCustodial")
    expect(result).not.toHaveProperty("stableTokenRestricted")
    expect(result).not.toHaveProperty("stablesatsTransferBlocked")
    expect(result).not.toHaveProperty("stableTokenTransferBlocked")
  })

  it("preserves completedQuizIdsByAccountId while dropping the v15 latches", async () => {
    const state15 = {
      schemaVersion: 15,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      stablesatsRestrictedCustodial: true,
      completedQuizIdsByAccountId: {
        "self-custodial-id-1": ["whatIsBitcoin", "sat"],
      },
    }

    const result = await migrateAndGetPersistentState(state15)

    expect(result.schemaVersion).toBe(21)
    expect(result).not.toHaveProperty("stablesatsRestrictedCustodial")
    expect(result.completedQuizIdsByAccountId).toEqual({
      "self-custodial-id-1": ["whatIsBitcoin", "sat"],
    })
  })

  it("carries completedQuizIdsByAccountId through the v16 latch drop untouched", async () => {
    const state16 = {
      schemaVersion: 16,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      completedQuizIdsByAccountId: {
        "self-custodial-id-1": ["whatIsBitcoin", "sat"],
      },
    }

    const result = await migrateAndGetPersistentState(state16)

    expect(result.schemaVersion).toBe(21)
    expect(result.completedQuizIdsByAccountId).toEqual({
      "self-custodial-id-1": ["whatIsBitcoin", "sat"],
    })
  })

  it("leaves the balance visibility fields undefined when migrating from v15", async () => {
    const state15 = {
      schemaVersion: 15,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
    }

    const result = await migrateAndGetPersistentState(state15)

    expect(result.schemaVersion).toBe(21)
    expect(result.alwaysHideBalance).toBeUndefined()
    expect(result.balanceHidden).toBeUndefined()
  })

  it("carries the balance visibility fields through the v16 latch drop untouched", async () => {
    const state16 = {
      schemaVersion: 16,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      alwaysHideBalance: true,
      balanceHidden: true,
    }

    const result = await migrateAndGetPersistentState(state16)

    expect(result.schemaVersion).toBe(21)
    expect(result.alwaysHideBalance).toBe(true)
    expect(result.balanceHidden).toBe(true)
  })

  it("drops the four persisted region latches when migrating v16 to current", async () => {
    const state16 = {
      schemaVersion: 16,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      stablesatsRestrictedCustodial: true,
      stableTokenRestricted: true,
      stablesatsTransferBlocked: true,
      stableTokenTransferBlocked: true,
    }

    const result = await migrateAndGetPersistentState(state16)

    expect(result.schemaVersion).toBe(21)
    expect(result).not.toHaveProperty("stablesatsRestrictedCustodial")
    expect(result).not.toHaveProperty("stableTokenRestricted")
    expect(result).not.toHaveProperty("stablesatsTransferBlocked")
    expect(result).not.toHaveProperty("stableTokenTransferBlocked")
  })

  it("carries a whole v18 state to current, bumping only the schema version", async () => {
    const state18 = {
      schemaVersion: 18,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      alwaysHideBalance: true,
      balanceHidden: false,
      completedQuizIdsByAccountId: {
        "self-custodial-id-1": ["whatIsBitcoin", "sat"],
      },
      selfCustodialAccountModeByAccountId: {
        "self-custodial-id-1": AccountMode.Enhanced,
      },
    }

    const result = await migrateAndGetPersistentState(state18)

    expect(result).toEqual({ ...state18, schemaVersion: 21 })
  })

  it("leaves txLastSeenByAccountId undefined when migrating from v20", async () => {
    const state20 = {
      schemaVersion: 20,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
    }

    const result = await migrateAndGetPersistentState(state20)

    expect(result.schemaVersion).toBe(21)
    expect(result.txLastSeenByAccountId).toBeUndefined()
  })

  it("v21 identity migration preserves txLastSeenByAccountId untouched", async () => {
    const state21 = {
      schemaVersion: 21,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      txLastSeenByAccountId: {
        "self-custodial-id-1": { btcId: "btc-1", usdId: "usd-1" },
      },
    }

    const result = await migrateAndGetPersistentState(state21)

    expect(result.schemaVersion).toBe(21)
    expect(result.txLastSeenByAccountId).toEqual({
      "self-custodial-id-1": { btcId: "btc-1", usdId: "usd-1" },
    })
  })

  it("leaves completedQuizIdsByAccountId undefined when migrating from v14", async () => {
    const state14 = {
      schemaVersion: 14,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
    }

    const result = await migrateAndGetPersistentState(state14)

    expect(result.schemaVersion).toBe(21)
    expect(result.completedQuizIdsByAccountId).toBeUndefined()
  })

  it("carries no latch fields forward when migrating from a pre-latch v13 state", async () => {
    const state13 = {
      schemaVersion: 13,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
    }

    const result = await migrateAndGetPersistentState(state13)

    expect(result.schemaVersion).toBe(21)
    expect(result).not.toHaveProperty("stablesatsRestrictedCustodial")
  })

  it("migrates a v16 state to current, leaving the account mode undefined", async () => {
    const state16 = {
      schemaVersion: 16,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
    }

    const result = await migrateAndGetPersistentState(state16)

    expect(result.schemaVersion).toBe(21)
    expect(result.selfCustodialAccountModeByAccountId).toBeUndefined()
  })

  it("migrates a v18 state to current leaving the Anon pause marker unset", async () => {
    const state18 = {
      schemaVersion: 18,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      selfCustodialAccountModeByAccountId: { "self-custodial-id-1": "anon" },
    }

    const result = await migrateAndGetPersistentState(state18)

    expect(result.schemaVersion).toBe(21)
    expect(result.selfCustodialAccountModeByAccountId).toEqual({
      "self-custodial-id-1": "anon",
    })
    expect(result.stableBalanceAnonPausedByAccountId).toBeUndefined()
  })

  it("carries a v19 state to current, preserving the stored account modes", async () => {
    const state19 = {
      schemaVersion: 19,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      selfCustodialAccountModeByAccountId: {
        "self-custodial-id-1": "anon",
        "self-custodial-id-2": "enhanced",
      },
      completedQuizIdsByAccountId: {
        "self-custodial-id-1": ["whatIsBitcoin", "sat"],
      },
    }

    const result = await migrateAndGetPersistentState(state19)

    expect(result.schemaVersion).toBe(21)
    expect(result.selfCustodialAccountModeByAccountId).toEqual({
      "self-custodial-id-1": "anon",
      "self-custodial-id-2": "enhanced",
    })
    expect(result.completedQuizIdsByAccountId).toEqual({
      "self-custodial-id-1": ["whatIsBitcoin", "sat"],
    })
  })

  /** Deliberately not backfilled from the chosen mode: an account that picked one before
   *  this version has never told the server, and claiming otherwise would suppress the
   *  push it is still owed. */
  it("migrates a v19 state to current leaving the server-confirmed mode unset", async () => {
    const state19 = {
      schemaVersion: 19,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      selfCustodialAccountModeByAccountId: {
        "self-custodial-id-1": AccountMode.Enhanced,
      },
    }

    const result = await migrateAndGetPersistentState(state19)

    expect(result.selfCustodialServerAccountModeByAccountId).toBeUndefined()
  })

  it("carries a whole v20 state to current, bumping only the schema version", async () => {
    const state20 = {
      schemaVersion: 20,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "token",
      activeAccountId: "self-custodial-id-1",
      selfCustodialAccountModeByAccountId: {
        "self-custodial-id-1": AccountMode.Anon,
      },
      selfCustodialServerAccountModeByAccountId: {
        "self-custodial-id-1": AccountMode.Enhanced,
      },
      stableBalanceAnonPausedByAccountId: { "self-custodial-id-1": true },
    }

    const result = await migrateAndGetPersistentState(state20)

    expect(result).toEqual({ ...state20, schemaVersion: 21 })
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
        sparkExplorer: "https://sparkscan.io/tx/",
        fiatUrl: "https://fiat.blink.sv",
      },
      galoyAuthToken: "token-v4",
      isAnalyticsEnabled: true,
    }

    const result = await migrateAndGetPersistentState(state4)

    expect(result.schemaVersion).toBe(21)
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
        sparkExplorer: "https://sparkscan.io/tx/",
        fiatUrl: "https://fiat.blink.sv",
      },
      galoyAuthToken: "token-v3",
      isAnalyticsEnabled: true,
    }

    const result = await migrateAndGetPersistentState(state3)

    expect(result.schemaVersion).toBe(21)
    expect(result.galoyAuthToken).toBe("token-v3")
    expect(result.galoyInstance).toEqual({ id: "Main" })
    expect(result.activeAccountId).toBeUndefined()
  })

  it("default state has the current schema version", () => {
    expect(defaultPersistentState.schemaVersion).toBe(21)
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

    expect(result.schemaVersion).toBe(21)
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

    expect(result.schemaVersion).toBe(21)
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

    expect(result.schemaVersion).toBe(21)
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

    expect(result.schemaVersion).toBe(21)
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

    expect(result.schemaVersion).toBe(21)
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

    expect(result.schemaVersion).toBe(21)
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

    it("returns status='failed', not 'no-data', for an unrecognized schemaVersion", async () => {
      // A blob we can't read is not a fresh install: a downgrade from a future
      // schema must not be treated as a reinstall (which wipes the keychain).
      const futureBlob = { schemaVersion: 999, galoyInstance: { id: "Main" } }
      const result = await migratePersistentState(futureBlob)

      expect(result.status).toBe(MigrationStatus.Failed)
      if (result.status === MigrationStatus.Failed) {
        expect(result.error.message).toContain("schemaVersion")
        // rawData must travel with the failure so the caller can quarantine it
        expect(result.rawData).toBe(futureBlob)
      }
    })

    it("returns status='no-data' only for a genuinely absent blob", async () => {
      expect(await migratePersistentState(null)).toEqual({
        status: MigrationStatus.NoData,
      })
      expect(await migratePersistentState(undefined)).toEqual({
        status: MigrationStatus.NoData,
      })
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
