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
const mockGetMnemonicForAccount = jest.fn()
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
  storageDirFor: (id: string, network: unknown) => mockStorageDirFor(id, network),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  removeBackupStateFor: (...args: unknown[]) => mockRemoveBackupStateFor(...args),
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
    getMnemonicForAccount: (...args: unknown[]) => mockGetMnemonicForAccount(...args),
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
    mockGetMnemonicForAccount.mockResolvedValue(null)
    mockRemoveBackupStateFor.mockResolvedValue(undefined)
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

    /**
     * The in-memory token field is blanked by `clearToken` and by `resetState` whatever the
     * keychain did, so a logout whose keychain erase failed, the one case where the logout
     * deliberately keeps the lock, would read as no token at all.
     */
    it("keeps the lock when the keychain still holds an active token", async () => {
      mockReadActiveToken.mockResolvedValue({ status: "found", token: "live-token" })
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearAppLock).not.toHaveBeenCalled()
    })

    it("keeps the lock when the active token cannot be read", async () => {
      mockReadActiveToken.mockResolvedValue({
        status: "failed",
        err: new Error("keystore locked"),
      })
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearAppLock).not.toHaveBeenCalled()
    })

    /** The index entry is removed either way, so an erase that failed would otherwise
     *  leave the mnemonic on the device with the index reporting nothing stored. */
    it("keeps the lock when the deleted wallet's key is still readable", async () => {
      mockDeleteMnemonicForAccount.mockResolvedValue(false)
      mockGetMnemonicForAccount.mockResolvedValue("word word word")
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

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
      mockReadActiveToken.mockResolvedValue({ status: "found", token: "live-token" })
      const { result } = renderHook(() => useDeleteAccount())

      let outcome: string | undefined
      await act(async () => {
        outcome = await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(outcome).toBe("logged-out-locked")
    })

    /**
     * Reading the slot back cannot stand in for the erase. That read answers null for a key
     * that is absent and for one it could not open, on either platform, so a seed whose
     * erase and read both failed would be scored as gone and the lock wiped over a mnemonic
     * still on the device. The erase has to say so itself; a wallet whose key was already
     * missing keeps the lock, which is friction rather than exposure.
     */
    it("keeps the lock when the key's erase failed and reading it back answers nothing", async () => {
      mockDeleteMnemonicForAccount.mockResolvedValue(false)
      mockGetMnemonicForAccount.mockResolvedValue(null)
      const { result } = renderHook(() => useDeleteAccount())

      await act(async () => {
        await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
      })

      expect(mockClearAppLock).not.toHaveBeenCalled()
      expect(mockGetMnemonicForAccount).not.toHaveBeenCalled()
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
