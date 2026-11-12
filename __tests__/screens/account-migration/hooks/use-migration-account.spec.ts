import { renderHook, act } from "@testing-library/react-native"

import { useMigrationAccount } from "@app/screens/account-migration/hooks/use-migration-account"
import { MigrationCheckpoint } from "@app/screens/account-migration/utils/migration-checkpoint-storage"
import { StorageFailure, StorageWriteError } from "@app/utils/storage/storage-failure"

const mockSaveCheckpoint = jest.fn()
const mockProvision = jest.fn()
const mockReportError = jest.fn()
const mockToastShow = jest.fn()
let mockAccountId: string | null = null

let mockPendingForActiveAccount: string | null = null
let mockPendingReadError = false
let mockPendingReadFailure: StorageFailure | null = null
const mockRefetchPending = jest.fn()
let mockCheckpointReadError = false
let mockCheckpointReadFailure: StorageFailure | null = null
const mockRefetchCheckpoint = jest.fn()
let mockRegistryAccounts: { id: string }[] = []
const mockSavePendingAccount = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-pending-migration-accounts", () => ({
  usePendingMigrationAccounts: () => ({
    pendingForActiveAccount: mockPendingForActiveAccount,
    savePendingAccount: mockSavePendingAccount,
    loading: false,
    hasError: mockPendingReadError,
    storageFailure: mockPendingReadFailure,
    refetch: mockRefetchPending,
  }),
}))

let mockRegistryLoading = false

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    accounts: mockRegistryAccounts,
    loading: mockRegistryLoading,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint-state", () => ({
  useMigrationCheckpointState: () => ({
    accountId: mockAccountId,
    loading: false,
    hasError: mockCheckpointReadError,
    storageFailure: mockCheckpointReadFailure,
    refetch: mockRefetchCheckpoint,
    saveCheckpoint: mockSaveCheckpoint,
  }),
}))

jest.mock("@app/self-custodial/hooks/use-provision-self-custodial-account", () => ({
  useProvisionSelfCustodialAccount: () => ({ provision: mockProvision }),
}))

let mockGuardBlocked = false

jest.mock("@app/hooks/use-in-flight-guard", () => ({
  useInFlightGuard: () => ({
    run: <T>(fn: () => T) => (mockGuardBlocked ? undefined : fn()),
  }),
}))

const mockCreateFailedCopy = "creation failed"
const mockOutOfSpaceCopy = "free up some space"
const mockNotSavedCopy = "could not save your progress"
const mockUnreadableCopy = "could not read your progress"
const mockReadOutOfSpaceCopy = "no space left to read your progress"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: { createFailed: () => mockCreateFailedCopy },
      AccountMigration: {
        storageUnavailable: {
          notSavedOutOfSpaceBody: () => mockOutOfSpaceCopy,
          notSavedBody: () => mockNotSavedCopy,
          unreadableBody: () => mockUnreadableCopy,
          outOfSpaceBody: () => mockReadOutOfSpaceCopy,
        },
      },
    },
  }),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

