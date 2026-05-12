import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react-native"

import {
  BackupStateProvider,
  useBackupState,
  BackupStatus,
  removeBackupStateFor,
} from "@app/self-custodial/providers/backup-state-provider"
import { AccountType, AccountStatus } from "@app/types/wallet"

const TEST_SC_ACCOUNT_ID = "test-sc-uuid"
const OTHER_SC_ACCOUNT_ID = "other-sc-uuid"
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

    await act(async () => {})

    await act(async () => {
      result.current.setBackupCompleted("keychain")
    })

    await act(async () => {
      result.current.resetBackupState()
    })

    expect(result.current.backupState.status).toBe(BackupStatus.None)
    expect(result.current.backupState.method).toBeNull()
  })

  describe("account-switch transition (Important #10)", () => {
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

      expect(mockSetItem).toHaveBeenCalledWith(
        OTHER_BACKUP_KEY,
        JSON.stringify({ status: "completed", method: "cloud" }),
      )
      expect(mockSetItem).not.toHaveBeenCalledWith(BACKUP_KEY, expect.any(String))
    })
  })

  describe("removeBackupStateFor (Important #10)", () => {
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
