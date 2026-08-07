import { renderHook, act, waitFor } from "@testing-library/react-native"

import {
  useMigrationCheckpoint,
  MigrationCheckpoint,
} from "@app/screens/account-migration/hooks"

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockLoadCheckpoint = jest.fn()
const mockSaveCheckpointToStorage = jest.fn()
const mockClearCheckpointFromStorage = jest.fn()
const mockReportError = jest.fn()
let mockActiveAccount: { id: string; type: string } | undefined
let mockOwnerId: string | null = "custodial-1"
let mockFocusCallback: (() => void | (() => void)) | null = null

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual("react")
    useEffect(() => {
      mockFocusCallback = callback
      return callback()
    }, [callback])
  },
}))

jest.mock("@app/screens/account-migration/utils/migration-checkpoint-storage", () => ({
  ...jest.requireActual(
    "@app/screens/account-migration/utils/migration-checkpoint-storage",
  ),
  loadCheckpoint: (...args: readonly unknown[]) => mockLoadCheckpoint(...args),
  saveCheckpointToStorage: (...args: readonly unknown[]) =>
    mockSaveCheckpointToStorage(...args),
  clearCheckpointFromStorage: (...args: readonly unknown[]) =>
    mockClearCheckpointFromStorage(...args),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => ({ ownerId: mockOwnerId, loading: false }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Main" } },
  }),
}))

