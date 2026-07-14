import { act, renderHook } from "@testing-library/react-native"

import { useMigrateNowPrompt } from "@app/screens/account-migration/hooks/use-migrate-now-prompt"
import { windDownMock } from "@app/screens/account-migration/utils/backend-mock"
import { WindDown, WindDownStatus } from "@app/types/wind-down"
import { AccountType } from "@app/types/wallet"

let mockAccountType: AccountType = AccountType.Custodial

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ accountType: mockAccountType }),
}))

let mockActiveAccount: { id: string; type: string } | undefined

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

if (windDownMock === null) throw new Error("These tests exercise the affected mock")
const affectedWindDown: WindDown = windDownMock

let mockStatus: WindDownStatus | null = WindDownStatus.ReceiveDisabled

jest.mock("@app/screens/account-migration/hooks/use-wind-down-status", () => ({
  useWindDownStatus: () =>
    mockStatus === null ? null : { ...affectedWindDown, status: mockStatus },
}))

describe("useMigrateNowPrompt", () => {
  beforeEach(() => {
    mockAccountType = AccountType.Custodial
    mockActiveAccount = { id: "custodial-1", type: "custodial" }
    mockStatus = WindDownStatus.ReceiveDisabled
  })

  it("prompts a custodial account once the server disables receiving", () => {
    const { result } = renderHook(() => useMigrateNowPrompt())

    expect(result.current.isVisible).toBe(true)
    expect(result.current.isReceiveDisabled).toBe(true)
    expect(result.current.deadlineTimestamp).toBe(affectedWindDown.finalDeadline)
    expect(result.current.timezone).toBe(affectedWindDown.timezone)
  })

  it("stays quiet before the receive cutoff", () => {
    mockStatus = WindDownStatus.PreCutoff

    const { result } = renderHook(() => useMigrateNowPrompt())

    expect(result.current.isVisible).toBe(false)
    expect(result.current.isReceiveDisabled).toBe(false)
  })

  it("stays quiet once the gate closes, where the blocker takes over", () => {
    mockStatus = WindDownStatus.GatedClosed

    const { result } = renderHook(() => useMigrateNowPrompt())

    expect(result.current.isVisible).toBe(false)
  })

  it("stays quiet for an account the wind-down does not affect", () => {
    mockStatus = null

    const { result } = renderHook(() => useMigrateNowPrompt())

    expect(result.current.isVisible).toBe(false)
    expect(result.current.isReceiveDisabled).toBe(false)
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
    expect(result.current.isReceiveDisabled).toBe(true)
  })

  it("prompts again when reopened after a dismissal", () => {
    const { result } = renderHook(() => useMigrateNowPrompt())

    act(() => {
      result.current.dismissForSession()
    })
    act(() => {
      result.current.reopen()
    })

    expect(result.current.isVisible).toBe(true)
  })

  it("does not carry a dismissal across an account switch", () => {
    const { result, rerender } = renderHook(() => useMigrateNowPrompt())

    act(() => {
      result.current.dismissForSession()
    })
    expect(result.current.isVisible).toBe(false)

    mockActiveAccount = { id: "custodial-2", type: "custodial" }
    rerender({})

    expect(result.current.isVisible).toBe(true)
  })
})
