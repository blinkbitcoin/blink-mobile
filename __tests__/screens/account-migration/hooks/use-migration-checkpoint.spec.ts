import { renderHook, act, waitFor } from "@testing-library/react-native"

import {
  useMigrationCheckpoint,
  MigrationCheckpoint,
} from "@app/screens/account-migration/hooks"

const mockLoadCheckpoint = jest.fn()
const mockSaveCheckpointToStorage = jest.fn()
const mockClearCheckpointFromStorage = jest.fn()

jest.mock("@app/screens/account-migration/utils/migration-checkpoint-storage", () => ({
  ...jest.requireActual(
    "@app/screens/account-migration/utils/migration-checkpoint-storage",
  ),
  loadCheckpoint: (...args: readonly unknown[]) => mockLoadCheckpoint(...args),
  saveCheckpointToStorage: (...args: readonly unknown[]) =>
    mockSaveCheckpointToStorage(...args),
  clearCheckpointFromStorage: (...args: readonly unknown[]) =>
    mockClearCheckpointFromStorage(...args),
  getStorageKey: (env: string) => `migrationCheckpoint_${env.toLowerCase()}`,
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Main" } },
  }),
}))

describe("useMigrationCheckpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
    expect(mockSaveCheckpointToStorage).toHaveBeenCalledWith(
      "migrationCheckpoint_main",
      MigrationCheckpoint.BackupMethod,
    )
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

  it("returns default route when no checkpoint", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.getRouteForCheckpoint()).toBe("sparkMigrationExplainer")
  })

  it("returns correct route for checkpoint", async () => {
    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.getRouteForCheckpoint()).toBe("sparkBackupMethodScreen")
  })

  it("resumes from checkpoint after unmount and remount", async () => {
    mockLoadCheckpoint.mockResolvedValue(null)

    const { result, unmount } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.saveCheckpoint(MigrationCheckpoint.BackupAlerts)
    })

    expect(result.current.checkpoint).toBe(MigrationCheckpoint.BackupAlerts)
    expect(mockSaveCheckpointToStorage).toHaveBeenCalledWith(
      "migrationCheckpoint_main",
      MigrationCheckpoint.BackupAlerts,
    )

    unmount()

    mockLoadCheckpoint.mockResolvedValue({
      step: MigrationCheckpoint.BackupAlerts,
      savedAt: Date.now(),
    })

    const { result: result2 } = renderHook(() => useMigrationCheckpoint())

    await waitFor(() => expect(result2.current.loading).toBe(false))

    expect(result2.current.checkpoint).toBe(MigrationCheckpoint.BackupAlerts)
    expect(result2.current.getRouteForCheckpoint()).toBe("sparkBackupAlertsScreen")
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
