import { it } from "@jest/globals"
import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act } from "@testing-library/react-native"

import { AccountStatus, AccountType, DefaultAccountId } from "@app/types/wallet"

import {
  SDK_TEARDOWN_TIMEOUT_MS,
  type DeleteAccountResult,
  useDeleteAccount,
} from "@app/self-custodial/hooks/use-delete-account"

const TEST_SC_ACCOUNT_ID = "test-self-custodial-uuid"

const mockDisconnectSdk = jest.fn()
const mockDeleteMnemonicForAccount = jest.fn()
const mockRetireSdkStorage = jest.fn()
const mockReadmitSdkStorage = jest.fn()
const mockMarkStorageForRemoval = jest.fn()
const mockRemoveMarkedStorage = jest.fn()
const mockUnmarkStorageForRemoval = jest.fn()
const mockRemoveSelfCustodialAccountId = jest.fn()
const mockReadStoredWalletPresence = jest.fn()
const mockClearAppLock = jest.fn()
const mockReadSessionProfiles = jest.fn()
const mockReadActiveToken = jest.fn()
const mockRemoveBackupStateFor = jest.fn()
const mockDeleteRecoveryBundleFile = jest.fn()
const mockRemoveRecoveryBundleState = jest.fn()
const mockMarkAccountDeletedForRefresh = jest.fn()
const mockUnmarkAccountDeletedForRefresh = jest.fn()
const mockWaitForRefreshesToSettle = jest.fn()
const mockReloadSelfCustodialAccounts = jest.fn()
const mockSetActiveAccountId = jest.fn()
const mockUpdateState = jest.fn()
const mockClearToken = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()
const mockUseHasCustodialAccount = jest.fn()
const mockUseAccountRegistry = jest.fn()
const mockCrashlyticsLog = jest.fn()
const mockReportError = jest.fn()
const mockResetSdkLogs = jest.fn()
const mockWaitForSdkIdle = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: mockCrashlyticsLog,
  recordError: jest.fn(),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

let mockNetwork = mockSparkNetwork.Regtest
jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockNetwork,
}))

jest.mock("@app/self-custodial/bridge", () => ({
  disconnectSdk: (...args: unknown[]) => mockDisconnectSdk(...args),
  waitForSdkIdle: (...args: unknown[]) => mockWaitForSdkIdle(...args),
  retireSdkStorage: (...args: unknown[]) => mockRetireSdkStorage(...args),
  readmitSdkStorage: (...args: unknown[]) => mockReadmitSdkStorage(...args),
}))

const mockStorageDirFor = jest.fn((id: string, _network: unknown) => `/tmp/${id}`)
jest.mock("@app/self-custodial/config", () => ({
  storageDirFor: (id: string, network: unknown) => mockStorageDirFor(id, network),
}))

jest.mock("@app/self-custodial/diagnostics/sdk-log-files", () => ({
  resetSdkLogs: (...args: unknown[]) => mockResetSdkLogs(...args),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  removeBackupStateFor: (...args: unknown[]) => mockRemoveBackupStateFor(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/storage", () => ({
  deleteRecoveryBundleFile: (...args: unknown[]) => mockDeleteRecoveryBundleFile(...args),
  removeRecoveryBundleState: (...args: unknown[]) =>
    mockRemoveRecoveryBundleState(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/refresh", () => ({
  markAccountDeletedForRefresh: (...args: unknown[]) =>
    mockMarkAccountDeletedForRefresh(...args),
  unmarkAccountDeletedForRefresh: (...args: unknown[]) =>
    mockUnmarkAccountDeletedForRefresh(...args),
  waitForRefreshesToSettle: (...args: unknown[]) => mockWaitForRefreshesToSettle(...args),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  StoredWalletPresence: { Present: "present", Absent: "absent", Unknown: "unknown" },
  readStoredWalletPresence: () => mockReadStoredWalletPresence(),
  removeSelfCustodialAccountId: (...args: unknown[]) =>
    mockRemoveSelfCustodialAccountId(...args),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    updateState: mockUpdateState,
    clearToken: () => mockClearToken(),
  }),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => mockUseHasCustodialAccount(),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    deleteMnemonicForAccount: (...args: unknown[]) =>
      mockDeleteMnemonicForAccount(...args),
    clearAppLock: () => mockClearAppLock(),
    readSessionProfiles: () => mockReadSessionProfiles(),
    readActiveToken: () => mockReadActiveToken(),
  },
}))

jest.mock("@app/self-custodial/storage/storage-removal", () => ({
  markStorageForRemoval: (...args: unknown[]) => mockMarkStorageForRemoval(...args),
  removeMarkedStorage: (...args: unknown[]) => mockRemoveMarkedStorage(...args),
  unmarkStorageForRemoval: (...args: unknown[]) => mockUnmarkStorageForRemoval(...args),
}))

