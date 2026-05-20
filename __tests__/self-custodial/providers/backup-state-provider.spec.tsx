import React from "react"
import { renderHook, act } from "@testing-library/react-native"

import {
  BackupStateProvider,
  useBackupState,
  BackupStatus,
} from "@app/self-custodial/providers/backup-state-provider"

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
}))

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <BackupStateProvider>{children}</BackupStateProvider>
)

describe("BackupStateProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue(undefined)
  })

  it("provides default state when no persisted data", () => {
    const { result } = renderHook(() => useBackupState(), { wrapper })

    expect(result.current.backupState.status).toBe(BackupStatus.None)
    expect(result.current.backupState.method).toBeNull()
  })

  it("loads persisted state on mount", async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ status: "completed", method: "cloud" }),
    )

    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    expect(result.current.backupState.status).toBe(BackupStatus.Completed)
    expect(result.current.backupState.method).toBe("cloud")
  })

  it("sets backup completed and persists", async () => {
    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {
      result.current.setBackupCompleted("manual")
    })

    expect(result.current.backupState.status).toBe(BackupStatus.Completed)
    expect(result.current.backupState.method).toBe("manual")
    expect(mockSetItem).toHaveBeenCalledWith(
      "backupState",
      JSON.stringify({ status: "completed", method: "manual" }),
    )
  })

  it("ignores corrupted persisted data", async () => {
    mockGetItem.mockResolvedValue("not-valid-json{{{")

    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    expect(result.current.backupState.status).toBe(BackupStatus.None)
  })

  it("ignores persisted data with invalid status", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ status: "unknown", method: "cloud" }))

    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    expect(result.current.backupState.status).toBe(BackupStatus.None)
  })

  it("resets backup state and persists", async () => {
    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {
      result.current.setBackupCompleted("keychain")
    })

    await act(async () => {
      result.current.resetBackupState()
    })

    expect(result.current.backupState.status).toBe(BackupStatus.None)
    expect(result.current.backupState.method).toBeNull()
  })
})
