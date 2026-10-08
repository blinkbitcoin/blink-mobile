import { renderHook } from "@testing-library/react-native"

import {
  MigrationBlockerProvider,
  useMigrationBlocker,
} from "@app/screens/account-migration/hooks/use-migration-blocker"

let mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useFeatureFlags: () => mockFeatureFlags,
}))

let mockGateArmed = false
let mockMigrationLocked = false
let mockMigrationCompleted = false
const mockRefetchLock = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-wind-down-gate-armed", () => ({
  useWindDownGateArmed: () => mockGateArmed,
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-lock", () => ({
  useMigrationLock: () => ({
    isLocked: mockMigrationLocked,
    isCompleted: mockMigrationCompleted,
    loading: false,
    refetch: mockRefetchLock,
  }),
}))

/** Rendered through the provider, so the test reads the one shared answer both consumers
 *  get rather than a private computation. */
const renderBlocker = () =>
  renderHook(() => useMigrationBlocker(), { wrapper: MigrationBlockerProvider })

describe("useMigrationBlocker", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGateArmed = false
    mockMigrationLocked = false
    mockMigrationCompleted = false
    mockFeatureFlags = { nonCustodialEnabled: true, remoteConfigReady: true }
  })

  it("stays hidden before the gate arms, since the pre-deadline nudge is the home bulletin", () => {
    const { result } = renderBlocker()

    expect(result.current.isVisible).toBe(false)
  })

  it("blocks the app once the post-deadline gate arms", () => {
    mockGateArmed = true

    const { result } = renderBlocker()

    expect(result.current.isVisible).toBe(true)
  })

  it("stays hidden while the self-custodial kill-switch is off, even with the gate armed", () => {
    mockGateArmed = true
    mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: true }

    const { result } = renderBlocker()

    expect(result.current.isVisible).toBe(false)
  })

  it("keeps the gate blocking while the remote config has not settled yet", () => {
    mockGateArmed = true
    mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: false }

    const { result } = renderBlocker()

    expect(result.current.isVisible).toBe(true)
  })

  /**
   * The lock is what makes the point of no return real: it comes from the server, so it
   * survives a reinstall that wipes the checkpoint, and it blocks whatever phase the
   * wind-down is in, because a migration under way is emptying the custodial account.
   */
  it("blocks the app for a migration the server has locked, before any deadline", () => {
    mockMigrationLocked = true

    const { result } = renderBlocker()

    expect(result.current.isVisible).toBe(true)
  })

  /** A locked user cannot finish a migration whose destination stack is switched off, so
   *  the emergency kill-switch outranks the lock exactly as it outranks the gate. */
  it("stays hidden while the self-custodial kill-switch is off, even when locked", () => {
    mockMigrationLocked = true
    mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: true }

    const { result } = renderBlocker()

    expect(result.current.isVisible).toBe(false)
  })

  /** Without a provider the context default holds, so a stray consumer reads the app as not
   *  blocked rather than crashing. */
  it("defaults to not visible without a provider", () => {
    mockGateArmed = true

    const { result } = renderHook(() => useMigrationBlocker())

    expect(result.current.isVisible).toBe(false)
  })

  /**
   * The server keeps reporting the custodial account as closed after its funds have left.
   * A gate that stayed up would replace the whole app with a flow the server refuses to
   * start again, keeping the user from the wallet the funds went to.
   */
  describe("once the migration has completed", () => {
    it("lifts the armed gate", () => {
      mockGateArmed = true
      mockMigrationCompleted = true

      const { result } = renderBlocker()

      expect(result.current.isVisible).toBe(false)
    })

    it("keeps the armed gate while the migration has not completed", () => {
      mockGateArmed = true
      mockMigrationCompleted = false

      const { result } = renderBlocker()

      expect(result.current.isVisible).toBe(true)
    })

    /** Completed and locked cannot both come from one server answer, but the lock is the
     *  stronger signal: if it ever says the flow is still open, the flow wins. */
    it("never lifts a lock", () => {
      mockMigrationLocked = true
      mockMigrationCompleted = true

      const { result } = renderBlocker()

      expect(result.current.isVisible).toBe(true)
    })
  })

  /** Its answer is read once per launch, so the gate's retry refreshes it through here. */
  describe("the re-read it shares", () => {
    it("hands out the read behind its answer", async () => {
      const { result } = renderBlocker()

      await result.current.refetch()

      expect(mockRefetchLock).toHaveBeenCalledTimes(1)
    })

    it("hands it out while the kill-switch hides the blocker too", async () => {
      mockFeatureFlags = { nonCustodialEnabled: false, remoteConfigReady: true }
      const { result } = renderBlocker()

      await result.current.refetch()

      expect(mockRefetchLock).toHaveBeenCalledTimes(1)
    })

    /** Outside the provider nothing can re-read, and asking must not throw. */
    it("answers a re-read outside the provider with nothing", async () => {
      const { result } = renderHook(() => useMigrationBlocker())

      await expect(result.current.refetch()).resolves.toBeUndefined()
      expect(mockRefetchLock).not.toHaveBeenCalled()
    })
  })
})