const mockSdk = { id: "sdk" }

const activeSelfCustodialAccount = {
  id: TEST_SC_ACCOUNT_ID,
  type: AccountType.SelfCustodial,
  label: "Spark",
  selected: true,
  status: AccountStatus.RequiresRestore,
}

const resetDeleteAccountMocks = () => {
  jest.clearAllMocks()
  mockNetwork = mockSparkNetwork.Regtest
  mockUseSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })
  mockUseHasCustodialAccount.mockReturnValue(false)
  mockUseAccountRegistry.mockReturnValue({
    accounts: [activeSelfCustodialAccount],
    activeAccount: activeSelfCustodialAccount,
    setActiveAccountId: mockSetActiveAccountId,
    reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
  })
  mockDisconnectSdk.mockResolvedValue(undefined)
  mockDeleteMnemonicForAccount.mockResolvedValue(true)
  mockMarkStorageForRemoval.mockResolvedValue(undefined)
  mockRemoveMarkedStorage.mockReset().mockResolvedValue(undefined)
  mockUnmarkStorageForRemoval.mockResolvedValue(undefined)
  mockRemoveSelfCustodialAccountId.mockResolvedValue(undefined)
  mockReadStoredWalletPresence.mockResolvedValue("absent")
  mockClearAppLock.mockResolvedValue(true)
  mockReadSessionProfiles.mockResolvedValue({ status: "absent" })
  mockReadActiveToken.mockResolvedValue({ status: "absent" })
  mockClearToken.mockResolvedValue(true)
  mockRemoveBackupStateFor.mockResolvedValue(undefined)
  mockDeleteRecoveryBundleFile.mockResolvedValue(undefined)
  mockRemoveRecoveryBundleState.mockResolvedValue(undefined)
  mockWaitForRefreshesToSettle.mockResolvedValue(undefined)
  mockReloadSelfCustodialAccounts.mockResolvedValue(undefined)
  mockResetSdkLogs.mockResolvedValue(undefined)
  // clearAllMocks leaves queued *Once values behind; a failed test must not leak them
  mockWaitForSdkIdle.mockReset().mockResolvedValue(true)
}