describe("useMigrationCheckpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccount = { id: "custodial-1", type: "custodial" }
    mockOwnerId = "custodial-1"
    mockFocusCallback = null
    mockLoadCheckpoint.mockResolvedValue(null)
    mockSaveCheckpointToStorage.mockResolvedValue(undefined)
    mockClearCheckpointFromStorage.mockResolvedValue(undefined)
  })

  it("starts with null checkpoint and loading true", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    expect(result.current.loading).toBe(true)
    expect(result.current.checkpoint).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it("loads existing checkpoint from storage", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupAlerts,
      savedAt: Date.now(),
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.checkpoint).toBe(MigrationCheckpoint.BackupAlerts)
  })

  it("sets loading false when no checkpoint found", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.checkpoint).toBeNull()
  })

  it("saves checkpoint to storage", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.saveCheckpoint(MigrationCheckpoint.BackupMethod)
    })

    expect(result.current.checkpoint).toBe(MigrationCheckpoint.BackupMethod)
    expect(mockSaveCheckpointToStorage).toHaveBeenCalledWith("migrationCheckpoint_main", {
      step: MigrationCheckpoint.BackupMethod,
      accountId: undefined,
      custodialAccountId: "custodial-1",
    })
  })

  it("persists and exposes the provisioned account id", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.saveCheckpoint(MigrationCheckpoint.BackupMethod, "sc-account-1")
    })

    expect(result.current.accountId).toBe("sc-account-1")
    expect(mockSaveCheckpointToStorage).toHaveBeenCalledWith("migrationCheckpoint_main", {
      step: MigrationCheckpoint.BackupMethod,
      accountId: "sc-account-1",
      custodialAccountId: "custodial-1",
    })
  })

  it("loads the provisioned account id from storage", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupAlerts,
      savedAt: Date.now(),
      accountId: "sc-account-2",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.accountId).toBe("sc-account-2")
  })

  it("persists and exposes the expected receive figure", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.saveCheckpoint(MigrationCheckpoint.BalancesOverview, "sc-1", 21000)
    })

    expect(result.current.expectedReceiveSats).toBe(21000)
    expect(mockSaveCheckpointToStorage).toHaveBeenCalledWith("migrationCheckpoint_main", {
      step: MigrationCheckpoint.BalancesOverview,
      accountId: "sc-1",
      custodialAccountId: "custodial-1",
      expectedReceiveSats: 21000,
    })
  })

  it("loads the expected receive figure from storage", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BalancesOverview,
      savedAt: Date.now(),
      accountId: "sc-account-2",
      expectedReceiveSats: 500,
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.expectedReceiveSats).toBe(500)
  })

  /** A zero must survive the save: the receive gate reads absent as "unknown" and would
   *  wait on a receive that a zero-figure migration will never get. */
  it("re-sends a known zero expected figure on step saves", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BalancesOverview,
      savedAt: Date.now(),
      accountId: "sc-account-2",
      custodialAccountId: "custodial-1",
      expectedReceiveSats: 0,
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.saveCheckpoint(MigrationCheckpoint.BalancesOverview)
    })

    expect(mockSaveCheckpointToStorage).toHaveBeenCalledWith("migrationCheckpoint_main", {
      step: MigrationCheckpoint.BalancesOverview,
      accountId: "sc-account-2",
      custodialAccountId: "custodial-1",
      expectedReceiveSats: 0,
    })
  })

  it("reports the error and finishes loading when loadCheckpoint rejects", async () => {
    mockLoadCheckpoint.mockRejectedValue(new Error("corrupt"))

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockReportError).toHaveBeenCalledWith("Checkpoint load", expect.any(Error))
    expect(result.current.checkpoint).toBeNull()
    /** Surfaced, not swallowed: an unreadable store must stay distinguishable from an
     *  empty one, or the gate reads a transient failure as a wiped device. */
    expect(result.current.hasError).toBe(true)
  })

  it("recovers through refetch after a failed load", async () => {
    mockLoadCheckpoint.mockRejectedValueOnce(new Error("corrupt"))
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupAlerts,
      savedAt: Date.now(),
      accountId: "sc-account-2",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.checkpoint).toBe(MigrationCheckpoint.BackupAlerts)
    expect(result.current.hasResumableCheckpoint).toBe(true)
  })

  /** The error may only clear once the retry has SUCCEEDED: clearing it when the retry
   *  starts would present the still-empty state as settled data for the length of the
   *  read, and the gate would hand the user to support on it. */
  it("keeps hasError raised while a refetch is still in flight", async () => {
    mockLoadCheckpoint.mockRejectedValueOnce(new Error("corrupt"))

    const { result } = renderHook(() => useMigrationCheckpoint())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    let resolveReload: (stored: unknown) => void = () => {}
    mockLoadCheckpoint.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReload = resolve
        }),
    )

    let refetchDone: Promise<void> | undefined
    act(() => {
      refetchDone = result.current.refetch()
    })
    expect(result.current.hasError).toBe(true)

    await act(async () => {
      resolveReload(null)
      await refetchDone
    })
    expect(result.current.hasError).toBe(false)
  })

  it("resolves instead of rejecting when the refetched load fails again", async () => {
    mockLoadCheckpoint.mockRejectedValue(new Error("corrupt"))

    const { result } = renderHook(() => useMigrationCheckpoint())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    /** The gate's retry Promise.alls every refetch; a rejection there would double-report
     *  a failure that already traveled through reportError and hasError. */
    await act(async () => {
      await expect(result.current.refetch()).resolves.toBeUndefined()
    })
    expect(result.current.hasError).toBe(true)
  })

  it("resolves true when the storage write succeeds", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let saved: boolean | undefined
    await act(async () => {
      saved = await result.current.saveCheckpoint(MigrationCheckpoint.BackupMethod)
    })

    expect(saved).toBe(true)
  })

  it("reports the error and resolves false when saveCheckpointToStorage rejects", async () => {
    mockSaveCheckpointToStorage.mockRejectedValue(new Error("disk full"))

    const { result } = renderHook(() => useMigrationCheckpoint())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let saved: boolean | undefined
    await act(async () => {
      saved = await result.current.saveCheckpoint(MigrationCheckpoint.BackupMethod)
    })

    expect(saved).toBe(false)
    expect(mockReportError).toHaveBeenCalledWith("Checkpoint save", expect.any(Error))
  })

  it("refuses to save (resolves false) when the owner id has not resolved", async () => {
    mockOwnerId = null

    const { result } = renderHook(() => useMigrationCheckpoint())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let saved: boolean | undefined
    await act(async () => {
      saved = await result.current.saveCheckpoint(MigrationCheckpoint.BackupMethod)
    })

    /** A null-owner save would erase the stored owner + account id via mergeCheckpoint,
     *  wiping real progress; it must refuse instead of writing. */
    expect(saved).toBe(false)
    expect(mockSaveCheckpointToStorage).not.toHaveBeenCalled()
  })

  it("re-sends the known account id on step saves so a failed write can heal", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
      accountId: "sc-account-1",
      custodialAccountId: "custodial-1",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveCheckpoint(MigrationCheckpoint.BackupAlerts)
    })

    expect(mockSaveCheckpointToStorage).toHaveBeenCalledWith("migrationCheckpoint_main", {
      step: MigrationCheckpoint.BackupAlerts,
      accountId: "sc-account-1",
      custodialAccountId: "custodial-1",
    })
  })

  it("clears checkpoint from storage", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.clearCheckpoint()
    })

    expect(result.current.checkpoint).toBeNull()
    expect(mockClearCheckpointFromStorage).toHaveBeenCalledWith(
      "migrationCheckpoint_main",
    )
  })

  it("clears the local state and reports when the storage removal fails", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
    })
    mockClearCheckpointFromStorage.mockRejectedValue(new Error("remove failed"))

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.clearCheckpoint()
    })

    expect(result.current.checkpoint).toBeNull()
    expect(mockReportError).toHaveBeenCalledWith("Checkpoint clear", expect.any(Error))
  })

  it("navigates to the explainer when no checkpoint exists", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.navigateToCheckpoint()
    })

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationExplainer")
  })

  it("navigates to the checkpoint's screen for a provisioned checkpoint", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
      accountId: "sc-account-1",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.navigateToCheckpoint()
    })

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupMethod")
  })

  it("forwards the migration flow param when resuming at the terms screen", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.TermsAndConditions,
      savedAt: Date.now(),
      accountId: "sc-account-1",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.navigateToCheckpoint()
    })

    expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "migration",
    })
  })

  it("resumes at the balances overview after reaching the commit point", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BalancesOverview,
      savedAt: Date.now(),
      accountId: "sc-account-1",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.navigateToCheckpoint()
    })

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationBalancesOverview")
  })

  it("replaces the current screen when resuming through replaceToCheckpoint", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.TermsAndConditions,
      savedAt: Date.now(),
      accountId: "sc-account-1",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.replaceToCheckpoint()
    })

    expect(mockReplace).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "migration",
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("replaces to a param-less destination when the checkpoint is past the terms", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
      accountId: "sc-account-1",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.replaceToCheckpoint()
    })

    expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupMethod")
  })

  it("resumes from the explainer when the checkpoint has no provisioned account", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.navigateToCheckpoint()
    })

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationExplainer")
  })

  it("reports a resumable checkpoint only when a provisioned account exists", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
      accountId: "sc-account-1",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasResumableCheckpoint).toBe(true)
  })

  it("has no resumable checkpoint when none is stored", async () => {
    mockLoadCheckpoint.mockResolvedValue(null)

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasResumableCheckpoint).toBe(false)
  })

  it("has no resumable checkpoint when the stored checkpoint has no account", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasResumableCheckpoint).toBe(false)
  })

  it("hides a checkpoint owned by a different custodial account", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
      accountId: "sc-account-1",
      custodialAccountId: "custodial-2",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.checkpoint).toBeNull()
    expect(result.current.accountId).toBeNull()
    expect(result.current.hasResumableCheckpoint).toBe(false)

    act(() => {
      result.current.navigateToCheckpoint()
    })

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationExplainer")
  })

  it("keeps resuming a checkpoint owned by the active custodial account", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
      accountId: "sc-account-1",
      custodialAccountId: "custodial-1",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasResumableCheckpoint).toBe(true)
  })

  it("keeps resuming a checkpoint saved before owners existed", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
      accountId: "sc-account-1",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasResumableCheckpoint).toBe(true)
  })

  it("picks up a checkpoint saved elsewhere when the screen regains focus", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasResumableCheckpoint).toBe(false)

    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
      accountId: "sc-account-1",
      custodialAccountId: "custodial-1",
    })

    await act(async () => {
      mockFocusCallback?.()
    })

    await waitFor(() => expect(result.current.hasResumableCheckpoint).toBe(true))
    expect(result.current.checkpoint).toBe(MigrationCheckpoint.BackupMethod)
  })

  it("drops a checkpoint cleared elsewhere when the screen regains focus", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
      accountId: "sc-account-1",
      custodialAccountId: "custodial-1",
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.hasResumableCheckpoint).toBe(true))

    mockLoadCheckpoint.mockResolvedValue(null)

    await act(async () => {
      mockFocusCallback?.()
    })

    await waitFor(() => expect(result.current.hasResumableCheckpoint).toBe(false))
    expect(result.current.checkpoint).toBeNull()
  })

  it("resumes from checkpoint after unmount and remount", async () => {
    mockLoadCheckpoint.mockResolvedValue(null)

    const { result, unmount } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.saveCheckpoint(MigrationCheckpoint.BackupAlerts)
    })

    expect(result.current.checkpoint).toBe(MigrationCheckpoint.BackupAlerts)
    expect(mockSaveCheckpointToStorage).toHaveBeenCalledWith("migrationCheckpoint_main", {
      step: MigrationCheckpoint.BackupAlerts,
      accountId: undefined,
      custodialAccountId: "custodial-1",
    })

    unmount()

    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupAlerts,
      savedAt: Date.now(),
      accountId: "sc-account-1",
    })

    const { result: result2 } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result2.current.loading).toBe(false))

    expect(result2.current.checkpoint).toBe(MigrationCheckpoint.BackupAlerts)

    act(() => {
      result2.current.navigateToCheckpoint()
    })

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSecurityChecks")
  })

  it("does not update state when the load fails after unmount", async () => {
    let rejectLoad: (reason: Error) => void = () => {}
    mockLoadCheckpoint.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectLoad = reject
      }),
    )

    const { unmount } = renderHook(() => useMigrationCheckpoint())
    unmount()

    await act(async () => {
      rejectLoad(new Error("load failed"))
    })

    expect(mockReportError).toHaveBeenCalled()
  })

  it("does not update state after unmount", async () => {
    let resolveLoad: (value: null) => void
    mockLoadCheckpoint.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve
      }),
    )

    const { result, unmount } = renderHook(() => useMigrationCheckpoint())

    expect(result.current.loading).toBe(true)
    unmount()

    await act(async () => {
      resolveLoad!(null)
    })
  })
})
