import { renderHook } from "@testing-library/react-native"

import { useCustodialWindDown } from "@app/screens/account-migration/hooks/use-custodial-wind-down"
import { WindDown, WindDownStatus } from "@app/types/wind-down"
import { AccountType } from "@app/types/wallet"

let mockActiveAccount: { type: AccountType } | undefined
let mockWindDown: WindDown | null = null

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

jest.mock("@app/screens/account-migration/hooks/use-wind-down-status", () => ({
  useWindDownStatus: () => mockWindDown,
}))

const affectedWindDown: WindDown = {
  status: WindDownStatus.ReceiveDisabled,
  receiveDisabledAt: 1_000,
  finalDeadline: 2_000,
  gateArmsAt: 3_000,
  timezone: "Europe/Paris",
}

describe("useCustodialWindDown", () => {
  beforeEach(() => {
    mockActiveAccount = { type: AccountType.Custodial }
    mockWindDown = affectedWindDown
  })

  it("passes the wind-down through for a custodial account", () => {
    const { result } = renderHook(() => useCustodialWindDown())

    expect(result.current).toBe(affectedWindDown)
  })

  it("returns null for a self-custodial account even when the server reports a wind-down", () => {
    mockActiveAccount = { type: AccountType.SelfCustodial }

    const { result } = renderHook(() => useCustodialWindDown())

    expect(result.current).toBeNull()
  })

  it("returns null when no account is active, so the placeholder never arms the gate", () => {
    mockActiveAccount = undefined

    const { result } = renderHook(() => useCustodialWindDown())

    expect(result.current).toBeNull()
  })

  it("returns null when the server omits the wind-down (unaffected account)", () => {
    mockWindDown = null

    const { result } = renderHook(() => useCustodialWindDown())

    expect(result.current).toBeNull()
  })
})
