import {
  getStablesatsRestricted,
  withStablesatsRestricted,
} from "@app/store/persistent-state/stablesats-restriction"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getStablesatsRestricted", () => {
  it("returns false as the ultimate default", () => {
    expect(getStablesatsRestricted(baseState)).toBe(false)
  })

  it("returns the per-account value for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      stablesatsRestrictedByAccountId: { "self-custodial-1": true },
    }

    expect(getStablesatsRestricted(state)).toBe(true)
  })

  it("falls back to the custodial slot when activeAccountId is undefined", () => {
    const state: PersistentState = {
      ...baseState,
      stablesatsRestrictedByAccountId: { [DefaultAccountId.Custodial]: true },
    }

    expect(getStablesatsRestricted(state)).toBe(true)
  })

  it("isolates the flag per active account", () => {
    const map = { "acct-1": true, "acct-2": false }

    expect(
      getStablesatsRestricted({
        ...baseState,
        activeAccountId: "acct-1",
        stablesatsRestrictedByAccountId: map,
      }),
    ).toBe(true)

    expect(
      getStablesatsRestricted({
        ...baseState,
        activeAccountId: "acct-2",
        stablesatsRestrictedByAccountId: map,
      }),
    ).toBe(false)
  })
})

describe("withStablesatsRestricted", () => {
  it("creates the per-account map and sets the flag for the custodial slot", () => {
    const next = withStablesatsRestricted(baseState)

    expect(next.stablesatsRestrictedByAccountId).toEqual({
      [DefaultAccountId.Custodial]: true,
    })
  })

  it("preserves entries for other accounts and sets only the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "acct-2",
      stablesatsRestrictedByAccountId: { "acct-1": true },
    }

    const next = withStablesatsRestricted(state)

    expect(next.stablesatsRestrictedByAccountId).toEqual({
      "acct-1": true,
      "acct-2": true,
    })
  })

  it("keeps the flag set when already restricted", () => {
    const state: PersistentState = {
      ...baseState,
      stablesatsRestrictedByAccountId: { [DefaultAccountId.Custodial]: true },
    }

    const next = withStablesatsRestricted(state)

    expect(next.stablesatsRestrictedByAccountId).toEqual({
      [DefaultAccountId.Custodial]: true,
    })
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = {
      ...baseState,
      activeAccountId: "acct-1",
    }
    const snapshot = JSON.parse(JSON.stringify(original))

    withStablesatsRestricted(original)

    expect(original).toEqual(snapshot)
  })
})
