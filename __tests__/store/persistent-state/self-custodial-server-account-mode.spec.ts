import { getSelfCustodialAccountMode } from "@app/store/persistent-state/self-custodial-account-mode"
import {
  getSelfCustodialServerAccountMode,
  withSelfCustodialModeFromServer,
  withSelfCustodialServerAccountMode,
} from "@app/store/persistent-state/self-custodial-server-account-mode"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"

const baseState: PersistentState = {
  schemaVersion: 21,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("withSelfCustodialServerAccountMode", () => {
  it("records the mode the server confirmed for the given account", () => {
    const next = withSelfCustodialServerAccountMode(
      baseState,
      "sc-1",
      AccountMode.Enhanced,
    )

    expect(next.selfCustodialServerAccountModeByAccountId).toEqual({
      "sc-1": AccountMode.Enhanced,
    })
  })

  it("overwrites a previously confirmed mode when the account switches", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialServerAccountModeByAccountId: { "sc-1": AccountMode.Enhanced },
    }

    const next = withSelfCustodialServerAccountMode(state, "sc-1", AccountMode.Anon)

    expect(getSelfCustodialServerAccountMode(next, "sc-1")).toBe(AccountMode.Anon)
  })

  /** Each account holds its own posture, so one confirming a mode must not speak for
   *  another the server has never heard from. */
  it("preserves the confirmations of other accounts", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialServerAccountModeByAccountId: { "sc-1": AccountMode.Anon },
    }

    const next = withSelfCustodialServerAccountMode(state, "sc-2", AccountMode.Enhanced)

    expect(next.selfCustodialServerAccountModeByAccountId).toEqual({
      "sc-1": AccountMode.Anon,
      "sc-2": AccountMode.Enhanced,
    })
  })
})

describe("getSelfCustodialServerAccountMode", () => {
  it("reads back what the writer stored", () => {
    const next = withSelfCustodialServerAccountMode(baseState, "sc-1", AccountMode.Anon)

    expect(getSelfCustodialServerAccountMode(next, "sc-1")).toBe(AccountMode.Anon)
  })

  /** Null is what makes the first push happen: an account the server has never been told
   *  about must not read as already agreeing with whatever mode is chosen. */
  it("reports null for an account with no confirmation", () => {
    const state: PersistentState = {
      ...baseState,
      selfCustodialServerAccountModeByAccountId: { "sc-1": AccountMode.Enhanced },
    }

    expect(getSelfCustodialServerAccountMode(state, "sc-2")).toBeNull()
  })

  it("reports null when no account has been confirmed at all", () => {
    expect(getSelfCustodialServerAccountMode(baseState, "sc-1")).toBeNull()
  })
})

describe("withSelfCustodialModeFromServer", () => {
  const activeState: PersistentState = { ...baseState, activeAccountId: "sc-1" }

  it("adopts the mode the server reported", () => {
    const next = withSelfCustodialModeFromServer(activeState, "sc-1", AccountMode.Anon)

    expect(getSelfCustodialAccountMode(next)).toBe(AccountMode.Anon)
  })

  /** Already on the server, so pushing it back would spend a paid country lookup to say
   *  what it just told us. */
  it("records a reported mode as confirmed", () => {
    const next = withSelfCustodialModeFromServer(activeState, "sc-1", AccountMode.Anon)

    expect(getSelfCustodialServerAccountMode(next, "sc-1")).toBe(AccountMode.Anon)
  })

  it("settles on Enhanced when the server reported no mode", () => {
    const next = withSelfCustodialModeFromServer(activeState, "sc-1", null)

    expect(getSelfCustodialAccountMode(next)).toBe(AccountMode.Enhanced)
  })

  /** The server never said Enhanced, so it is still owed that push. */
  it("leaves an assumed Enhanced unconfirmed", () => {
    const next = withSelfCustodialModeFromServer(activeState, "sc-1", null)

    expect(getSelfCustodialServerAccountMode(next, "sc-1")).toBeNull()
  })

  it("settles the account it was given, not whichever is active", () => {
    const next = withSelfCustodialModeFromServer(activeState, "sc-2", AccountMode.Anon)

    expect(next.selfCustodialAccountModeByAccountId).toEqual({ "sc-2": AccountMode.Anon })
    expect(getSelfCustodialAccountMode(next)).toBeNull()
  })
})
