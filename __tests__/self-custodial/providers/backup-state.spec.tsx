import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react-native"

import {
  BackupStateProvider,
  useBackupState,
  BackupMethod,
  BackupStatus,
  completedMethodsOf,
  markBackupCompletedFor,
  removeBackupStateFor,
} from "@app/self-custodial/providers/backup-state"
import { AccountType, AccountStatus } from "@app/types/wallet"

const TEST_SC_ACCOUNT_ID = "test-self-custodial-uuid"
const OTHER_SC_ACCOUNT_ID = "other-self-custodial-uuid"
const BACKUP_KEY = `backupState:${TEST_SC_ACCOUNT_ID}`
const OTHER_BACKUP_KEY = `backupState:${OTHER_SC_ACCOUNT_ID}`

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
const mockRemoveItem = jest.fn()

let mockActiveAccount: {
  id: string
  type: AccountType
  label: string
  selected: boolean
  status: AccountStatus
} | null = null

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
  removeItem: (...args: unknown[]) => mockRemoveItem(...args),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccount,
    accounts: [],
    selfCustodialEntries: mockActiveAccount
      ? [{ id: mockActiveAccount.id, lightningAddress: null }]
      : [],
    setActiveAccountId: jest.fn(),
    reloadSelfCustodialAccounts: jest.fn().mockResolvedValue(undefined),
  }),
}))

const makeAccount = (id: string) => ({
  id,
  type: AccountType.SelfCustodial,
  label: "Spark",
  selected: true,
  status: AccountStatus.RequiresRestore,
})

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
  log: jest.fn(),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <BackupStateProvider>{children}</BackupStateProvider>
)

