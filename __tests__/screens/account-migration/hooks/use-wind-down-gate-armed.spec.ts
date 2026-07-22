import { renderHook } from "@testing-library/react-native"

import { useWindDownGateArmed } from "@app/screens/account-migration/hooks/use-wind-down-gate-armed"
import { WindDownStatus } from "@app/types/wind-down"
import { AccountType } from "@app/types/wallet"

let mockAccountType: AccountType = AccountType.Custodial

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: { type: mockAccountType } }),
}))

let mockStatus: WindDownStatus | null = WindDownStatus.PreCutoff

jest.mock("@app/screens/account-migration/hooks/use-wind-down-status", () => ({
  useWindDownStatus: () => (mockStatus === null ? null : { status: mockStatus }),
}))

describe("useWindDownGateArmed", () => {
  beforeEach(() => {
    mockAccountType = AccountType.Custodial
    mockStatus = WindDownStatus.PreCutoff
  })

  it("arms for a custodial account once the server reports the closure", () => {
    mockStatus = WindDownStatus.GatedClosed

    const { result } = renderHook(() => useWindDownGateArmed())

    expect(result.current).toBe(true)
  })

  it("stays unarmed before the closure", () => {
    const { result } = renderHook(() => useWindDownGateArmed())

    expect(result.current).toBe(false)
  })

  it("stays unarmed for an account the wind-down does not affect", () => {
    mockStatus = null

    const { result } = renderHook(() => useWindDownGateArmed())

    expect(result.current).toBe(false)
  })

  it("never arms for a self-custodial account", () => {
    mockAccountType = AccountType.SelfCustodial
    mockStatus = WindDownStatus.GatedClosed

    const { result } = renderHook(() => useWindDownGateArmed())

    expect(result.current).toBe(false)
  })
})
