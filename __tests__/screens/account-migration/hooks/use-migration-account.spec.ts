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
let mockRegistryAccounts: { id: string }[] = []
const mockSavePendingAccount = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-pending-migration-accounts", () => ({
  usePendingMigrationAccounts: () => ({
    pendingForActiveAccount: mockPendingForActiveAccount,
    savePendingAccount: mockSavePendingAccount,
    loading: false,
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

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: { createFailed: () => mockCreateFailedCopy },
      AccountMigration: {
        storageUnavailable: { notSavedOutOfSpaceBody: () => mockOutOfSpaceCopy },
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

  it("stops the flow with the failure toast when the checkpoint write fails", async () => {
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
      expect.objectContaining({ message: mockCreateFailedCopy }),
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

  it("keeps the generic copy for any other pending-record write failure", async () => {
    mockSavePendingAccount.mockRejectedValue(
      new StorageWriteError(new Error("Database Error")),
    )
    const { result } = renderHook(() => useMigrationAccount())

    await act(async () => {
      await result.current.ensureAccount()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: mockCreateFailedCopy }),
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
})
