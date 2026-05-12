import {
  getSelfCustodialDefaultCurrency,
  withSelfCustodialDefaultCurrency,
} from "@app/store/persistent-state/self-custodial-default-currency"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 11,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getSelfCustodialDefaultCurrency", () => {
  it("returns BTC as the ultimate default", () => {
    const state: PersistentState = { ...baseState, activeAccountId: "sc-1" }

    expect(getSelfCustodialDefaultCurrency(state)).toBe("BTC")
  })

  it("returns the per-account map value when set for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-1",
      selfCustodialDefaultWalletCurrencyByAccountId: {
        "sc-1": "USD",
        "sc-2": "BTC",
      },
    }

    expect(getSelfCustodialDefaultCurrency(state)).toBe("USD")
  })

  it("isolates currency per active account", () => {
    const map = { "sc-1": "USD", "sc-2": "BTC" } as const

    expect(
      getSelfCustodialDefaultCurrency({
        ...baseState,
        activeAccountId: "sc-1",
        selfCustodialDefaultWalletCurrencyByAccountId: map,
      }),
    ).toBe("USD")

    expect(
      getSelfCustodialDefaultCurrency({
        ...baseState,
        activeAccountId: "sc-2",
        selfCustodialDefaultWalletCurrencyByAccountId: map,
      }),
    ).toBe("BTC")
  })

  it("returns BTC when map missing the active id, ignoring the legacy field (Critical #7)", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-new",
      selfCustodialDefaultWalletCurrency: "USD",
      selfCustodialDefaultWalletCurrencyByAccountId: { "sc-other": "BTC" },
    }

    expect(getSelfCustodialDefaultCurrency(state)).toBe("BTC")
  })

  it("returns BTC when map is absent entirely, ignoring the legacy field (Critical #7)", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-1",
      selfCustodialDefaultWalletCurrency: "USD",
    }

    expect(getSelfCustodialDefaultCurrency(state)).toBe("BTC")
  })

  it("returns BTC when active is custodial, ignoring the legacy field (Critical #7)", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
      selfCustodialDefaultWalletCurrency: "USD",
      selfCustodialDefaultWalletCurrencyByAccountId: { "sc-1": "BTC" },
    }

    expect(getSelfCustodialDefaultCurrency(state)).toBe("BTC")
  })

  it("returns BTC when active is custodial and nothing is set", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    expect(getSelfCustodialDefaultCurrency(state)).toBe("BTC")
  })

  it("returns BTC when there is no active account", () => {
    expect(getSelfCustodialDefaultCurrency(baseState)).toBe("BTC")
  })
})

describe("withSelfCustodialDefaultCurrency", () => {
  it("writes the currency under the active self-custodial id", () => {
    const state: PersistentState = { ...baseState, activeAccountId: "sc-1" }

    const next = withSelfCustodialDefaultCurrency(state, "USD")

    expect(next.selfCustodialDefaultWalletCurrencyByAccountId).toEqual({
      "sc-1": "USD",
    })
  })

  it("preserves entries for other accounts when writing", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-2",
      selfCustodialDefaultWalletCurrencyByAccountId: { "sc-1": "USD" },
    }

    const next = withSelfCustodialDefaultCurrency(state, "BTC")

    expect(next.selfCustodialDefaultWalletCurrencyByAccountId).toEqual({
      "sc-1": "USD",
      "sc-2": "BTC",
    })
  })

  it("overwrites the existing value for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-1",
      selfCustodialDefaultWalletCurrencyByAccountId: { "sc-1": "USD" },
    }

    const next = withSelfCustodialDefaultCurrency(state, "BTC")

    expect(next.selfCustodialDefaultWalletCurrencyByAccountId).toEqual({
      "sc-1": "BTC",
    })
  })

  it("does not touch the legacy field", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-1",
      selfCustodialDefaultWalletCurrency: "USD",
    }

    const next = withSelfCustodialDefaultCurrency(state, "BTC")

    expect(next.selfCustodialDefaultWalletCurrency).toBe("USD")
  })

  it("returns the same state when active is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    expect(withSelfCustodialDefaultCurrency(state, "USD")).toBe(state)
  })

  it("returns the same state when no active account is set", () => {
    expect(withSelfCustodialDefaultCurrency(baseState, "USD")).toBe(baseState)
  })
})
