import { renderHook } from "@testing-library/react-native"

import { useWindDownReceiveBlocked } from "@app/screens/account-migration/hooks/use-wind-down-receive-blocked"
import { WindDownStatus } from "@app/screens/account-migration/utils/backend-mock"
import { AccountType } from "@app/types/wallet"

let mockAccountType: AccountType = AccountType.Custodial

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ accountType: mockAccountType }),
}))

let mockStatus: WindDownStatus = WindDownStatus.PreCutoff

jest.mock("@app/screens/account-migration/hooks/use-wind-down-status", () => ({
  useWindDownStatus: () => ({ status: mockStatus }),
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

  it("never blocks a self-custodial account", () => {
    mockAccountType = AccountType.SelfCustodial
    mockStatus = WindDownStatus.ReceiveDisabled

    const { result } = renderHook(() => useWindDownReceiveBlocked())

    expect(result.current).toBe(false)
  })
})
