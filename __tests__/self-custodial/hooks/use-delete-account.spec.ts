import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act, waitFor } from "@testing-library/react-native"

import { AccountStatus, AccountType, DefaultAccountId } from "@app/types/wallet"

import { useDeleteAccount } from "@app/self-custodial/hooks/use-delete-account"

const TEST_SC_ACCOUNT_ID = "test-self-custodial-uuid"

const mockDisconnectSdk = jest.fn()
const mockDeleteMnemonicForAccount = jest.fn()
const mockUnlink = jest.fn()
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
}))

const mockStorageDirFor = jest.fn((id: string, _network: unknown) => `/tmp/${id}`)
jest.mock("@app/self-custodial/config", () => ({
  storageDirFor: (id: string, network: unknown) => mockStorageDirFor(id, network),
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

jest.mock("react-native-fs", () => ({
  unlink: (...args: unknown[]) => mockUnlink(...args),
}))

const mockSdk = { id: "sdk" }

const activeSelfCustodialAccount = {
  id: TEST_SC_ACCOUNT_ID,
  type: AccountType.SelfCustodial,
  label: "Spark",
  selected: true,
  status: AccountStatus.RequiresRestore,
}

describe("useDeleteAccount", () => {
  beforeEach(() => {
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
    mockUnlink.mockResolvedValue(undefined)
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
  })

  it("starts in idle state with no error", () => {
    const { result } = renderHook(() => useDeleteAccount())

    expect(result.current.state).toBe("idle")
    expect(result.current.error).toBeNull()
  })

  it("disconnects SDK, wipes mnemonic, and returns 'logged-out' when no fallback account exists", async () => {
    const { result } = renderHook(() => useDeleteAccount())

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
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
    expect(outcome).toBe("logged-out")
    expect(result.current.state).toBe("idle")
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

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    // The delete completed while the in-flight refresh was still running:
    // only the initial both-networks sweep has happened so far.
    expect(outcome).toBe("logged-out")
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
  })

  it("switches to the custodial account and returns 'switched-to-custodial' when a custodial account exists", async () => {
    mockUseHasCustodialAccount.mockReturnValue(true)
    const { result } = renderHook(() => useDeleteAccount())

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith(DefaultAccountId.Custodial)
    expect(outcome).toBe("switched-to-custodial")
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

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("other-self-custodial-id")
    expect(outcome).toBe("switched-to-self-custodial")
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

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.deleteWallet("other-id")
    })

    expect(mockDisconnectSdk).not.toHaveBeenCalled()
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith("other-id")
    expect(outcome).toBe("remained")
  })

  it("skips disconnect when sdk is null but still wipes the mnemonic and returns an outcome", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    const { result } = renderHook(() => useDeleteAccount())

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockDisconnectSdk).not.toHaveBeenCalled()
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    expect(outcome).toBe("logged-out")
  })

  it("does not abort the flow when disconnectSdk rejects (logs and continues)", async () => {
    mockDisconnectSdk.mockRejectedValue(new Error("disconnect failed"))
    const { result } = renderHook(() => useDeleteAccount())

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockCrashlyticsLog).toHaveBeenCalled()
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalled()
    expect(outcome).toBe("logged-out")
    expect(result.current.state).toBe("idle")
  })

  it("does not fail the delete when recovery-bundle cleanup rejects (best-effort, logged)", async () => {
    mockDeleteRecoveryBundleFile.mockRejectedValue(new Error("bundle unlink failed"))
    const { result } = renderHook(() => useDeleteAccount())

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockCrashlyticsLog).toHaveBeenCalledWith(
      expect.stringContaining("recovery bundle cleanup failed"),
    )
    expect(outcome).toBe("logged-out")
    expect(result.current.state).toBe("idle")
    expect(result.current.error).toBeNull()
    expect(mockRemoveSelfCustodialAccountId).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
  })

  it("captures the error and returns undefined when deleteMnemonicForAccount fails", async () => {
    mockDeleteMnemonicForAccount.mockRejectedValue(new Error("storage error"))
    const { result } = renderHook(() => useDeleteAccount())

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    await waitFor(() => expect(result.current.state).toBe("error"))
    expect(result.current.error?.message).toBe("storage error")
    expect(mockReportError).toHaveBeenCalled()
    expect(outcome).toBeUndefined()
  })

  it("wraps a non-Error rejection before reporting it", async () => {
    mockRemoveSelfCustodialAccountId.mockRejectedValue("index unavailable")
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(result.current.error?.message).toBe("index unavailable")
  })

  it("logs the best-effort cleanup steps that fail and still completes the delete", async () => {
    mockUnlink.mockRejectedValue(new Error("dir busy"))
    mockWaitForRefreshesToSettle.mockRejectedValue(new Error("registry gone"))
    const { result } = renderHook(() => useDeleteAccount())

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(outcome).toBe("logged-out")
    for (const failure of [
      "storage dir unlink failed",
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
    expect(result.current.state).toBe("error")
  })

  it("drops the deletion mark and schedules no re-sweep when the index write fails", async () => {
    mockRemoveSelfCustodialAccountId.mockRejectedValue(new Error("index write failed"))
    const { result } = renderHook(() => useDeleteAccount())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(result.current.state).toBe("error")
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

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBeUndefined()
      expect(result.current.state).toBe("error")
      expect(result.current.error?.message).toBe(
        "The wallet's seed survived its deletion",
      )
      expect(mockRemoveSelfCustodialAccountId).not.toHaveBeenCalled()
      expect(mockClearAppLock).not.toHaveBeenCalled()
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
      expect(removeOrder).toBeLessThan(mockUnlink.mock.invocationCallOrder[0])
      expect(removeOrder).toBeLessThan(
        mockRemoveBackupStateFor.mock.invocationCallOrder[0],
      )
    })

    it("does not fail the delete when the backup record will not go (best-effort, logged)", async () => {
      mockRemoveBackupStateFor.mockRejectedValue(new Error("AsyncStorage down"))
      const { result } = renderHook(() => useDeleteAccount())

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("logged-out")
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

      let firstOutcome: string | undefined
      await act(async () => {
        firstOutcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })
      expect(firstOutcome).toBeUndefined()
      expect(mockClearAppLock).not.toHaveBeenCalled()

      let retryOutcome: string | undefined
      await act(async () => {
        retryOutcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(retryOutcome).toBe("logged-out")
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

  /**
   * The one deletion that ends like a logout. Every launch now opens at the gate, so a lock
   * left behind by the last wallet's deletion would ask on each one before landing on the
   * screen it was always going to land on: a lock with nothing behind it only locks its
   * owner out.
   */
  describe("the app lock, when the deleted wallet was the last thing on the device", () => {
    it("drops the lock once nothing is left for it to guard", async () => {
      const { result } = renderHook(() => useDeleteAccount())

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("logged-out")
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
     * The iOS legacy module reports every failed read as a missing key, so a token still in
     * the keychain can read as absent. The deletion never asks: only the erase decides, and
     * one that failed keeps the lock whatever a read would have said.
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

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("logged-out-locked")
      expect(result.current.state).toBe("idle")
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

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("logged-out-locked")
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

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("switched-to-custodial")
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
