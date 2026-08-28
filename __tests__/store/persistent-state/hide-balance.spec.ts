import {
  getAlwaysHideBalance,
  getBalanceHidden,
  withAlwaysHideBalance,
  withBalanceHidden,
} from "@app/store/persistent-state/hide-balance"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 21,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getAlwaysHideBalance", () => {
  it("defaults to false when unset", () => {
    expect(getAlwaysHideBalance(baseState)).toBe(false)
  })

  it("returns the stored value", () => {
    expect(getAlwaysHideBalance({ ...baseState, alwaysHideBalance: true })).toBe(true)
    expect(getAlwaysHideBalance({ ...baseState, alwaysHideBalance: false })).toBe(false)
  })
})

describe("getBalanceHidden", () => {
  it("defaults to false when unset", () => {
    expect(getBalanceHidden(baseState)).toBe(false)
  })

  it("returns the stored value", () => {
    expect(getBalanceHidden({ ...baseState, balanceHidden: true })).toBe(true)
    expect(getBalanceHidden({ ...baseState, balanceHidden: false })).toBe(false)
  })
})

describe("withAlwaysHideBalance", () => {
  it("writes the value without mutating the input", () => {
    const next = withAlwaysHideBalance(baseState, true)

    expect(next.alwaysHideBalance).toBe(true)
    expect(baseState.alwaysHideBalance).toBeUndefined()
  })

  it("overwrites an existing value", () => {
    const next = withAlwaysHideBalance({ ...baseState, alwaysHideBalance: true }, false)

    expect(next.alwaysHideBalance).toBe(false)
  })

  it("leaves the remembered visibility untouched", () => {
    const next = withAlwaysHideBalance({ ...baseState, balanceHidden: true }, true)

    expect(next.balanceHidden).toBe(true)
  })
})

describe("withBalanceHidden", () => {
  it("writes the value without mutating the input", () => {
    const next = withBalanceHidden(baseState, true)

    expect(next.balanceHidden).toBe(true)
    expect(baseState.balanceHidden).toBeUndefined()
  })

  it("overwrites an existing value", () => {
    const next = withBalanceHidden({ ...baseState, balanceHidden: true }, false)

    expect(next.balanceHidden).toBe(false)
  })
})

describe("device-wide scope", () => {
  it("keeps one value regardless of which account is active", () => {
    const hidden = withBalanceHidden(
      { ...baseState, activeAccountId: DefaultAccountId.Custodial },
      true,
    )

    // Switching to a self-custodial account must not reveal the balance again:
    // this is a choice about who can see the screen, not about the account.
    expect(getBalanceHidden({ ...hidden, activeAccountId: "self-custodial-1" })).toBe(
      true,
    )
  })
})
