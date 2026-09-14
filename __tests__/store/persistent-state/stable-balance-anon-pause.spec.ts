import {
  isStableBalanceAnonPaused,
  withStableBalanceAnonPaused,
} from "@app/store/persistent-state/stable-balance-anon-pause"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const baseState: PersistentState = {
  schemaVersion: 21,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("withStableBalanceAnonPaused", () => {
  it("marks the given account as paused by Anon", () => {
    const next = withStableBalanceAnonPaused(baseState, "sc-1", true)

    expect(next.stableBalanceAnonPausedByAccountId).toEqual({ "sc-1": true })
  })

  it("clears the marker without dropping the entry", () => {
    const state: PersistentState = {
      ...baseState,
      stableBalanceAnonPausedByAccountId: { "sc-1": true },
    }

    const next = withStableBalanceAnonPaused(state, "sc-1", false)

    expect(isStableBalanceAnonPaused(next, "sc-1")).toBe(false)
  })

  it("preserves the markers of other accounts (multi-account)", () => {
    const state: PersistentState = {
      ...baseState,
      stableBalanceAnonPausedByAccountId: { "sc-1": true },
    }

    const next = withStableBalanceAnonPaused(state, "sc-2", true)

    expect(next.stableBalanceAnonPausedByAccountId).toEqual({
      "sc-1": true,
      "sc-2": true,
    })
  })
})

describe("isStableBalanceAnonPaused", () => {
  it("reads back what the writer stored", () => {
    const next = withStableBalanceAnonPaused(baseState, "sc-1", true)

    expect(isStableBalanceAnonPaused(next, "sc-1")).toBe(true)
  })

  /** An account that never entered Anon must not be treated as paused, or leaving Anon
   *  elsewhere would switch its Stable Balance on behind the user. */
  it("reports false for an account with no marker", () => {
    const state: PersistentState = {
      ...baseState,
      stableBalanceAnonPausedByAccountId: { "sc-1": true },
    }

    expect(isStableBalanceAnonPaused(state, "sc-2")).toBe(false)
  })

  it("reports false when no account has a marker at all", () => {
    expect(isStableBalanceAnonPaused(baseState, "sc-1")).toBe(false)
  })
})
