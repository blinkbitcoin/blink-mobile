import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act, waitFor } from "@testing-library/react-native"

import { AccountStatus, AccountType, DefaultAccountId } from "@app/types/wallet"

import { useDeleteAccount } from "@app/self-custodial/hooks/use-delete-account"

const TEST_SC_ACCOUNT_ID = "test-self-custodial-uuid"

const mockDisconnectSdk = jest.fn()
const mockDeleteMnemonicForAccount = jest.fn()
const mockUnlink = jest.fn()
const mockRemoveSelfCustodialAccountId = jest.fn()
const mockRemoveBackupStateFor = jest.fn()
const mockReloadSelfCustodialAccounts = jest.fn()
const mockSetActiveAccountId = jest.fn()
const mockUpdateState = jest.fn()
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
  ...jest.requireActual("@app/self-custodial/config"),
  storageDirFor: (id: string, network: unknown) => mockStorageDirFor(id, network),
}))

const mockReadPendingProvisionedAccounts = jest.fn()
jest.mock("@app/screens/account-migration/utils/migration-checkpoint-storage", () => ({
  ...jest.requireActual(
    "@app/screens/account-migration/utils/migration-checkpoint-storage",
  ),
  readPendingProvisionedAccounts: (...args: unknown[]) =>
    mockReadPendingProvisionedAccounts(...args),
}))

/** What the strict read answers with: a record, or the fact that it could not be read. */
const pendingRecord = (pendingByOwner: Record<string, string>) => ({
  status: "ok",
  pendingByOwner,
})

