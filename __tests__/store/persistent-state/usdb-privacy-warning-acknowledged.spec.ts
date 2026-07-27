import {
  getUsdbPrivacyWarningAcknowledged,
  withUsdbPrivacyWarningAcknowledged,
} from "@app/store/persistent-state/usdb-privacy-warning-acknowledged"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getUsdbPrivacyWarningAcknowledged", () => {
  it("returns false as the ultimate default, so existing users are warned once", () => {
    expect(getUsdbPrivacyWarningAcknowledged(baseState)).toBe(false)
  })

  it("returns the per-account map value when set for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      usdbPrivacyWarningAcknowledgedByAccountId: {
        "self-custodial-1": true,
        "self-custodial-2": false,
      },
    }

    expect(getUsdbPrivacyWarningAcknowledged(state)).toBe(true)
  })

  it("falls back to the custodial slot when activeAccountId is undefined", () => {
    const state: PersistentState = {
      ...baseState,
      usdbPrivacyWarningAcknowledgedByAccountId: {
        [DefaultAccountId.Custodial]: true,
      },
    }

    expect(getUsdbPrivacyWarningAcknowledged(state)).toBe(true)
  })

  it("isolates the acknowledgement per active account", () => {
    const map = {
      "self-custodial-1": true,
      "self-custodial-2": false,
    }

    expect(
      getUsdbPrivacyWarningAcknowledged({
        ...baseState,
        activeAccountId: "self-custodial-1",
        usdbPrivacyWarningAcknowledgedByAccountId: map,
      }),
    ).toBe(true)

    expect(
      getUsdbPrivacyWarningAcknowledged({
        ...baseState,
        activeAccountId: "self-custodial-2",
        usdbPrivacyWarningAcknowledgedByAccountId: map,
      }),
    ).toBe(false)
  })

  it("returns false when the map exists but has no entry for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-3",
      usdbPrivacyWarningAcknowledgedByAccountId: {
        "self-custodial-1": true,
      },
    }

    expect(getUsdbPrivacyWarningAcknowledged(state)).toBe(false)
  })
})

describe("withUsdbPrivacyWarningAcknowledged", () => {
  it("creates the per-account map when absent and sets the flag for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
    }

    const next = withUsdbPrivacyWarningAcknowledged(state)

    expect(next.usdbPrivacyWarningAcknowledgedByAccountId).toEqual({
      "self-custodial-1": true,
    })
  })

  it("preserves entries for other accounts and updates only the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-2",
      usdbPrivacyWarningAcknowledgedByAccountId: {
        "self-custodial-1": true,
        "self-custodial-2": false,
      },
    }

    const next = withUsdbPrivacyWarningAcknowledged(state)

    expect(next.usdbPrivacyWarningAcknowledgedByAccountId).toEqual({
      "self-custodial-1": true,
      "self-custodial-2": true,
    })
  })

  it("uses the custodial slot when activeAccountId is undefined", () => {
    const next = withUsdbPrivacyWarningAcknowledged(baseState)

    expect(next.usdbPrivacyWarningAcknowledgedByAccountId).toEqual({
      [DefaultAccountId.Custodial]: true,
    })
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      usdbPrivacyWarningAcknowledgedByAccountId: {
        "self-custodial-1": false,
      },
    }
    const snapshot = JSON.parse(JSON.stringify(original))

    withUsdbPrivacyWarningAcknowledged(original)

    expect(original).toEqual(snapshot)
  })
})