describe("useDeleteAccount", () => {
  beforeEach(resetDeleteAccountMocks)

  it("disconnects SDK, wipes mnemonic, and returns 'logged-out' when no fallback account exists", async () => {
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    expect(mockRemoveSelfCustodialAccountId).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    expect(mockRemoveBackupStateFor).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    // Both networks are swept: the account may have been used on the other
    // network under a different galoy instance.
    for (const bundleNetwork of [mockSparkNetwork.Mainnet, mockSparkNetwork.Regtest]) {
      expect(mockDeleteRecoveryBundleFile).toHaveBeenCalledWith(
        TEST_SC_ACCOUNT_ID,
        bundleNetwork,
      )
      expect(mockRemoveRecoveryBundleState).toHaveBeenCalledWith(
        TEST_SC_ACCOUNT_ID,
        bundleNetwork,
      )
    }
    expect(mockUpdateState).toHaveBeenCalled()
    expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
  })

  it("marks the account deleted for in-flight refreshes before sweeping the bundle files", async () => {
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockMarkAccountDeletedForRefresh).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    // Marked before the sweep: a refresh persisting between the sweep and the
    // marker would recreate the files it just removed.
    const markOrder = mockMarkAccountDeletedForRefresh.mock.invocationCallOrder[0]
    const sweepOrder = mockDeleteRecoveryBundleFile.mock.invocationCallOrder[0]
    expect(markOrder).toBeLessThan(sweepOrder)
  })

  it("re-sweeps the bundle files after in-flight refreshes settle, without blocking the delete", async () => {
    let settle: () => void = () => {}
    mockWaitForRefreshesToSettle.mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve
      }),
    )
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    // The delete completed while the in-flight refresh was still running:
    // only the initial both-networks sweep has happened so far.
    expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
    expect(mockDeleteRecoveryBundleFile).toHaveBeenCalledTimes(2)

    await act(async () => {
      settle()
      // Macrotask flush: the re-sweep awaits a promise chain per network.
      await new Promise<void>((resolve) => {
        setImmediate(resolve)
      })
    })

    // A refresh that slipped past the marker check may have re-written the
    // files after the first sweep; the post-settle re-sweep removes them.
    expect(mockDeleteRecoveryBundleFile).toHaveBeenCalledTimes(4)
    for (const bundleNetwork of [mockSparkNetwork.Mainnet, mockSparkNetwork.Regtest]) {
      expect(mockRemoveRecoveryBundleState).toHaveBeenCalledWith(
        TEST_SC_ACCOUNT_ID,
        bundleNetwork,
      )
    }
    // The deletion mark is dropped only after the re-sweep, keeping the
    // module-level set bounded without reopening the persist window.
    expect(mockUnmarkAccountDeletedForRefresh).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    const resweepOrder = mockDeleteRecoveryBundleFile.mock.invocationCallOrder[3]
    const unmarkOrder = mockUnmarkAccountDeletedForRefresh.mock.invocationCallOrder[0]
    expect(unmarkOrder).toBeGreaterThan(resweepOrder)
  })

  it("wipes the active network's storage directory, not a hardcoded one, when deleting on mainnet", async () => {
    mockNetwork = mockSparkNetwork.Mainnet
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockStorageDirFor).toHaveBeenCalledWith(
      TEST_SC_ACCOUNT_ID,
      mockSparkNetwork.Mainnet,
    )
    expect(mockRemoveMarkedStorage).toHaveBeenCalledWith(`/tmp/${TEST_SC_ACCOUNT_ID}`)
  })

  it("switches to the custodial account and returns 'switched-to-custodial' when a custodial account exists", async () => {
    mockUseHasCustodialAccount.mockReturnValue(true)
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith(DefaultAccountId.Custodial)
    expect(deletion).toEqual({ removed: true, outcome: "switched-to-custodial" })
  })

  it("switches to a remaining self-custodial account and returns 'switched-to-self-custodial'", async () => {
    const remaining = {
      ...activeSelfCustodialAccount,
      id: "other-self-custodial-id",
      selected: false,
    }
    mockUseAccountRegistry.mockReturnValue({
      accounts: [activeSelfCustodialAccount, remaining],
      activeAccount: activeSelfCustodialAccount,
      setActiveAccountId: mockSetActiveAccountId,
      reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
    })

    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("other-self-custodial-id")
    expect(deletion).toEqual({ removed: true, outcome: "switched-to-self-custodial" })
  })

  it("returns 'remained' when deleting a non-active self-custodial account", async () => {
    const otherAccount = {
      ...activeSelfCustodialAccount,
      id: "other-id",
    }
    mockUseAccountRegistry.mockReturnValue({
      accounts: [activeSelfCustodialAccount, otherAccount],
      activeAccount: activeSelfCustodialAccount,
      setActiveAccountId: mockSetActiveAccountId,
      reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
    })

    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet("other-id")
    })

    expect(mockDisconnectSdk).not.toHaveBeenCalled()
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith("other-id")
    expect(deletion).toEqual({ removed: true, outcome: "remained" })
  })

  it("skips disconnect when sdk is null but still wipes the mnemonic and returns an outcome", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockDisconnectSdk).not.toHaveBeenCalled()
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
  })

  it("does not abort the flow when disconnectSdk rejects (logs and continues)", async () => {
    mockDisconnectSdk.mockRejectedValue(new Error("disconnect failed"))
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockCrashlyticsLog).toHaveBeenCalled()
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalled()
    expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
  })

  /** iOS puts the path in an unlink error, and the path names the account. */
  it.each([
    [
      "disconnect",
      () =>
        mockDisconnectSdk.mockRejectedValue(
          new Error(`disconnect failed for ${TEST_SC_ACCOUNT_ID}`),
        ),
    ],
    [
      "storage cleanup",
      () =>
        mockRemoveMarkedStorage.mockRejectedValue(
          new Error(
            `ENOENT: no such file or directory, unlink '/tmp/${TEST_SC_ACCOUNT_ID}'`,
          ),
        ),
    ],
    [
      "recovery bundle cleanup",
      () =>
        mockDeleteRecoveryBundleFile.mockRejectedValue(
          new Error(`unlink failed: '/files/recovery/${TEST_SC_ACCOUNT_ID}.bundle'`),
        ),
    ],
  ])("leaves the account out of the breadcrumb when %s fails", async (_label, fail) => {
    fail()
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockCrashlyticsLog).toHaveBeenCalledWith(
      expect.stringContaining("[self-custodial delete]"),
    )
    expect(mockCrashlyticsLog).not.toHaveBeenCalledWith(
      expect.stringContaining(TEST_SC_ACCOUNT_ID),
    )
  })

  it("does not fail the delete when recovery-bundle cleanup rejects (best-effort, logged)", async () => {
    mockDeleteRecoveryBundleFile.mockRejectedValue(new Error("bundle unlink failed"))
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockCrashlyticsLog).toHaveBeenCalledWith(
      expect.stringContaining("recovery bundle cleanup failed"),
    )
    expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
    expect(mockRemoveSelfCustodialAccountId).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
  })

  it("reports the error and a failed removal when deleteMnemonicForAccount fails", async () => {
    mockDeleteMnemonicForAccount.mockRejectedValue(new Error("storage error"))
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockReportError).toHaveBeenCalledWith(
      "Self-custodial wallet delete",
      expect.objectContaining({ message: "storage error" }),
    )
    expect(deletion).toEqual({ removed: false, outcome: "logged-out-locked" })
  })

  /** The switch lands before the step that fails, so the caller has to be told about it
   *  to follow it rather than stay on a screen that already describes the next account. */
  it("still reports the switch it made when a later step fails", async () => {
    const remaining = {
      ...activeSelfCustodialAccount,
      id: "other-self-custodial-id",
      selected: false,
    }
    mockUseAccountRegistry.mockReturnValue({
      accounts: [activeSelfCustodialAccount, remaining],
      activeAccount: activeSelfCustodialAccount,
      setActiveAccountId: mockSetActiveAccountId,
      reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
    })
    mockRemoveSelfCustodialAccountId.mockRejectedValue(new Error("index write failed"))
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("other-self-custodial-id")
    expect(deletion).toEqual({ removed: false, outcome: "switched-to-self-custodial" })
  })

  it("reports that nothing switched when removing an inactive account fails", async () => {
    const otherAccount = { ...activeSelfCustodialAccount, id: "other-id" }
    mockUseAccountRegistry.mockReturnValue({
      accounts: [activeSelfCustodialAccount, otherAccount],
      activeAccount: activeSelfCustodialAccount,
      setActiveAccountId: mockSetActiveAccountId,
      reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
    })
    mockDeleteMnemonicForAccount.mockRejectedValue(new Error("storage error"))
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet("other-id")
    })

    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
    expect(deletion).toEqual({ removed: false, outcome: "remained" })
  })

  it("wraps a non-Error rejection before reporting it", async () => {
    mockRemoveSelfCustodialAccountId.mockRejectedValue("index unavailable")
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockReportError).toHaveBeenCalledWith(
      "Self-custodial wallet delete",
      expect.objectContaining({ message: "index unavailable" }),
    )
  })

  it("logs the best-effort cleanup steps that fail and still completes the delete", async () => {
    mockRemoveMarkedStorage.mockRejectedValue(new Error("dir busy"))
    mockWaitForRefreshesToSettle.mockRejectedValue(new Error("registry gone"))
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
    for (const failure of [
      "storage removal failed",
      "post-refresh bundle re-sweep failed",
    ]) {
      expect(mockCrashlyticsLog).toHaveBeenCalledWith(expect.stringContaining(failure))
    }
    // A failed re-sweep still drops the deletion mark.
    expect(mockUnmarkAccountDeletedForRefresh).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
  })

  it("drops the deletion mark when the delete fails before its re-sweep is scheduled", async () => {
    mockStorageDirFor.mockImplementationOnce(() => {
      throw new Error("no storage dir for this network")
    })
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockUnmarkAccountDeletedForRefresh).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    const markOrder = mockMarkAccountDeletedForRefresh.mock.invocationCallOrder[0]
    const unmarkOrder = mockUnmarkAccountDeletedForRefresh.mock.invocationCallOrder[0]
    expect(unmarkOrder).toBeGreaterThan(markOrder)
    expect(mockDeleteRecoveryBundleFile).not.toHaveBeenCalled()
    expect(mockWaitForRefreshesToSettle).not.toHaveBeenCalled()
    expect(mockReportError).toHaveBeenCalledWith(
      "Self-custodial wallet delete",
      expect.objectContaining({ message: "no storage dir for this network" }),
    )
  })

  it("drops the deletion mark and schedules no re-sweep when the index write fails", async () => {
    mockRemoveSelfCustodialAccountId.mockRejectedValue(new Error("index write failed"))
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockReportError).toHaveBeenCalledWith(
      "Self-custodial wallet delete",
      expect.objectContaining({ message: "index write failed" }),
    )
    expect(mockUnmarkAccountDeletedForRefresh).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    expect(mockWaitForRefreshesToSettle).not.toHaveBeenCalled()
  })

  describe("a wallet leaves the index only with its seed", () => {
    /** Unlisted while its seed survived, the wallet would be invisible to every later
     *  removal, and the forgotten-PIN one would read the empty index as nothing left to
     *  lock. So the deletion fails, the wallet stays listed, and the lock stays with it. */
    it("keeps a wallet whose seed survived listed and reports the delete as failed", async () => {
      mockDeleteMnemonicForAccount.mockResolvedValue(false)
      const { result } = renderHook(() => useDeleteAccount())

      let deletion: DeleteAccountResult | undefined
      await act(async () => {
        deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(deletion).toEqual({ removed: false, outcome: "logged-out-locked" })
      expect(mockReportError).toHaveBeenCalledWith(
        "Self-custodial wallet delete",
        expect.objectContaining({ message: "The wallet's seed survived its deletion" }),
      )
      expect(mockRemoveSelfCustodialAccountId).not.toHaveBeenCalled()
      expect(mockClearAppLock).not.toHaveBeenCalled()
    })

    it("keeps the storage of a wallet whose seed survived, and lets its SDK connect again", async () => {
      mockDeleteMnemonicForAccount.mockResolvedValue(false)
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockRemoveMarkedStorage).not.toHaveBeenCalled()
      expect(mockReadmitSdkStorage).toHaveBeenCalledWith(`/tmp/${TEST_SC_ACCOUNT_ID}`)
      expect(mockUnmarkStorageForRemoval).toHaveBeenCalledWith(
        `/tmp/${TEST_SC_ACCOUNT_ID}`,
      )
    })

    /** Anything after the seed is cleanup a failure leaves behind, and none of it may keep
     *  listed a wallet whose seed is already gone. */
    it("drops the entry right after the seed, before the cleanup that can fail", async () => {
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      const removeOrder = mockRemoveSelfCustodialAccountId.mock.invocationCallOrder[0]
      expect(removeOrder).toBeGreaterThan(
        mockDeleteMnemonicForAccount.mock.invocationCallOrder[0],
      )
      expect(removeOrder).toBeLessThan(
        mockRemoveMarkedStorage.mock.invocationCallOrder[0],
      )
      expect(removeOrder).toBeLessThan(
        mockRemoveBackupStateFor.mock.invocationCallOrder[0],
      )
    })

    it("does not fail the delete when the backup record will not go (best-effort, logged)", async () => {
      mockRemoveBackupStateFor.mockRejectedValue(new Error("AsyncStorage down"))
      const { result } = renderHook(() => useDeleteAccount())

      let deletion: DeleteAccountResult | undefined
      await act(async () => {
        deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
      expect(mockCrashlyticsLog).toHaveBeenCalledWith(
        expect.stringContaining("backup state cleanup failed"),
      )
    })

    /**
     * The seed answers whether it is gone, not whether this call removed it, so a delete
     * cut short after the seed went is finished by the next one rather than leaving a
     * wallet listed that no retry could ever drop.
     */
    it("finishes on a retry when the first run stopped after the seed went", async () => {
      mockRemoveSelfCustodialAccountId.mockRejectedValueOnce(
        new Error("index write failed"),
      )
      const { result } = renderHook(() => useDeleteAccount())

      let firstDeletion: DeleteAccountResult | undefined
      await act(async () => {
        firstDeletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })
      expect(firstDeletion).toEqual({ removed: false, outcome: "logged-out-locked" })
      expect(mockClearAppLock).not.toHaveBeenCalled()

      let retryDeletion: DeleteAccountResult | undefined
      await act(async () => {
        retryDeletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(retryDeletion).toEqual({ removed: true, outcome: "logged-out" })
      expect(mockRemoveSelfCustodialAccountId).toHaveBeenCalledTimes(2)
      expect(mockClearAppLock).toHaveBeenCalledTimes(1)
    })
  })

  it("switches the active account BEFORE disconnecting the SDK so useSdkLifecycle does not poll a stale ref", async () => {
    const remaining = {
      ...activeSelfCustodialAccount,
      id: "other-self-custodial-id",
      selected: false,
    }
    mockUseAccountRegistry.mockReturnValue({
      accounts: [activeSelfCustodialAccount, remaining],
      activeAccount: activeSelfCustodialAccount,
      setActiveAccountId: mockSetActiveAccountId,
      reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
    })

    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("other-self-custodial-id")
    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)

    const setActiveOrder = mockSetActiveAccountId.mock.invocationCallOrder[0]
    const disconnectOrder = mockDisconnectSdk.mock.invocationCallOrder[0]
    const deleteOrder = mockDeleteMnemonicForAccount.mock.invocationCallOrder[0]

    expect(setActiveOrder).toBeLessThan(disconnectOrder)
    expect(disconnectOrder).toBeLessThan(deleteOrder)
  })

  it("clears activeAccountId BEFORE disconnecting when no fallback exists (logged-out path)", async () => {
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockUpdateState).toHaveBeenCalled()
    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)

    const updateOrder = mockUpdateState.mock.invocationCallOrder[0]
    const disconnectOrder = mockDisconnectSdk.mock.invocationCallOrder[0]

    expect(updateOrder).toBeLessThan(disconnectOrder)

    // The updater passed to updateState must clear ONLY activeAccountId and
    // carry every other persistent-state field through untouched.
    const updater = mockUpdateState.mock.calls[0][0]
    const previousState = {
      schemaVersion: 7,
      activeAccountId: TEST_SC_ACCOUNT_ID,
      galoyInstance: { id: "Main" },
      isAnalyticsEnabled: true,
    }
    expect(updater(previousState)).toEqual({
      schemaVersion: 7,
      activeAccountId: undefined,
      galoyInstance: { id: "Main" },
      isAnalyticsEnabled: true,
    })
    // Undefined persistent state passes through unchanged (no crash, no write).
    expect(updater(undefined)).toBeUndefined()
  })

  it("switches to the custodial account BEFORE disconnecting (custodial-fallback path)", async () => {
    mockUseHasCustodialAccount.mockReturnValue(true)
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith(DefaultAccountId.Custodial)
    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)

    const setActiveOrder = mockSetActiveAccountId.mock.invocationCallOrder[0]
    const disconnectOrder = mockDisconnectSdk.mock.invocationCallOrder[0]

    expect(setActiveOrder).toBeLessThan(disconnectOrder)
  })
})

