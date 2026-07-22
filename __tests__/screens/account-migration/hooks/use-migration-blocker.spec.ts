import { renderHook } from "@testing-library/react-native"

import { useMigrationBlocker } from "@app/screens/account-migration/hooks/use-migration-blocker"

let mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useFeatureFlags: () => mockFeatureFlags,
}))

let mockGateArmed = false

jest.mock("@app/screens/account-migration/hooks/use-wind-down-gate-armed", () => ({
  useWindDownGateArmed: () => mockGateArmed,
}))

describe("useMigrationBlocker", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGateArmed = false
    mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }
  })

  it("stays hidden before the gate arms, since the pre-deadline nudge is the home bulletin", () => {
    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(false)
  })

  it("blocks the app once the post-deadline gate arms", () => {
    mockGateArmed = true

    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(true)
  })

  it("stays hidden while the self-custodial kill-switch is off, even with the gate armed", () => {
    mockGateArmed = true
    mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: true }

    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(false)
  })

  it("keeps the gate blocking while the remote config has not settled yet", () => {
    mockGateArmed = true
    mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: false }

    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(true)
  })
})
