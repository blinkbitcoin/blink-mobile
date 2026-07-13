import { act, renderHook } from "@testing-library/react-native"

import { useMigrateNowPrompt } from "@app/screens/account-migration/hooks/use-migrate-now-prompt"
import {
  windDownMock,
  WindDownStatus,
} from "@app/screens/account-migration/utils/backend-mock"
import { AccountType } from "@app/types/wallet"

let mockAccountType: AccountType = AccountType.Custodial

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ accountType: mockAccountType }),
}))

let mockStatus: WindDownStatus = WindDownStatus.ReceiveDisabled

jest.mock("@app/screens/account-migration/hooks/use-wind-down-status", () => ({
  useWindDownStatus: () => ({ ...windDownMock, status: mockStatus }),
}))

describe("useMigrateNowPrompt", () => {
  beforeEach(() => {
    mockAccountType = AccountType.Custodial
    mockStatus = WindDownStatus.ReceiveDisabled
  })

  it("prompts a custodial account once the server disables receiving", () => {
    const { result } = renderHook(() => useMigrateNowPrompt())

    expect(result.current.isVisible).toBe(true)
    expect(result.current.deadlineTimestamp).toBe(windDownMock.finalDeadline)
    expect(result.current.timezone).toBe(windDownMock.timezone)
  })

  it("stays quiet before the receive cutoff", () => {
    mockStatus = WindDownStatus.PreCutoff

    const { result } = renderHook(() => useMigrateNowPrompt())

    expect(result.current.isVisible).toBe(false)
  })

  it("stays quiet once the gate closes, where the blocker takes over", () => {
    mockStatus = WindDownStatus.GatedClosed

    const { result } = renderHook(() => useMigrateNowPrompt())

    expect(result.current.isVisible).toBe(false)
  })

  it("never prompts a self-custodial account", () => {
    mockAccountType = AccountType.SelfCustodial

    const { result } = renderHook(() => useMigrateNowPrompt())

    expect(result.current.isVisible).toBe(false)
  })

  it("hides for the session once dismissed", () => {
    const { result } = renderHook(() => useMigrateNowPrompt())

    act(() => {
      result.current.dismissForSession()
    })

    expect(result.current.isVisible).toBe(false)
  })
})