/**
 * The one deletion that ends like a logout. Every launch now opens at the gate, so a lock
 * left behind by the last wallet's deletion would ask on each one before landing on the
 * screen it was always going to land on: a lock with nothing behind it only locks its
 * owner out.
 */
describe("the app lock, when the deleted wallet was the last thing on the device", () => {
  beforeEach(resetDeleteAccountMocks)

  describe("what the deletion does with the lock", () => {
    it("drops the lock once nothing is left for it to guard", async () => {
      const { result } = renderHook(() => useDeleteAccount())

      let deletion: DeleteAccountResult | undefined
      await act(async () => {
        deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
      expect(mockClearAppLock).toHaveBeenCalledTimes(1)
    })

    /** Asked after the wipe, so the answer is about what the device holds now. */
    it("asks what is stored only once the wallet is gone", async () => {
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockReadStoredWalletPresence.mock.invocationCallOrder[0]).toBeGreaterThan(
        mockRemoveSelfCustodialAccountId.mock.invocationCallOrder[0],
      )
    })

    /** The same evidence a logout goes by: a token an earlier erase missed is erased now,
     *  and the lock goes only once that erase says the token is gone. */
    it("erases the active token before deciding on the lock", async () => {
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearToken).toHaveBeenCalledTimes(1)
      expect(mockClearToken.mock.invocationCallOrder[0]).toBeLessThan(
        mockClearAppLock.mock.invocationCallOrder[0],
      )
    })

    it("keeps the lock when the active token will not erase", async () => {
      mockClearToken.mockResolvedValue(false)
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearAppLock).not.toHaveBeenCalled()
    })

    /**
     * The deletion never asks whether the token is there: only the erase decides, and one
     * that failed keeps the lock whatever a read would have said.
     */
    it("keeps the lock on a failed token erase even where a read would answer absent", async () => {
      mockReadActiveToken.mockResolvedValue({ status: "absent" })
      mockClearToken.mockResolvedValue(false)
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockReadActiveToken).not.toHaveBeenCalled()
      expect(mockClearAppLock).not.toHaveBeenCalled()
    })

    /**
     * A slot that would not erase leaves the lock half gone, which routes every later
     * unlock to the keypad instead of the prompt its owner chose. The deletion still
     * finished, so it is not turned into a failure; the lock goes on counting as set, and
     * the way out says so.
     */
    it("reports a lock that survived, and keeps it off the landing screen", async () => {
      mockClearAppLock.mockResolvedValue(false)
      const { result } = renderHook(() => useDeleteAccount())

      let deletion: DeleteAccountResult | undefined
      await act(async () => {
        deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(deletion).toEqual({ removed: true, outcome: "logged-out-locked" })
      expect(mockReportError).toHaveBeenCalledWith(
        "Self-custodial delete app lock clear",
        expect.any(Error),
      )
    })

    /** Every branch that keeps the lock ends the same way: still owed an answer, so not on
     *  the screen that opens a new account. */
    it("keeps a wallet whose lock was never dropped off the landing screen", async () => {
      mockClearToken.mockResolvedValue(false)
      const { result } = renderHook(() => useDeleteAccount())

      let deletion: DeleteAccountResult | undefined
      await act(async () => {
        deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(deletion).toEqual({ removed: true, outcome: "logged-out-locked" })
    })

    /**
     * The active token says nothing about the saved sessions kept beside it: a logout that
     * preserved stored credentials leaves it empty with live bearer tokens still in the
     * keychain, and the landing screen this deletion ends on offers them.
     */
    it("keeps the lock when saved sessions are still stored", async () => {
      mockReadSessionProfiles.mockResolvedValue({
        status: "found",
        profiles: [{ token: "live-token" }],
      })
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearAppLock).not.toHaveBeenCalled()
    })

    /** A profile list that cannot answer is not a list with no sessions. */
    it("keeps the lock when the saved sessions cannot be read", async () => {
      mockReadSessionProfiles.mockResolvedValue({
        status: "failed",
        err: new Error("keystore locked"),
      })
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearAppLock).not.toHaveBeenCalled()
    })

    it("drops the lock when the saved session list is readable and empty", async () => {
      mockReadSessionProfiles.mockResolvedValue({ status: "found", profiles: [] })
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearAppLock).toHaveBeenCalledTimes(1)
    })

    /** An index that cannot answer is not an index with no wallets: erasing on that guess
     *  would drop the lock over whatever it failed to name. */
    it("keeps the lock when the index cannot be read", async () => {
      mockReadStoredWalletPresence.mockResolvedValue("unknown")
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearAppLock).not.toHaveBeenCalled()
    })

    it("keeps the lock when another wallet is still stored", async () => {
      mockReadStoredWalletPresence.mockResolvedValue("present")
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearAppLock).not.toHaveBeenCalled()
    })

    /** The lock still guards the session that is left, so it stays whatever the index says. */
    it("keeps the lock when a custodial account remains", async () => {
      mockUseHasCustodialAccount.mockReturnValue(true)
      const { result } = renderHook(() => useDeleteAccount())

      let deletion: DeleteAccountResult | undefined
      await act(async () => {
        deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(deletion).toEqual({ removed: true, outcome: "switched-to-custodial" })
      expect(mockClearAppLock).not.toHaveBeenCalled()
      expect(mockReadStoredWalletPresence).not.toHaveBeenCalled()
    })

    it("keeps the lock when another self-custodial wallet takes over", async () => {
      const remaining = {
        ...activeSelfCustodialAccount,
        id: "other-self-custodial-id",
        selected: false,
      }
      mockUseAccountRegistry.mockReturnValue({
        accounts: [activeSelfCustodialAccount, remaining],
        activeAccount: activeSelfCustodialAccount,
        setActiveAccountId: mockSetActiveAccountId,
        reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
      })
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearAppLock).not.toHaveBeenCalled()
    })
  })
})