let mockInstanceId = "Staging"
jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { id: mockInstanceId, name: "Main" } },
  }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  removeBackupStateFor: (...args: unknown[]) => mockRemoveBackupStateFor(...args),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  /** The strict read's statuses travel with it; the module itself reaches native storage,
   *  so only what this hook uses is stood in for. */
  StorageReadStatus: { Ok: "ok", ReadFailed: "read-failed" },
  removeSelfCustodialAccountId: (...args: unknown[]) =>
    mockRemoveSelfCustodialAccountId(...args),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ updateState: mockUpdateState }),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => mockUseHasCustodialAccount(),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    deleteMnemonicForAccount: (...args: unknown[]) =>
      mockDeleteMnemonicForAccount(...args),
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
    mockDeleteMnemonicForAccount.mockResolvedValue(undefined)
    mockUnlink.mockResolvedValue(undefined)
    mockRemoveSelfCustodialAccountId.mockResolvedValue(undefined)
    mockRemoveBackupStateFor.mockResolvedValue(undefined)
    mockReloadSelfCustodialAccounts.mockResolvedValue(undefined)
    mockReadPendingProvisionedAccounts.mockResolvedValue(pendingRecord({}))
    mockInstanceId = "Staging"
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
    expect(mockUpdateState).toHaveBeenCalled()
    expect(outcome).toBe("logged-out")
    expect(result.current.state).toBe("idle")
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

  describe("migration destination guard", () => {
    beforeEach(() => {
      mockNetwork = mockSparkNetwork.Mainnet
      mockInstanceId = "Staging"
    })

    /**
     * The last line of defense: the delete controls consult the guard before offering
     * themselves, and this is the same question asked where the key is actually destroyed,
     * so a surface that forgets the guard still cannot take it.
     */
    it("destroys nothing and returns 'blocked' for a wallet a migration still owes funds", async () => {
      mockReadPendingProvisionedAccounts.mockResolvedValue(
        pendingRecord({ "custodial-1": TEST_SC_ACCOUNT_ID }),
      )
      const { result } = renderHook(() => useDeleteAccount())

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("blocked")
      expect(mockDeleteMnemonicForAccount).not.toHaveBeenCalled()
      expect(mockUnlink).not.toHaveBeenCalled()
      expect(mockRemoveSelfCustodialAccountId).not.toHaveBeenCalled()
      expect(mockRemoveBackupStateFor).not.toHaveBeenCalled()
      expect(mockDisconnectSdk).not.toHaveBeenCalled()
      expect(mockSetActiveAccountId).not.toHaveBeenCalled()
      /** No spinner either: nothing was ever started. */
      expect(result.current.state).toBe("idle")
    })

    it("reads the record fresh on every attempt rather than trusting render-time state", async () => {
      mockReadPendingProvisionedAccounts.mockResolvedValue(
        pendingRecord({ "custodial-1": TEST_SC_ACCOUNT_ID }),
      )
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      /** The migration finished between the two attempts, so the second one proceeds. */
      mockReadPendingProvisionedAccounts.mockResolvedValue(pendingRecord({}))

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("logged-out")
      expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
      expect(mockReadPendingProvisionedAccounts).toHaveBeenCalledTimes(2)
    })

    it("deletes another owner's wallet, which this migration never marked", async () => {
      mockReadPendingProvisionedAccounts.mockResolvedValue(
        pendingRecord({ "custodial-1": "some-other-pending-wallet" }),
      )
      const { result } = renderHook(() => useDeleteAccount())

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("logged-out")
      expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    })

    it("skips the check on the Local instance, where a half-finished migration must stay cleanable", async () => {
      mockInstanceId = "Local"
      mockReadPendingProvisionedAccounts.mockResolvedValue(
        pendingRecord({ "custodial-1": TEST_SC_ACCOUNT_ID }),
      )
      const { result } = renderHook(() => useDeleteAccount())

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("logged-out")
      expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
      expect(mockReadPendingProvisionedAccounts).not.toHaveBeenCalled()
    })

    /**
     * The tolerant loader the screens use turns an unreadable or malformed record into
     * "nothing is pending". Here that would be a storage blip granting permission to
     * destroy the only key able to claim funds already in flight.
     */
    /** Refusing is right, but a read that failed is not a migration owing funds, and the
     *  two must not reach the user as the same sentence. */
    it("destroys nothing and says the record is unavailable when it cannot be read", async () => {
      mockReadPendingProvisionedAccounts.mockResolvedValue({ status: "read-failed" })
      const { result } = renderHook(() => useDeleteAccount())

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("record-unavailable")
      expect(mockDeleteMnemonicForAccount).not.toHaveBeenCalled()
      expect(mockUnlink).not.toHaveBeenCalled()
      expect(mockRemoveSelfCustodialAccountId).not.toHaveBeenCalled()
      expect(mockRemoveBackupStateFor).not.toHaveBeenCalled()
      expect(result.current.state).toBe("idle")
    })

    it("says the same for a record that will not parse", async () => {
      mockReadPendingProvisionedAccounts.mockResolvedValue({ status: "corrupt" })
      const { result } = renderHook(() => useDeleteAccount())

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("record-unavailable")
      expect(mockDeleteMnemonicForAccount).not.toHaveBeenCalled()
    })

    /** A key that was never written is an answer, not a failure: there is nothing to
     *  protect, so deletion proceeds. */
    it("deletes when the record is simply absent", async () => {
      mockReadPendingProvisionedAccounts.mockResolvedValue(pendingRecord({}))
      const { result } = renderHook(() => useDeleteAccount())

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("logged-out")
      expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    })

    /**
     * Staging runs on the regtest network like Local, so the refusal may not key off the
     * network: Staging is where this flow is device-tested.
     */
    it("refuses on Staging even though it runs on the regtest network", async () => {
      mockInstanceId = "Staging"
      mockNetwork = mockSparkNetwork.Regtest
      mockReadPendingProvisionedAccounts.mockResolvedValue(
        pendingRecord({ "custodial-1": TEST_SC_ACCOUNT_ID }),
      )
      const { result } = renderHook(() => useDeleteAccount())

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("blocked")
      expect(mockDeleteMnemonicForAccount).not.toHaveBeenCalled()
    })
  })
})