describe("BackupStateProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue(undefined)
    mockRemoveItem.mockResolvedValue(undefined)
    mockActiveAccount = makeAccount(TEST_SC_ACCOUNT_ID)
  })

  it("is a safe no-op when used outside the provider", () => {
    const { result } = renderHook(() => useBackupState())

    act(() => {
      result.current.setBackupCompleted("manual")
      result.current.resetBackupState()
    })

    expect(result.current.backupState.status).toBe(BackupStatus.None)
    expect(mockSetItem).not.toHaveBeenCalled()
  })

  it("provides default state when no persisted data", async () => {
    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    expect(result.current.backupState.status).toBe(BackupStatus.None)
    expect(result.current.backupState.method).toBeNull()
  })

  it("loads persisted state on mount", async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ status: "completed", method: "cloud" }),
    )

    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    expect(mockGetItem).toHaveBeenCalledWith(BACKUP_KEY)
    expect(result.current.backupState.status).toBe(BackupStatus.Completed)
    expect(result.current.backupState.method).toBe("cloud")
  })

  it("sets backup completed and persists under the accountId key", async () => {
    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    await act(async () => {
      result.current.setBackupCompleted("manual")
    })

    expect(result.current.backupState.status).toBe(BackupStatus.Completed)
    expect(result.current.backupState.method).toBe("manual")
    expect(mockSetItem).toHaveBeenCalledWith(
      BACKUP_KEY,
      expect.stringContaining('"status":"completed"'),
    )
    expect(JSON.parse(mockSetItem.mock.calls[0][1])).toMatchObject({
      status: "completed",
      method: "manual",
      completedMethods: ["manual"],
    })
  })

  describe("per-method completion history", () => {
    it("accumulates completedMethods across different methods, method stays last-wins", async () => {
      const { result } = renderHook(() => useBackupState(), { wrapper })

      await act(async () => {})

      await act(async () => {
        result.current.setBackupCompleted("cloud")
      })
      await act(async () => {
        result.current.setBackupCompleted("manual")
      })

      expect(result.current.backupState.method).toBe("manual")
      expect(result.current.backupState.completedMethods).toEqual(["cloud", "manual"])
    })

    it("does not duplicate a method completed twice", async () => {
      const { result } = renderHook(() => useBackupState(), { wrapper })

      await act(async () => {})

      await act(async () => {
        result.current.setBackupCompleted("cloud")
      })
      await act(async () => {
        result.current.setBackupCompleted("cloud")
      })

      expect(result.current.backupState.completedMethods).toEqual(["cloud"])
    })

    it("extends legacy persisted state (no completedMethods) instead of forgetting it", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({ status: "completed", method: "cloud" }),
      )

      const { result } = renderHook(() => useBackupState(), { wrapper })

      await waitFor(() =>
        expect(result.current.backupState.status).toBe(BackupStatus.Completed),
      )

      await act(async () => {
        result.current.setBackupCompleted("manual")
      })

      expect(result.current.backupState.completedMethods).toEqual(["cloud", "manual"])
    })
  })

  describe("completedMethodsOf", () => {
    it("derives the list from legacy stored state without completedMethods", () => {
      expect(completedMethodsOf({ status: "completed", method: "cloud" })).toEqual([
        "cloud",
      ])
    })

    it("prefers an explicit completedMethods list", () => {
      expect(
        completedMethodsOf({
          status: "completed",
          method: "manual",
          completedMethods: ["cloud", "manual"],
        }),
      ).toEqual(["cloud", "manual"])
    })

    it("returns empty for non-completed or null state", () => {
      expect(completedMethodsOf({ status: "none", method: null })).toEqual([])
      expect(completedMethodsOf(null)).toEqual([])
    })
  })

  /** The provider mounts above the app ErrorBoundary, so an unhandled rejection from the
   *  storage read has no net at all; a failed read reports and settles to the default. */
  it("reports a failing storage read and settles to the default state", async () => {
    mockGetItem.mockRejectedValue(new Error("storage unavailable"))

    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    expect(result.current.backupState.status).toBe(BackupStatus.None)
    expect(mockReportError).toHaveBeenCalledWith("Backup state read", expect.any(Error))
  })

  /** The recovery half of the fallback: after a failed read settles the provider to the
   *  default state, a later completion must still persist (#4088 review, G4). */
  it("persists a later completion after a failed read settled to defaults", async () => {
    mockGetItem.mockRejectedValue(new Error("storage unavailable"))

    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    await act(async () => {
      result.current.setBackupCompleted("manual")
    })

    expect(result.current.backupState.status).toBe(BackupStatus.Completed)
    expect(mockSetItem).toHaveBeenCalledWith(
      BACKUP_KEY,
      JSON.stringify({
        status: "completed",
        method: "manual",
        completedMethods: ["manual"],
      }),
    )
  })

  it("reports a failing persist without losing the in-memory state", async () => {
    mockSetItem.mockRejectedValue(new Error("disk full"))

    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    await act(async () => {
      result.current.setBackupCompleted("manual")
    })

    expect(result.current.backupState.status).toBe(BackupStatus.Completed)
    expect(mockReportError).toHaveBeenCalledWith(
      "Backup state persist",
      expect.any(Error),
    )
  })

  it("drops a read that resolves after unmount", async () => {
    let resolveRead: (value: string | null) => void = () => {}
    mockGetItem.mockReturnValue(
      new Promise<string | null>((resolve) => {
        resolveRead = resolve
      }),
    )

    const { unmount } = renderHook(() => useBackupState(), { wrapper })
    unmount()

    await act(async () => {
      resolveRead(JSON.stringify({ status: "completed", method: "cloud" }))
    })

    expect(mockGetItem).toHaveBeenCalledWith(BACKUP_KEY)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("does not persist a completion without an active self-custodial account", async () => {
    mockActiveAccount = null

    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    await act(async () => {
      result.current.setBackupCompleted("manual")
    })

    expect(mockSetItem).not.toHaveBeenCalled()
  })

  it("markBackupCompletedFor writes the completed state under the given accountId", async () => {
    await markBackupCompletedFor(OTHER_SC_ACCOUNT_ID, BackupMethod.Manual)

    expect(mockSetItem).toHaveBeenCalledWith(
      OTHER_BACKUP_KEY,
      JSON.stringify({
        status: "completed",
        method: "manual",
        completedMethods: ["manual"],
      }),
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

    await act(async () => {})

    await act(async () => {
      result.current.setBackupCompleted("keychain")
    })

    await act(async () => {
      result.current.resetBackupState()
    })

    expect(result.current.backupState.status).toBe(BackupStatus.None)
    expect(result.current.backupState.method).toBeNull()
    expect(result.current.backupState.completedMethods).toBeUndefined()
  })

  it("never writes when the active account is not self-custodial", async () => {
    mockActiveAccount = {
      id: "custodial-default",
      type: AccountType.Custodial,
      label: "Custodial",
      selected: true,
      status: AccountStatus.RequiresRestore,
    }

    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    await act(async () => {
      result.current.setBackupCompleted("manual")
    })

    expect(mockSetItem).not.toHaveBeenCalled()
    expect(result.current.backupState.status).toBe(BackupStatus.None)
  })

  it("keeps the in-memory state and reports when the persist write fails", async () => {
    mockSetItem.mockRejectedValue(new Error("disk full"))

    const { result } = renderHook(() => useBackupState(), { wrapper })

    await act(async () => {})

    await act(async () => {
      result.current.setBackupCompleted("manual")
    })

    expect(result.current.backupState.status).toBe(BackupStatus.Completed)
    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith(
        "Backup state persist",
        expect.any(Error),
      ),
    )
  })

  describe("account-switch transition", () => {
    it("reloads the new account's persisted state when activeAccount.id changes", async () => {
      mockGetItem.mockImplementation((key: string) => {
        if (key === BACKUP_KEY) {
          return Promise.resolve(
            JSON.stringify({ status: "completed", method: "manual" }),
          )
        }
        if (key === OTHER_BACKUP_KEY) {
          return Promise.resolve(JSON.stringify({ status: "completed", method: "cloud" }))
        }
        return Promise.resolve(null)
      })

      const { result, rerender } = renderHook(() => useBackupState(), { wrapper })

      await waitFor(() =>
        expect(result.current.backupState.status).toBe(BackupStatus.Completed),
      )
      expect(result.current.backupState.method).toBe("manual")

      mockActiveAccount = makeAccount(OTHER_SC_ACCOUNT_ID)
      rerender(undefined)

      await waitFor(() => expect(result.current.backupState.method).toBe("cloud"))
      expect(result.current.backupState.status).toBe(BackupStatus.Completed)
      expect(mockGetItem).toHaveBeenCalledWith(OTHER_BACKUP_KEY)
    })

    it("falls back to default state when the new account has no persisted record", async () => {
      mockGetItem.mockImplementation((key: string) => {
        if (key === BACKUP_KEY) {
          return Promise.resolve(
            JSON.stringify({ status: "completed", method: "manual" }),
          )
        }
        return Promise.resolve(null)
      })

      const { result, rerender } = renderHook(() => useBackupState(), { wrapper })

      await waitFor(() =>
        expect(result.current.backupState.status).toBe(BackupStatus.Completed),
      )

      mockActiveAccount = makeAccount(OTHER_SC_ACCOUNT_ID)
      rerender(undefined)

      await waitFor(() =>
        expect(result.current.backupState.status).toBe(BackupStatus.None),
      )
      expect(result.current.backupState.method).toBeNull()
    })

    it("ignores a stale read that resolves after the account has switched", async () => {
      let resolveStaleRead: (raw: string) => void = () => {}
      mockGetItem.mockImplementation((key: string) => {
        if (key === BACKUP_KEY) {
          return new Promise((resolve) => {
            resolveStaleRead = resolve
          })
        }
        if (key === OTHER_BACKUP_KEY) {
          return Promise.resolve(JSON.stringify({ status: "completed", method: "cloud" }))
        }
        return Promise.resolve(null)
      })

      const { result, rerender } = renderHook(() => useBackupState(), { wrapper })

      mockActiveAccount = makeAccount(OTHER_SC_ACCOUNT_ID)
      rerender(undefined)

      await waitFor(() => expect(result.current.backupState.method).toBe("cloud"))

      await act(async () => {
        resolveStaleRead(JSON.stringify({ status: "completed", method: "manual" }))
      })

      expect(result.current.backupState.method).toBe("cloud")
    })

    it("clears the backup state when the active account becomes a non-self-custodial account", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({ status: "completed", method: "manual" }),
      )

      const { result, rerender } = renderHook(() => useBackupState(), { wrapper })

      await waitFor(() =>
        expect(result.current.backupState.status).toBe(BackupStatus.Completed),
      )

      mockActiveAccount = {
        id: "custodial-default",
        type: AccountType.Custodial,
        label: "Custodial",
        selected: true,
        status: AccountStatus.RequiresRestore,
      }
      rerender(undefined)

      await waitFor(() =>
        expect(result.current.backupState.status).toBe(BackupStatus.None),
      )
      expect(result.current.backupState.method).toBeNull()
    })

    it("scopes setBackupCompleted writes to the new active account after a switch", async () => {
      const { result, rerender } = renderHook(() => useBackupState(), { wrapper })

      await act(async () => {})

      mockActiveAccount = makeAccount(OTHER_SC_ACCOUNT_ID)
      rerender(undefined)

      await act(async () => {})

      await act(async () => {
        result.current.setBackupCompleted("cloud")
      })

      expect(mockSetItem).toHaveBeenCalledWith(OTHER_BACKUP_KEY, expect.any(String))
      expect(JSON.parse(mockSetItem.mock.calls[0][1])).toMatchObject({
        status: "completed",
        method: "cloud",
      })
      expect(mockSetItem).not.toHaveBeenCalledWith(BACKUP_KEY, expect.any(String))
    })
  })

  describe("markBackupCompletedFor", () => {
    it("merges into existing persisted state instead of blind-overwriting", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({ status: "completed", method: "cloud" }),
      )

      await markBackupCompletedFor(TEST_SC_ACCOUNT_ID, "manual")

      expect(mockSetItem).toHaveBeenCalledWith(BACKUP_KEY, expect.any(String))
      expect(JSON.parse(mockSetItem.mock.calls[0][1])).toMatchObject({
        status: "completed",
        method: "manual",
        completedMethods: ["cloud", "manual"],
      })
    })

    it("preserves unknown persisted fields (forward-compat with in-flight backup options)", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify({
          status: "completed",
          method: "cloud",
          cloudPasswordProtected: true,
        }),
      )

      await markBackupCompletedFor(TEST_SC_ACCOUNT_ID, "manual")

      expect(JSON.parse(mockSetItem.mock.calls[0][1])).toMatchObject({
        cloudPasswordProtected: true,
        completedMethods: ["cloud", "manual"],
      })
    })

    it("writes a fresh record when nothing is persisted yet", async () => {
      await markBackupCompletedFor(TEST_SC_ACCOUNT_ID, "manual")

      expect(JSON.parse(mockSetItem.mock.calls[0][1])).toMatchObject({
        status: "completed",
        method: "manual",
        completedMethods: ["manual"],
      })
    })
  })

  describe("removeBackupStateFor", () => {
    it("removes the persisted backup state for the given accountId", async () => {
      await removeBackupStateFor(TEST_SC_ACCOUNT_ID)

      expect(mockRemoveItem).toHaveBeenCalledTimes(1)
      expect(mockRemoveItem).toHaveBeenCalledWith(BACKUP_KEY)
    })

    it("scopes removal to the namespaced key only", async () => {
      await removeBackupStateFor("alice")

      expect(mockRemoveItem).toHaveBeenCalledWith("backupState:alice")
      expect(mockRemoveItem).not.toHaveBeenCalledWith("backupState")
      expect(mockRemoveItem).not.toHaveBeenCalledWith(BACKUP_KEY)
    })
  })
})
