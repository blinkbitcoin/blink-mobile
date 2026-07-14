import { act, renderHook } from "@testing-library/react-native"

import { useMigrationBlocker } from "@app/screens/account-migration/hooks/use-migration-blocker"

let mockMigrationRequired = false
const mockSync = jest.fn()

let mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useFeatureFlags: () => mockFeatureFlags,
}))

jest.mock("@app/hooks/use-custodial-migration-required", () => ({
  useCustodialMigrationRequired: () => mockMigrationRequired,
  useCustodialMigrationRequiredSync: () => mockSync(),
}))

let mockGateArmed = false

jest.mock("@app/screens/account-migration/hooks/use-wind-down-gate-armed", () => ({
  useWindDownGateArmed: () => mockGateArmed,
}))

let mockActiveAccount: { id: string; type: string } | undefined

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

describe("useMigrationBlocker", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMigrationRequired = false
    mockGateArmed = false
    mockActiveAccount = { id: "custodial-1", type: "custodial" }
    mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }
  })

  it("stays hidden when nothing forces the migration", () => {
    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(false)
  })

  it("shows a closable blocker for a forced-cohort account", () => {
    mockMigrationRequired = true

    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(true)
    expect(result.current.onClose).toBeDefined()
  })

  it("hides for the session once dismissed", () => {
    mockMigrationRequired = true

    const { result } = renderHook(() => useMigrationBlocker())

    act(() => {
      result.current.onClose?.()
    })

    expect(result.current.isVisible).toBe(false)
  })

  it("shows an unclosable blocker once the gate arms, ignoring the dismissal", () => {
    mockMigrationRequired = true
    mockGateArmed = true

    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(true)
    expect(result.current.onClose).toBeUndefined()
  })

  it("keeps the cohort sync running while mounted", () => {
    renderHook(() => useMigrationBlocker())

    expect(mockSync).toHaveBeenCalled()
  })

  it("does not carry a dismissal across an account switch", () => {
    mockMigrationRequired = true

    const { result, rerender } = renderHook(() => useMigrationBlocker())

    act(() => {
      result.current.onClose?.()
    })
    expect(result.current.isVisible).toBe(false)

    mockActiveAccount = { id: "custodial-2", type: "custodial" }
    rerender({})

    expect(result.current.isVisible).toBe(true)
  })

  it("stays hidden while the self-custodial kill-switch is off, even with the gate armed", () => {
    mockMigrationRequired = true
    mockGateArmed = true
    mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: true }

    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(false)
  })

  it("keeps blocking while the remote config has not settled yet", () => {
    mockMigrationRequired = true
    mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: false }

    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(true)
  })
})
