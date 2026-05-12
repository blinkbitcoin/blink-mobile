import {
  getSelfCustodialDisplayCurrency,
  withSelfCustodialDisplayCurrency,
} from "@app/store/persistent-state/self-custodial-display-currency"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 11,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getSelfCustodialDisplayCurrency", () => {
  it("returns USD as the ultimate default", () => {
    expect(getSelfCustodialDisplayCurrency(baseState)).toBe("USD")
  })

  it("returns the per-account map value when set for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-1",
      selfCustodialDisplayCurrencyByAccountId: {
        "sc-1": "EUR",
        "sc-2": "GBP",
      },
    }

    expect(getSelfCustodialDisplayCurrency(state)).toBe("EUR")
  })

  it("isolates currency per active account", () => {
    const map = { "sc-1": "EUR", "sc-2": "GBP" }

    expect(
      getSelfCustodialDisplayCurrency({
        ...baseState,
        activeAccountId: "sc-1",
        selfCustodialDisplayCurrencyByAccountId: map,
      }),
    ).toBe("EUR")

    expect(
      getSelfCustodialDisplayCurrency({
        ...baseState,
        activeAccountId: "sc-2",
        selfCustodialDisplayCurrencyByAccountId: map,
      }),
    ).toBe("GBP")
  })

  it("falls back to USD when map is absent for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-new",
      selfCustodialDisplayCurrencyByAccountId: { "sc-other": "EUR" },
    }

    expect(getSelfCustodialDisplayCurrency(state)).toBe("USD")
  })

  it("returns USD when active is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
      selfCustodialDisplayCurrencyByAccountId: { "sc-1": "EUR" },
    }

    expect(getSelfCustodialDisplayCurrency(state)).toBe("USD")
  })

  it("returns USD when there is no active account", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialDisplayCurrencyByAccountId: { "sc-1": "EUR" },
    }

    expect(getSelfCustodialDisplayCurrency(state)).toBe("USD")
  })
})

describe("withSelfCustodialDisplayCurrency", () => {
  it("writes the currency under the active self-custodial id", () => {
    const state: PersistentState = { ...baseState, activeAccountId: "sc-1" }

    const next = withSelfCustodialDisplayCurrency(state, "EUR")

    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "sc-1": "EUR",
    })
  })

  it("preserves entries for other accounts when writing", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-2",
      selfCustodialDisplayCurrencyByAccountId: { "sc-1": "EUR" },
    }

    const next = withSelfCustodialDisplayCurrency(state, "GBP")

    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "sc-1": "EUR",
      "sc-2": "GBP",
    })
  })

  it("overwrites the existing value for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-1",
      selfCustodialDisplayCurrencyByAccountId: { "sc-1": "EUR" },
    }

    const next = withSelfCustodialDisplayCurrency(state, "GBP")

    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "sc-1": "GBP",
    })
  })

  it("returns the same state when active is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    expect(withSelfCustodialDisplayCurrency(state, "EUR")).toBe(state)
  })

  it("returns the same state when no active account is set", () => {
    expect(withSelfCustodialDisplayCurrency(baseState, "EUR")).toBe(baseState)
  })
})
