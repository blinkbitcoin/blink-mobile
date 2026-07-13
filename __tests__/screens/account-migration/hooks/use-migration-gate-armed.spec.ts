import { renderHook } from "@testing-library/react-native"

import { useMigrationGateArmed } from "@app/screens/account-migration/hooks/use-migration-gate-armed"
import { WindDownStatus } from "@app/screens/account-migration/utils/backend-mock"
import { AccountType } from "@app/types/wallet"

let mockAccountType: AccountType = AccountType.Custodial

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ accountType: mockAccountType }),
}))

let mockStatus: WindDownStatus | null = WindDownStatus.PreCutoff

jest.mock("@app/screens/account-migration/hooks/use-wind-down-status", () => ({
  useWindDownStatus: () => (mockStatus === null ? null : { status: mockStatus }),
}))

describe("useMigrationGateArmed", () => {
  beforeEach(() => {
    mockAccountType = AccountType.Custodial
    mockStatus = WindDownStatus.PreCutoff
  })

  it("arms for a custodial account once the server reports the closure", () => {
    mockStatus = WindDownStatus.GatedClosed

    const { result } = renderHook(() => useMigrationGateArmed())

    expect(result.current).toBe(true)
  })

  it("stays unarmed before the closure", () => {
    const { result } = renderHook(() => useMigrationGateArmed())

    expect(result.current).toBe(false)
  })

  it("stays unarmed for an account the wind-down does not affect", () => {
    mockStatus = null

    const { result } = renderHook(() => useMigrationGateArmed())

    expect(result.current).toBe(false)
  })

  it("never arms for a self-custodial account", () => {
    mockAccountType = AccountType.SelfCustodial
    mockStatus = WindDownStatus.GatedClosed

    const { result } = renderHook(() => useMigrationGateArmed())

    expect(result.current).toBe(false)
  })
})
