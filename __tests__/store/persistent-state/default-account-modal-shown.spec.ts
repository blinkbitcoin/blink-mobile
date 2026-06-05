import {
  getDefaultAccountModalShown,
  withDefaultAccountModalShown,
} from "@app/store/persistent-state/default-account-modal-shown"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 13,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getDefaultAccountModalShown", () => {
  it("returns false as the ultimate default", () => {
    expect(getDefaultAccountModalShown(baseState)).toBe(false)
  })

  it("returns the per-account map value when set for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      defaultAccountModalShownByAccountId: {
        "self-custodial-1": true,
        "self-custodial-2": false,
      },
    }

    expect(getDefaultAccountModalShown(state)).toBe(true)
  })

  it("falls back to the custodial slot when activeAccountId is undefined", () => {
    const state: PersistentState = {
      ...baseState,
      defaultAccountModalShownByAccountId: {
        [DefaultAccountId.Custodial]: true,
      },
    }

    expect(getDefaultAccountModalShown(state)).toBe(true)
  })

  it("isolates the flag per active account", () => {
    const map = {
      "self-custodial-1": true,
      "self-custodial-2": false,
    }

    expect(
      getDefaultAccountModalShown({
        ...baseState,
        activeAccountId: "self-custodial-1",
        defaultAccountModalShownByAccountId: map,
      }),
    ).toBe(true)

    expect(
      getDefaultAccountModalShown({
        ...baseState,
        activeAccountId: "self-custodial-2",
        defaultAccountModalShownByAccountId: map,
      }),
    ).toBe(false)
  })

  it("returns false when the map exists but has no entry for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-3",
      defaultAccountModalShownByAccountId: {
        "self-custodial-1": true,
      },
    }

    expect(getDefaultAccountModalShown(state)).toBe(false)
  })
})

describe("withDefaultAccountModalShown", () => {
  it("creates the per-account map when absent and sets the flag for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
    }

    const next = withDefaultAccountModalShown(state)

    expect(next.defaultAccountModalShownByAccountId).toEqual({
      "self-custodial-1": true,
    })
  })

  it("preserves entries for other accounts and updates only the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-2",
      defaultAccountModalShownByAccountId: {
        "self-custodial-1": true,
        "self-custodial-2": false,
      },
    }

    const next = withDefaultAccountModalShown(state)

    expect(next.defaultAccountModalShownByAccountId).toEqual({
      "self-custodial-1": true,
      "self-custodial-2": true,
    })
  })

  it("uses the custodial slot when activeAccountId is undefined", () => {
    const next = withDefaultAccountModalShown(baseState)

    expect(next.defaultAccountModalShownByAccountId).toEqual({
      [DefaultAccountId.Custodial]: true,
    })
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      defaultAccountModalShownByAccountId: {
        "self-custodial-1": false,
      },
    }
    const snapshot = JSON.parse(JSON.stringify(original))

    withDefaultAccountModalShown(original)

    expect(original).toEqual(snapshot)
  })
})