describe("useMigrationAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountId = null
    mockGuardBlocked = false
    mockSaveCheckpoint.mockResolvedValue({ isSaved: true, failure: null })
    mockSavePendingAccount.mockResolvedValue(undefined)
    mockPendingForActiveAccount = null
    mockPendingReadError = false
    mockPendingReadFailure = null
    mockCheckpointReadError = false
    mockCheckpointReadFailure = null
    mockRefetchPending.mockResolvedValue(undefined)
    mockRefetchCheckpoint.mockResolvedValue(undefined)
    mockRegistryAccounts = []
    mockRegistryLoading = false
    mockProvision.mockImplementation(
      async (beforeCreate?: (accountId: string) => Promise<void>) => {
        if (beforeCreate) await beforeCreate("sc-account-1")
        return "sc-account-1"
      },
    )
  })

  it("returns the already provisioned account without provisioning again", async () => {
    mockAccountId = "sc-account-1"
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = null
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBe("sc-account-1")
    expect(mockProvision).not.toHaveBeenCalled()
    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
  })

  it("provisions the account and checkpoints the terms step with its id", async () => {
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = null
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBe("sc-account-1")
    expect(mockSaveCheckpoint).toHaveBeenCalledWith(
      MigrationCheckpoint.TermsAndConditions,
      { provisionedAccountId: "sc-account-1" },
    )
  })

  it("returns null while another provisioning run is in flight", async () => {
    mockGuardBlocked = true
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockProvision).not.toHaveBeenCalled()
  })

  /** The wallet was created; only its checkpoint was turned away. Saying creation failed
   *  would have the user retry the wrong thing and never learn the funds are safe. */
  it("stops the flow saying the progress was not saved when the store refused", async () => {
    mockSaveCheckpoint.mockResolvedValue({
      isSaved: false,
      failure: StorageFailure.Unknown,
    })
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: mockNotSavedCopy }),
    )
  })

  /** saveCheckpoint reports a store that refused with the store's own error; reporting it
   *  again here would count one failure twice under a message that says less. */
  it("leaves a store refusal to the report saveCheckpoint already made", async () => {
    mockSaveCheckpoint.mockResolvedValue({
      isSaved: false,
      failure: StorageFailure.Unknown,
    })
    const { result } = renderHook(() => useMigrationAccount())

    await act(async () => {
      await result.current.ensureAccount()
    })

    expect(mockReportError).not.toHaveBeenCalled()
  })

  /** A write turned away for want of an owner never reaches the store, so nothing else
   *  reports it. */
  it("reports a checkpoint write refused without an owner", async () => {
    mockSaveCheckpoint.mockResolvedValue({ isSaved: false, failure: null })
    const { result } = renderHook(() => useMigrationAccount())

    await act(async () => {
      await result.current.ensureAccount()
    })

    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration account creation",
      expect.objectContaining({ message: expect.stringContaining("without an owner") }),
    )
  })

  it("asks to free up space when the checkpoint write found the disk full", async () => {
    mockSaveCheckpoint.mockResolvedValue({
      isSaved: false,
      failure: StorageFailure.OutOfSpace,
    })
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: mockOutOfSpaceCopy }),
    )
  })

  /** Refused before reaching the store (no owner to key it by), so there is no disk to
   *  blame and the generic copy stands. */
  it("keeps the generic copy when the checkpoint write carries no kind", async () => {
    mockSaveCheckpoint.mockResolvedValue({ isSaved: false, failure: null })
    const { result } = renderHook(() => useMigrationAccount())

    await act(async () => {
      await result.current.ensureAccount()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: mockCreateFailedCopy }),
    )
  })

  it("asks to free up space when the pending-record write found the disk full", async () => {
    mockSavePendingAccount.mockRejectedValue(
      new StorageWriteError(new Error("database or disk is full")),
    )
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: mockOutOfSpaceCopy }),
    )
  })

  it("says the progress was not saved for any other pending-record write failure", async () => {
    mockSavePendingAccount.mockRejectedValue(
      new StorageWriteError(new Error("Database Error")),
    )
    const { result } = renderHook(() => useMigrationAccount())

    await act(async () => {
      await result.current.ensureAccount()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: mockNotSavedCopy }),
    )
  })

  /** Only a failure that came from storage is classified. Provisioning and the SDK throw
   *  their own errors, and one worded like a full disk must not send the user to free up
   *  space on the screen where their wallet is created. */
  it("never reads a full disk into an error that did not come from storage", async () => {
    mockProvision.mockRejectedValue(new Error("key store out of space"))
    const { result } = renderHook(() => useMigrationAccount())

    await act(async () => {
      await result.current.ensureAccount()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: mockCreateFailedCopy }),
    )
  })

  it("reports the error and returns null when provisioning fails", async () => {
    mockProvision.mockRejectedValue(new Error("provision failed"))
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockReportError).toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalled()
  })

  it("aborts provisioning with the failure toast when the pending-record save throws", async () => {
    mockSavePendingAccount.mockRejectedValue(new Error("record write failed"))
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalled()
  })

  it("records the freshly provisioned wallet as pending for reuse", async () => {
    const { result } = renderHook(() => useMigrationAccount())

    await act(async () => {
      await result.current.ensureAccount()
    })

    expect(mockSavePendingAccount).toHaveBeenCalledWith("sc-account-1")
  })

  it("reuses the pending wallet of an earlier abandoned run", async () => {
    mockPendingForActiveAccount = "sc-pending-1"
    mockRegistryAccounts = [{ id: "sc-pending-1" }]

    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = null
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBe("sc-pending-1")
    expect(mockProvision).not.toHaveBeenCalled()
    expect(mockSavePendingAccount).not.toHaveBeenCalled()
    expect(mockSaveCheckpoint).toHaveBeenCalledWith(
      MigrationCheckpoint.TermsAndConditions,
      { provisionedAccountId: "sc-pending-1" },
    )
  })

  it("provisions fresh when the pending wallet no longer exists on the device", async () => {
    mockPendingForActiveAccount = "sc-gone-1"
    mockRegistryAccounts = []

    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = null
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBe("sc-account-1")
    expect(mockProvision).toHaveBeenCalledTimes(1)
    expect(mockSavePendingAccount).toHaveBeenCalledWith("sc-account-1")
  })

  describe("with a resume read in error", () => {
    /** The pending record read null because it could not be read, not because there is
     *  none: provisioning on that null hands a second wallet to a user who holds one. */
    it("refuses to provision when the pending-wallet read failed", async () => {
      mockPendingReadError = true
      mockPendingReadFailure = StorageFailure.Unknown
      const { result } = renderHook(() => useMigrationAccount())

      let ensured: string | null = "unset"
      await act(async () => {
        ensured = await result.current.ensureAccount()
      })

      expect(ensured).toBeNull()
      expect(mockProvision).not.toHaveBeenCalled()
      expect(mockSaveCheckpoint).not.toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: mockUnreadableCopy }),
      )
    })

    /** A pending wallet read from the same store that just failed is no firmer an answer
     *  than the null was, so it is not reused either. */
    it("refuses even a reusable pending wallet when the checkpoint read failed", async () => {
      mockCheckpointReadError = true
      mockCheckpointReadFailure = StorageFailure.Unknown
      mockPendingForActiveAccount = "sc-pending-1"
      mockRegistryAccounts = [{ id: "sc-pending-1" }]
      const { result } = renderHook(() => useMigrationAccount())

      let ensured: string | null = "unset"
      await act(async () => {
        ensured = await result.current.ensureAccount()
      })

      expect(ensured).toBeNull()
      expect(mockProvision).not.toHaveBeenCalled()
      expect(mockSaveCheckpoint).not.toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: mockUnreadableCopy }),
      )
    })

    it("names a full device when the checkpoint read alone hit one", async () => {
      mockCheckpointReadError = true
      mockCheckpointReadFailure = StorageFailure.OutOfSpace
      const { result } = renderHook(() => useMigrationAccount())

      await act(async () => {
        await result.current.ensureAccount()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: mockReadOutOfSpaceCopy }),
      )
    })

    it("names a full device when either read hit one", async () => {
      mockCheckpointReadError = true
      mockCheckpointReadFailure = StorageFailure.Unknown
      mockPendingReadError = true
      mockPendingReadFailure = StorageFailure.OutOfSpace
      const { result } = renderHook(() => useMigrationAccount())

      await act(async () => {
        await result.current.ensureAccount()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: mockReadOutOfSpaceCopy }),
      )
    })

    /** The reads only reload on focus, so without this the next tap would replay the same
     *  stale error for as long as the user stays on the screen. */
    it("re-reads both sources so the next tap can go through", async () => {
      mockPendingReadError = true
      const { result } = renderHook(() => useMigrationAccount())

      await act(async () => {
        await result.current.ensureAccount()
      })

      expect(mockRefetchCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockRefetchPending).toHaveBeenCalledTimes(1)
    })

    /** An id the checkpoint did return was read fine, and is the account to continue
     *  with whatever the pending record's read said. */
    it("still returns an account the checkpoint already holds", async () => {
      mockAccountId = "sc-account-1"
      mockPendingReadError = true
      const { result } = renderHook(() => useMigrationAccount())

      let ensured: string | null = null
      await act(async () => {
        ensured = await result.current.ensureAccount()
      })

      expect(ensured).toBe("sc-account-1")
      expect(mockToastShow).not.toHaveBeenCalled()
    })
  })
})
