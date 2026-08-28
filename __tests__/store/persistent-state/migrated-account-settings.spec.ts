import { seedMigratedAccountSettings } from "@app/store/persistent-state/migrated-account-settings"
import { getSelfCustodialDisplayCurrency } from "@app/store/persistent-state/self-custodial-display-currency"
import { getSelfCustodialLanguage } from "@app/store/persistent-state/self-custodial-language"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { getThemePreference } from "@app/store/persistent-state/theme-preference"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 21,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

const migratedId = "sc-migrated-1"

describe("seedMigratedAccountSettings", () => {
  it("seeds currency, language, and the custodial theme under the new account id", () => {
    const state: PersistentState = {
      ...baseState,
      themeByAccountId: { [DefaultAccountId.Custodial]: "dark" },
    }

    const next = seedMigratedAccountSettings(state, migratedId, {
      displayCurrency: "EUR",
      language: "es",
    })

    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      [migratedId]: "EUR",
    })
    expect(next.selfCustodialLanguageByAccountId).toEqual({ [migratedId]: "es" })
    expect(next.themeByAccountId).toEqual({
      [DefaultAccountId.Custodial]: "dark",
      [migratedId]: "dark",
    })
  })

  it("preserves other accounts' entries when seeding", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialDisplayCurrencyByAccountId: { "sc-other": "GBP" },
      selfCustodialLanguageByAccountId: { "sc-other": "fr" },
      themeByAccountId: { "sc-other": "light", [DefaultAccountId.Custodial]: "dark" },
    }

    const next = seedMigratedAccountSettings(state, migratedId, {
      displayCurrency: "EUR",
      language: "es",
    })

    expect(next.selfCustodialDisplayCurrencyByAccountId?.["sc-other"]).toBe("GBP")
    expect(next.selfCustodialLanguageByAccountId?.["sc-other"]).toBe("fr")
    expect(next.themeByAccountId?.["sc-other"]).toBe("light")
  })

  it("makes the migrated account read back the custodial settings once activated", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
      themeByAccountId: { [DefaultAccountId.Custodial]: "dark" },
    }

    const seeded = seedMigratedAccountSettings(state, migratedId, {
      displayCurrency: "EUR",
      language: "es",
    })
    const activated: PersistentState = { ...seeded, activeAccountId: migratedId }

    expect(getSelfCustodialDisplayCurrency(activated)).toBe("EUR")
    expect(getSelfCustodialLanguage(activated)).toBe("es")
    expect(getThemePreference(activated)).toBe("dark")
  })

  it("seeds nothing when the snapshot is unknown and no custodial theme is set", () => {
    const next = seedMigratedAccountSettings(baseState, migratedId, {
      displayCurrency: null,
      language: null,
    })

    expect(next).toBe(baseState)

    const activated: PersistentState = { ...next, activeAccountId: migratedId }
    expect(getSelfCustodialDisplayCurrency(activated)).toBeUndefined()
    expect(getSelfCustodialLanguage(activated)).toBe("DEFAULT")
    expect(getThemePreference(activated)).toBe("system")
  })

  it("seeds partially when only some values are known", () => {
    const next = seedMigratedAccountSettings(baseState, migratedId, {
      displayCurrency: "EUR",
      language: null,
    })

    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      [migratedId]: "EUR",
    })
    expect(next.selfCustodialLanguageByAccountId).toBeUndefined()
    expect(next.themeByAccountId).toBeUndefined()
  })

  it("seeds the DEFAULT language verbatim", () => {
    const next = seedMigratedAccountSettings(baseState, migratedId, {
      displayCurrency: null,
      language: "DEFAULT",
    })

    expect(next.selfCustodialLanguageByAccountId).toEqual({ [migratedId]: "DEFAULT" })
  })

  it("refuses to seed under the custodial sentinel id", () => {
    const state: PersistentState = {
      ...baseState,
      themeByAccountId: { [DefaultAccountId.Custodial]: "dark" },
    }

    const next = seedMigratedAccountSettings(state, DefaultAccountId.Custodial, {
      displayCurrency: "EUR",
      language: "es",
    })

    expect(next).toBe(state)
  })

  /** The retry of an abandoned run reuses the pending wallet and re-seeds it, so whatever
   *  the user changed in between has to replace the stale entries rather than sit behind
   *  them. All three maps in one test because the snapshot is seeded in a single call. */
  it("overwrites a previous seed for the same account", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialDisplayCurrencyByAccountId: { [migratedId]: "GBP" },
      selfCustodialLanguageByAccountId: { [migratedId]: "en" },
      themeByAccountId: { [migratedId]: "light", [DefaultAccountId.Custodial]: "dark" },
    }

    const next = seedMigratedAccountSettings(state, migratedId, {
      displayCurrency: "EUR",
      language: "es",
    })

    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      [migratedId]: "EUR",
    })
    expect(next.selfCustodialLanguageByAccountId).toEqual({ [migratedId]: "es" })
    expect(next.themeByAccountId).toEqual({
      [migratedId]: "dark",
      [DefaultAccountId.Custodial]: "dark",
    })
  })
})
