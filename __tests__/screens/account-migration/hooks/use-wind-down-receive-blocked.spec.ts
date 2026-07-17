import { renderHook } from "@testing-library/react-native"

import { useWindDownReceiveBlocked } from "@app/screens/account-migration/hooks/use-wind-down-receive-blocked"
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

describe("useWindDownReceiveBlocked", () => {
  beforeEach(() => {
    mockAccountType = AccountType.Custodial
    mockStatus = WindDownStatus.PreCutoff
  })

  it("blocks a custodial account once the server disables receiving", () => {
    mockStatus = WindDownStatus.ReceiveDisabled

    const { result } = renderHook(() => useWindDownReceiveBlocked())

    expect(result.current).toBe(true)
  })

  it("keeps blocking through the terminal gate", () => {
    mockStatus = WindDownStatus.GatedClosed

    const { result } = renderHook(() => useWindDownReceiveBlocked())

    expect(result.current).toBe(true)
  })

  it("stays open before the receive cutoff", () => {
    const { result } = renderHook(() => useWindDownReceiveBlocked())

    expect(result.current).toBe(false)
  })

  it("stays open for an account the wind-down does not affect", () => {
    mockStatus = null

    const { result } = renderHook(() => useWindDownReceiveBlocked())

    expect(result.current).toBe(false)
  })

  it("never blocks a self-custodial account", () => {
    mockAccountType = AccountType.SelfCustodial
    mockStatus = WindDownStatus.ReceiveDisabled

    const { result } = renderHook(() => useWindDownReceiveBlocked())

    expect(result.current).toBe(false)
  })
})
