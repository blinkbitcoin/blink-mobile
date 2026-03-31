import { renderHook, act } from "@testing-library/react-native"

import {
  useMigrationCheckpoint,
  MigrationCheckpoint,
} from "@app/screens/account-migration/hooks"

const mockSaveJson = jest.fn()
const mockLoadJson = jest.fn()
const mockRemove = jest.fn()

jest.mock("@app/utils/storage", () => ({
  saveJson: (key: string, value: Record<string, number | string>) =>
    mockSaveJson(key, value),
  loadJson: (key: string) => mockLoadJson(key),
  remove: (key: string) => mockRemove(key),
}))

describe("useMigrationCheckpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoadJson.mockResolvedValue(null)
  })

  it("starts with null checkpoint and loading true", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    expect(result.current.loading).toBe(true)
    expect(result.current.checkpoint).toBeNull()

    await act(async () => {})

    expect(result.current.loading).toBe(false)
  })

  it("loads existing checkpoint from storage", async () => {
    mockLoadJson.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await act(async () => {})

    expect(result.current.checkpoint).toBe(MigrationCheckpoint.BackupMethod)
    expect(result.current.loading).toBe(false)
  })

  it("saveCheckpoint persists step and timestamp to storage", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    await act(async () => {})

    act(() => {
      result.current.saveCheckpoint(MigrationCheckpoint.BackupAlerts)
    })

    expect(result.current.checkpoint).toBe(MigrationCheckpoint.BackupAlerts)
    expect(mockSaveJson).toHaveBeenCalledWith(
      "migrationCheckpoint",
      expect.objectContaining({
        step: MigrationCheckpoint.BackupAlerts,
        savedAt: expect.any(Number),
      }),
    )
  })

  it("clearCheckpoint removes from storage", async () => {
    mockLoadJson.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await act(async () => {})

    act(() => {
      result.current.clearCheckpoint()
    })

    expect(result.current.checkpoint).toBeNull()
    expect(mockRemove).toHaveBeenCalledWith("migrationCheckpoint")
  })

  it("getRouteForCheckpoint returns correct route", async () => {
    mockLoadJson.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: Date.now(),
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await act(async () => {})

    expect(result.current.getRouteForCheckpoint()).toBe("sparkBackupMethodScreen")
  })

  it("getRouteForCheckpoint returns explainer when no checkpoint", async () => {
    const { result } = renderHook(() => useMigrationCheckpoint())

    await act(async () => {})

    expect(result.current.getRouteForCheckpoint()).toBe("sparkMigrationExplainer")
  })

  it("ignores expired checkpoint and removes from storage", async () => {
    const expiredTimestamp = Date.now() - 49 * 60 * 60 * 1000
    mockLoadJson.mockResolvedValue({
      step: MigrationCheckpoint.BackupAlerts,
      savedAt: expiredTimestamp,
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await act(async () => {})

    expect(result.current.checkpoint).toBeNull()
    expect(mockRemove).toHaveBeenCalledWith("migrationCheckpoint")
  })

  it("keeps valid checkpoint within 48 hours", async () => {
    const recentTimestamp = Date.now() - 47 * 60 * 60 * 1000
    mockLoadJson.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: recentTimestamp,
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await act(async () => {})

    expect(result.current.checkpoint).toBe(MigrationCheckpoint.BackupMethod)
  })

  it("ignores invalid checkpoint value from storage", async () => {
    mockLoadJson.mockResolvedValue({
      step: "invalidStep",
      savedAt: Date.now(),
    })

    const { result } = renderHook(() => useMigrationCheckpoint())

    await act(async () => {})

    expect(result.current.checkpoint).toBeNull()
  })
})
