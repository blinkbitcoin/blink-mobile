import {
  getSelfCustodialAccountMode,
  withSelfCustodialAccountMode,
} from "@app/store/persistent-state/self-custodial-account-mode"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 17,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("withSelfCustodialAccountMode", () => {
  it("writes the mode under the given account id", () => {
    const next = withSelfCustodialAccountMode(
      baseState,
      "self-custodial-1",
      AccountMode.Anon,
    )

    expect(next.selfCustodialAccountModeByAccountId).toEqual({
      "self-custodial-1": AccountMode.Anon,
    })
  })

  it("stores the mode for the onboarding account even when it is not the active one", () => {
    // A migration provisions the self-custodial account while custodial is still active.
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
    }

    const next = withSelfCustodialAccountMode(
      state,
      "provisioned-sc-1",
      AccountMode.Enhanced,
    )

    expect(next.selfCustodialAccountModeByAccountId).toEqual({
      "provisioned-sc-1": AccountMode.Enhanced,
    })
  })

  it("preserves entries for other accounts (multi-account)", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialAccountModeByAccountId: { "self-custodial-1": AccountMode.Enhanced },
    }

    const next = withSelfCustodialAccountMode(state, "self-custodial-2", AccountMode.Anon)

    expect(next.selfCustodialAccountModeByAccountId).toEqual({
      "self-custodial-1": AccountMode.Enhanced,
      "self-custodial-2": AccountMode.Anon,
    })
  })

  /** Absent is a real state a consumer must handle: an account onboarded through a path
   *  that never reached the mode screen keeps no entry, and writing another account's
   *  mode does not invent one for it. */
  it("leaves an account that never passed the mode screen absent from the map", () => {
    const next = withSelfCustodialAccountMode(
      baseState,
      "self-custodial-1",
      AccountMode.Anon,
    )

    expect(
      next.selfCustodialAccountModeByAccountId?.["restored-without-mode"],
    ).toBeUndefined()
  })

  it("overwrites the existing mode for the given id", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialAccountModeByAccountId: { "self-custodial-1": AccountMode.Enhanced },
    }

    const next = withSelfCustodialAccountMode(state, "self-custodial-1", AccountMode.Anon)

    expect(next.selfCustodialAccountModeByAccountId).toEqual({
      "self-custodial-1": AccountMode.Anon,
    })
  })
})

describe("getSelfCustodialAccountMode", () => {
  it("reads back the mode the writer stored", () => {
    const next = withSelfCustodialAccountMode(
      baseState,
      "self-custodial-1",
      AccountMode.Anon,
    )

    expect(getSelfCustodialAccountMode(next, "self-custodial-1")).toBe(AccountMode.Anon)
  })

  it("returns undefined when the map has no entry for the account", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialAccountModeByAccountId: { "self-custodial-1": AccountMode.Enhanced },
    }

    expect(getSelfCustodialAccountMode(state, "restored-without-mode")).toBeUndefined()
  })

  /** The map is optional on the schema, so a state written before v17 has none at all. */
  it("returns undefined when the map is absent entirely", () => {
    expect(getSelfCustodialAccountMode(baseState, "self-custodial-1")).toBeUndefined()
  })

  it("keeps each account's mode separate (multi-account)", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialAccountModeByAccountId: {
        "self-custodial-1": AccountMode.Enhanced,
        "self-custodial-2": AccountMode.Anon,
      },
    }

    expect(getSelfCustodialAccountMode(state, "self-custodial-1")).toBe(
      AccountMode.Enhanced,
    )
    expect(getSelfCustodialAccountMode(state, "self-custodial-2")).toBe(AccountMode.Anon)
  })
})
