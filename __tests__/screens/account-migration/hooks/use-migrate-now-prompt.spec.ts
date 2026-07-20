import { act, renderHook } from "@testing-library/react-native"

import { useMigrateNowPrompt } from "@app/screens/account-migration/hooks/use-migrate-now-prompt"
import { WindDown, WindDownStatus } from "@app/types/wind-down"
import { AccountType } from "@app/types/wallet"

let mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useFeatureFlags: () => mockFeatureFlags,
}))

let mockActiveAccount: { id: string; type: string } | undefined
let mockOwnerId: string | null = "custodial-1"

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => ({ ownerId: mockOwnerId, loading: false }),
}))

/** A synthetic affected wind-down; each test swaps `status` on top of it. */
const affectedWindDown: WindDown = {
  status: WindDownStatus.ReceiveDisabled,
  receiveDisabledAt: 1_790_000_000,
  finalDeadline: 1_790_100_000,
  gateArmsAt: 1_790_200_000,
  timezone: "Europe/Paris",
}

let mockStatus: WindDownStatus | null = WindDownStatus.ReceiveDisabled

jest.mock("@app/screens/account-migration/hooks/use-wind-down-status", () => ({
  useWindDownStatus: () =>
    mockStatus === null ? null : { ...affectedWindDown, status: mockStatus },
}))

describe("useMigrateNowPrompt", () => {
  beforeEach(() => {
    mockActiveAccount = { id: "custodial-1", type: "custodial" }
    mockOwnerId = "custodial-1"
    mockStatus = WindDownStatus.ReceiveDisabled
    mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }
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
    mockActiveAccount = { id: "sc-1", type: AccountType.SelfCustodial }

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
    mockOwnerId = "custodial-2"
    rerender({})

    expect(result.current.isVisible).toBe(true)
  })

  it("pauses the prompt while the self-custodial kill-switch is off, keeping the receive state", () => {
    mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: true }

    const { result } = renderHook(() => useMigrateNowPrompt())

    expect(result.current.isVisible).toBe(false)
    expect(result.current.isReceiveDisabled).toBe(true)
  })
})
