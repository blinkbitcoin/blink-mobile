import { act, renderHook } from "@testing-library/react-native"

import { useMigrationBlocker } from "@app/screens/account-migration/hooks/use-migration-blocker"

let mockMigrationRequired = false
const mockSync = jest.fn()

jest.mock("@app/hooks/use-custodial-migration-required", () => ({
  useCustodialMigrationRequired: () => mockMigrationRequired,
  useCustodialMigrationRequiredSync: () => mockSync(),
}))

let mockGateArmed = false

jest.mock("@app/screens/account-migration/hooks/use-migration-gate-armed", () => ({
  useMigrationGateArmed: () => mockGateArmed,
}))

describe("useMigrationBlocker", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMigrationRequired = false
    mockGateArmed = false
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
})
