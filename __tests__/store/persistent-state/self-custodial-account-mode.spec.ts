import {
  getSelfCustodialAccountMode,
  withSelfCustodialAccountMode,
} from "@app/store/persistent-state/self-custodial-account-mode"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 20,
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
  it("returns the active self-custodial account's mode", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      selfCustodialAccountModeByAccountId: {
        "self-custodial-1": AccountMode.Anon,
        "self-custodial-2": AccountMode.Enhanced,
      },
    }

    expect(getSelfCustodialAccountMode(state)).toBe(AccountMode.Anon)
  })

  it("returns null when the active account has not chosen a mode", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
    }

    expect(getSelfCustodialAccountMode(state)).toBeNull()
  })

  it("returns null when the active account is custodial", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: DefaultAccountId.Custodial,
      selfCustodialAccountModeByAccountId: { "self-custodial-1": AccountMode.Anon },
    }

    expect(getSelfCustodialAccountMode(state)).toBeNull()
  })

  it("returns null when no account is active", () => {
    expect(getSelfCustodialAccountMode(baseState)).toBeNull()
  })
})
