import { renderHook } from "@testing-library/react-native"

import { useMigrationBlocker } from "@app/screens/account-migration/hooks/use-migration-blocker"

let mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useFeatureFlags: () => mockFeatureFlags,
}))

let mockGateArmed = false
let mockMigrationLocked = false

jest.mock("@app/screens/account-migration/hooks/use-wind-down-gate-armed", () => ({
  useWindDownGateArmed: () => mockGateArmed,
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-lock", () => ({
  useMigrationLock: () => ({ isLocked: mockMigrationLocked, loading: false }),
}))

describe("useMigrationBlocker", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGateArmed = false
    mockMigrationLocked = false
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

  /**
   * The lock is what makes the point of no return real: it comes from the server, so it
   * survives a reinstall that wipes the checkpoint, and it blocks whatever phase the
   * wind-down is in, because a migration under way is emptying the custodial account.
   */
  it("blocks the app for a migration the server has locked, before any deadline", () => {
    mockMigrationLocked = true

    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(true)
  })

  /** A locked user cannot finish a migration whose destination stack is switched off, so
   *  the emergency kill-switch outranks the lock exactly as it outranks the gate. */
  it("stays hidden while the self-custodial kill-switch is off, even when locked", () => {
    mockMigrationLocked = true
    mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: true }

    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(false)
  })
})
