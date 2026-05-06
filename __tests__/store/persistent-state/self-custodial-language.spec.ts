import {
  getSelfCustodialLanguage,
  withSelfCustodialLanguage,
} from "@app/store/persistent-state/self-custodial-language"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet.types"

const baseState: PersistentState = {
  schemaVersion: 11,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getSelfCustodialLanguage", () => {
  it("returns DEFAULT as the ultimate default", () => {
    expect(getSelfCustodialLanguage(baseState)).toBe("DEFAULT")
  })

  it("returns the per-account map value when set for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-1",
      selfCustodialLanguageByAccountId: {
        "sc-1": "es",
        "sc-2": "fr",
      },
    }

    expect(getSelfCustodialLanguage(state)).toBe("es")
  })

  it("isolates language per active account", () => {
    const map = { "sc-1": "es", "sc-2": "fr" }

    expect(
      getSelfCustodialLanguage({
        ...baseState,
        activeAccountId: "sc-1",
        selfCustodialLanguageByAccountId: map,
      }),
    ).toBe("es")

    expect(
      getSelfCustodialLanguage({
        ...baseState,
        activeAccountId: "sc-2",
        selfCustodialLanguageByAccountId: map,
      }),
    ).toBe("fr")
  })

  it("falls back to DEFAULT when map is absent for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-new",
      selfCustodialLanguageByAccountId: { "sc-other": "es" },
    }

    expect(getSelfCustodialLanguage(state)).toBe("DEFAULT")
  })

  it("returns DEFAULT when active is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
      selfCustodialLanguageByAccountId: { "sc-1": "es" },
    }

    expect(getSelfCustodialLanguage(state)).toBe("DEFAULT")
  })

  it("returns DEFAULT when there is no active account", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialLanguageByAccountId: { "sc-1": "es" },
    }

    expect(getSelfCustodialLanguage(state)).toBe("DEFAULT")
  })
})

describe("withSelfCustodialLanguage", () => {
  it("writes the language under the active self-custodial id", () => {
    const state: PersistentState = { ...baseState, activeAccountId: "sc-1" }

    const next = withSelfCustodialLanguage(state, "es")

    expect(next.selfCustodialLanguageByAccountId).toEqual({
      "sc-1": "es",
    })
  })

  it("preserves entries for other accounts when writing", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-2",
      selfCustodialLanguageByAccountId: { "sc-1": "es" },
    }

    const next = withSelfCustodialLanguage(state, "fr")

    expect(next.selfCustodialLanguageByAccountId).toEqual({
      "sc-1": "es",
      "sc-2": "fr",
    })
  })

  it("overwrites the existing value for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "sc-1",
      selfCustodialLanguageByAccountId: { "sc-1": "es" },
    }

    const next = withSelfCustodialLanguage(state, "fr")

    expect(next.selfCustodialLanguageByAccountId).toEqual({
      "sc-1": "fr",
    })
  })

  it("returns the same state when active is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    expect(withSelfCustodialLanguage(state, "es")).toBe(state)
  })

  it("returns the same state when no active account is set", () => {
    expect(withSelfCustodialLanguage(baseState, "es")).toBe(baseState)
  })
})
