import {
  getSelfCustodialDisplayCurrency,
  withSelfCustodialDisplayCurrency,
  withSelfCustodialDisplayCurrencyForAccount,
} from "@app/store/persistent-state/self-custodial-display-currency"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 21,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getSelfCustodialDisplayCurrency", () => {
  it("returns undefined when nothing has been stored", () => {
    expect(getSelfCustodialDisplayCurrency(baseState)).toBeUndefined()
  })

  it("returns the per-account map value when set for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      selfCustodialDisplayCurrencyByAccountId: {
        "self-custodial-1": "EUR",
        "self-custodial-2": "GBP",
      },
    }

    expect(getSelfCustodialDisplayCurrency(state)).toBe("EUR")
  })

  it("isolates currency per active account", () => {
    const map = { "self-custodial-1": "EUR", "self-custodial-2": "GBP" }

    expect(
      getSelfCustodialDisplayCurrency({
        ...baseState,
        activeAccountId: "self-custodial-1",
        selfCustodialDisplayCurrencyByAccountId: map,
      }),
    ).toBe("EUR")

    expect(
      getSelfCustodialDisplayCurrency({
        ...baseState,
        activeAccountId: "self-custodial-2",
        selfCustodialDisplayCurrencyByAccountId: map,
      }),
    ).toBe("GBP")
  })

  it("returns undefined when the map holds nothing for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-new",
      selfCustodialDisplayCurrencyByAccountId: { "self-custodial-other": "EUR" },
    }

    expect(getSelfCustodialDisplayCurrency(state)).toBeUndefined()
  })

  it("tells a deliberate USD apart from an unanswered preference", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      selfCustodialDisplayCurrencyByAccountId: { "self-custodial-1": "USD" },
    }

    expect(getSelfCustodialDisplayCurrency(state)).toBe("USD")
  })

  it("returns undefined when active is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
      selfCustodialDisplayCurrencyByAccountId: { "self-custodial-1": "EUR" },
    }

    expect(getSelfCustodialDisplayCurrency(state)).toBeUndefined()
  })

  it("returns undefined when there is no active account", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialDisplayCurrencyByAccountId: { "self-custodial-1": "EUR" },
    }

    expect(getSelfCustodialDisplayCurrency(state)).toBeUndefined()
  })
})

describe("withSelfCustodialDisplayCurrency", () => {
  it("writes the currency under the active self-custodial id", () => {
    const state: PersistentState = { ...baseState, activeAccountId: "self-custodial-1" }

    const next = withSelfCustodialDisplayCurrency(state, "EUR")

    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "self-custodial-1": "EUR",
    })
  })

  it("preserves entries for other accounts when writing", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-2",
      selfCustodialDisplayCurrencyByAccountId: { "self-custodial-1": "EUR" },
    }

    const next = withSelfCustodialDisplayCurrency(state, "GBP")

    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "self-custodial-1": "EUR",
      "self-custodial-2": "GBP",
    })
  })

  it("overwrites the existing value for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      selfCustodialDisplayCurrencyByAccountId: { "self-custodial-1": "EUR" },
    }

    const next = withSelfCustodialDisplayCurrency(state, "GBP")

    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "self-custodial-1": "GBP",
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

describe("withSelfCustodialDisplayCurrencyForAccount", () => {
  it("writes for an explicit id while the active account is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    const next = withSelfCustodialDisplayCurrencyForAccount(
      state,
      "self-custodial-new",
      "EUR",
    )

    expect(next.selfCustodialDisplayCurrencyByAccountId).toEqual({
      "self-custodial-new": "EUR",
    })
  })

  it("refuses the custodial sentinel as target id", () => {
    expect(
      withSelfCustodialDisplayCurrencyForAccount(
        baseState,
        DefaultAccountId.Custodial,
        "EUR",
      ),
    ).toBe(baseState)
  })
})