describe("useDeleteAccount: the SDK log and the wallet's storage", () => {
  beforeEach(resetDeleteAccountMocks)

  it("resets the SDK logs before the wallet's mnemonic is deleted", async () => {
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockResetSdkLogs).toHaveBeenCalledTimes(1)
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalledTimes(1)
    expect(mockResetSdkLogs.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteMnemonicForAccount.mock.invocationCallOrder[0],
    )
  })

  it("cuts the log only once the deleted wallet's SDK, even one still connecting, is gone", async () => {
    let finishTeardown: (idle: boolean) => void = () => {}
    mockWaitForSdkIdle.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishTeardown = resolve
      }),
    )
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    const { result } = renderHook(() => useDeleteAccount())

    let deleting: Promise<unknown> = Promise.resolve()
    await act(async () => {
      deleting = result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })
    expect(mockWaitForSdkIdle).toHaveBeenCalledWith(
      `/tmp/${TEST_SC_ACCOUNT_ID}`,
      SDK_TEARDOWN_TIMEOUT_MS,
    )
    expect(mockResetSdkLogs).not.toHaveBeenCalled()

    await act(async () => {
      finishTeardown(true)
      await deleting
    })

    expect(mockResetSdkLogs).toHaveBeenCalledWith({ readNothingThisSession: false })
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
  })

  it("waits for the SDK after disconnecting it, and before the reset", async () => {
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    const [disconnected] = mockDisconnectSdk.mock.invocationCallOrder
    const [waited] = mockWaitForSdkIdle.mock.invocationCallOrder
    const [reset] = mockResetSdkLogs.mock.invocationCallOrder
    expect(disconnected).toBeLessThan(waited)
    expect(waited).toBeLessThan(reset)
  })

  it("exports nothing more this session when the SDK doesn't go idle in time", async () => {
    mockWaitForSdkIdle.mockResolvedValue(false)
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockResetSdkLogs).toHaveBeenCalledWith({ readNothingThisSession: true })
    expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
  })

  it("refuses the wallet's SDK connects before waiting for it to go idle", async () => {
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockRetireSdkStorage).toHaveBeenCalledWith(`/tmp/${TEST_SC_ACCOUNT_ID}`)
    expect(mockRetireSdkStorage.mock.invocationCallOrder[0]).toBeLessThan(
      mockWaitForSdkIdle.mock.invocationCallOrder[0],
    )
    expect(mockReadmitSdkStorage).not.toHaveBeenCalled()
  })

  it("records the storage removal before the mnemonic goes, and removes it at once when idle", async () => {
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockMarkStorageForRemoval).toHaveBeenCalledWith(`/tmp/${TEST_SC_ACCOUNT_ID}`)
    expect(mockMarkStorageForRemoval.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteMnemonicForAccount.mock.invocationCallOrder[0],
    )
    expect(mockRemoveMarkedStorage).toHaveBeenCalledTimes(1)
    expect(mockWaitForSdkIdle).toHaveBeenCalledTimes(1)
  })

  it("retries the storage removal once a timed-out SDK goes idle", async () => {
    let idleAtLast: (idle: boolean) => void = () => {}
    mockWaitForSdkIdle.mockResolvedValueOnce(false).mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        idleAtLast = resolve
      }),
    )
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })
    expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
    expect(mockMarkStorageForRemoval).toHaveBeenCalledTimes(1)
    expect(mockWaitForSdkIdle).toHaveBeenLastCalledWith(`/tmp/${TEST_SC_ACCOUNT_ID}`)
    expect(mockRemoveMarkedStorage).not.toHaveBeenCalled()

    await act(async () => {
      idleAtLast(true)
    })

    expect(mockRemoveMarkedStorage).toHaveBeenCalledWith(`/tmp/${TEST_SC_ACCOUNT_ID}`)
  })

  it("retries once the SDK is idle when the first storage removal fails", async () => {
    mockRemoveMarkedStorage.mockRejectedValueOnce(new Error("busy"))
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockRemoveMarkedStorage).toHaveBeenCalledTimes(2)
  })

  it("keeps the wallet, readmitted and unmarked, when its storage removal can't be recorded", async () => {
    mockMarkStorageForRemoval.mockRejectedValue(new Error("disk full"))
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockMarkStorageForRemoval).toHaveBeenCalledTimes(1)
    expect(deletion?.removed).toBe(false)
    expect(mockDeleteMnemonicForAccount).not.toHaveBeenCalled()
    expect(mockReadmitSdkStorage).toHaveBeenCalledWith(`/tmp/${TEST_SC_ACCOUNT_ID}`)
    expect(mockUnmarkStorageForRemoval).toHaveBeenCalledWith(`/tmp/${TEST_SC_ACCOUNT_ID}`)
  })

  it("keeps a wallet's storage retired and marked once its seed is gone, even if a later step fails", async () => {
    mockRemoveSelfCustodialAccountId.mockRejectedValue(new Error("index write failed"))
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(deletion?.removed).toBe(false)
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalledTimes(1)
    expect(mockReadmitSdkStorage).not.toHaveBeenCalled()
    expect(mockUnmarkStorageForRemoval).not.toHaveBeenCalled()
  })

  it("keeps the wallet when its logs could be neither reset nor removed", async () => {
    mockResetSdkLogs.mockRejectedValue(new Error("SDK logs could be neither marked"))
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockResetSdkLogs).toHaveBeenCalledTimes(1)
    expect(deletion?.removed).toBe(false)
    expect(mockDeleteMnemonicForAccount).not.toHaveBeenCalled()
    expect(mockRemoveSelfCustodialAccountId).not.toHaveBeenCalled()
    expect(mockReadmitSdkStorage).toHaveBeenCalledWith(`/tmp/${TEST_SC_ACCOUNT_ID}`)
  })

  it("resets the SDK logs when only a custodial account is left", async () => {
    mockUseHasCustodialAccount.mockReturnValue(true)
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(deletion).toEqual({ removed: true, outcome: "switched-to-custodial" })
    expect(mockResetSdkLogs).toHaveBeenCalledTimes(1)
  })

  it("resets the SDK logs when another self-custodial wallet remains, since lines can't be told apart", async () => {
    const otherAccount = { ...activeSelfCustodialAccount, id: "other-id" }
    mockUseAccountRegistry.mockReturnValue({
      accounts: [activeSelfCustodialAccount, otherAccount],
      activeAccount: activeSelfCustodialAccount,
      setActiveAccountId: mockSetActiveAccountId,
      reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
    })
    const { result } = renderHook(() => useDeleteAccount())

    let deletion: DeleteAccountResult | undefined
    await act(async () => {
      deletion = await result.current.deleteWallet("other-id")
    })

    expect(deletion).toEqual({ removed: true, outcome: "remained" })
    expect(mockResetSdkLogs).toHaveBeenCalledTimes(1)
  })
})
