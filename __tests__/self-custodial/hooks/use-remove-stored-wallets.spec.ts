import { act, renderHook } from "@testing-library/react-native"

import { useRemoveStoredWallets } from "@app/self-custodial/hooks/use-remove-stored-wallets"

const mockListSelfCustodialAccounts = jest.fn()
const mockReadStoredWalletPresence = jest.fn()
const mockEraseWalletFromDevice = jest.fn()
const mockDisconnectSdk = jest.fn()
const mockLogout = jest.fn()
const mockUpdateState = jest.fn()
const mockReloadSelfCustodialAccounts = jest.fn()
const mockReportError = jest.fn()
const mockCrashlyticsLog = jest.fn()

let mockSdk: object | null = null

jest.mock("@app/self-custodial/storage/account-index", () => ({
  StorageReadStatus: { Ok: "ok", ReadFailed: "read-failed" },
  StoredWalletPresence: { Present: "present", Absent: "absent", Unknown: "unknown" },
  listSelfCustodialAccounts: () => mockListSelfCustodialAccounts(),
  readStoredWalletPresence: () => mockReadStoredWalletPresence(),
}))

jest.mock("@app/self-custodial/hooks/use-delete-account", () => ({
  eraseWalletFromDevice: (...args: unknown[]) => mockEraseWalletFromDevice(...args),
}))

jest.mock("@app/self-custodial/bridge", () => ({
  disconnectSdk: (sdk: unknown) => mockDisconnectSdk(sdk),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ sdk: mockSdk }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ updateState: mockUpdateState }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
  }),
}))

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (message: string) => mockCrashlyticsLog(message),
}))

const storeWallets = (ids: ReadonlyArray<string>) => {
  mockListSelfCustodialAccounts.mockResolvedValue({
    status: "ok",
    entries: ids.map((id) => ({ id, lightningAddress: null })),
  })
}

const removeStoredWallets = async () => {
  const { result } = renderHook(() => useRemoveStoredWallets())
  let outcome
  await act(async () => {
    outcome = await result.current()
  })
  return outcome
}

describe("useRemoveStoredWallets", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSdk = null
    storeWallets(["wallet-a", "wallet-b"])
    mockEraseWalletFromDevice.mockResolvedValue(true)
    mockReloadSelfCustodialAccounts.mockResolvedValue(undefined)
    mockReadStoredWalletPresence.mockResolvedValue("absent")
    mockLogout.mockResolvedValue({ isAppLockKept: false })
    mockDisconnectSdk.mockResolvedValue(undefined)
  })

  it("removes every wallet, then logs out and reports where the lock ended up", async () => {
    const outcome = await removeStoredWallets()

    expect(mockEraseWalletFromDevice).toHaveBeenCalledWith("wallet-a", "regtest")
    expect(mockEraseWalletFromDevice).toHaveBeenCalledWith("wallet-b", "regtest")
    expect(mockReloadSelfCustodialAccounts).toHaveBeenCalledTimes(1)
    expect(mockLogout).toHaveBeenCalledWith()
    expect(outcome).toEqual({ isEveryWalletRemoved: true, isAppLockKept: false })
  })

  it("passes on the logout's answer when the lock outlived it", async () => {
    mockLogout.mockResolvedValue({ isAppLockKept: true })

    expect(await removeStoredWallets()).toEqual({
      isEveryWalletRemoved: true,
      isAppLockKept: true,
    })
  })

  /** The lifecycle tears down through its own cleanup only once nothing is chosen, so the
   *  active account goes before the SDK does. */
  it("moves off the active wallet before disconnecting its SDK", async () => {
    mockSdk = { id: "connected-sdk" }

    await removeStoredWallets()

    const [updater] = mockUpdateState.mock.calls[0]
    expect(updater({ activeAccountId: "wallet-a", schemaVersion: 21 })).toEqual({
      activeAccountId: undefined,
      schemaVersion: 21,
    })
    expect(updater(undefined)).toBeUndefined()
    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)
    expect(mockUpdateState.mock.invocationCallOrder[0]).toBeLessThan(
      mockDisconnectSdk.mock.invocationCallOrder[0],
    )
  })

  it("goes on removing when the SDK will not disconnect", async () => {
    mockSdk = { id: "connected-sdk" }
    mockDisconnectSdk.mockRejectedValue(new Error("already gone"))

    const outcome = await removeStoredWallets()

    expect(mockCrashlyticsLog).toHaveBeenCalledWith(
      expect.stringContaining("disconnect failed"),
    )
    expect(outcome).toEqual({ isEveryWalletRemoved: true, isAppLockKept: false })
  })

  describe("failing closed", () => {
    /** Nothing can be erased from a list that could not be read, and a device that may
     *  still store a wallet is what the lock is kept for. */
    it("erases nothing and keeps the lock when the index cannot be read", async () => {
      mockListSelfCustodialAccounts.mockResolvedValue({
        status: "read-failed",
        error: new Error("AsyncStorage down"),
      })

      const outcome = await removeStoredWallets()

      expect(mockEraseWalletFromDevice).not.toHaveBeenCalled()
      expect(mockLogout).not.toHaveBeenCalled()
      expect(outcome).toEqual({ isEveryWalletRemoved: false, isAppLockKept: true })
    })

    /** The erase keeps a wallet whose seed survived listed, so the index still answers
     *  present and the logout never runs. */
    it("does not log out while a wallet whose seed would not erase stays listed", async () => {
      mockEraseWalletFromDevice.mockImplementation(
        async (id: string) => id !== "wallet-b",
      )
      mockReadStoredWalletPresence.mockResolvedValue("present")

      const outcome = await removeStoredWallets()

      expect(mockEraseWalletFromDevice).toHaveBeenCalledWith("wallet-b", "regtest")
      expect(mockLogout).not.toHaveBeenCalled()
      expect(outcome).toEqual({ isEveryWalletRemoved: false, isAppLockKept: true })
    })

    it("reports an erase that throws and goes on with the rest", async () => {
      const eraseFailure = new Error("keychain locked")
      mockEraseWalletFromDevice.mockImplementation(async (id: string) => {
        if (id === "wallet-a") throw eraseFailure
        return true
      })
      mockReadStoredWalletPresence.mockResolvedValue("present")

      const outcome = await removeStoredWallets()

      expect(mockReportError).toHaveBeenCalledWith(
        "Self-custodial remove stored wallets",
        eraseFailure,
      )
      expect(mockEraseWalletFromDevice).toHaveBeenCalledWith("wallet-b", "regtest")
      expect(outcome).toEqual({ isEveryWalletRemoved: false, isAppLockKept: true })
    })

    /** An entry whose removal did not land is a wallet the next launch still lists, so
     *  the index is asked again rather than trusting the loop. */
    it("does not log out while the index still lists a wallet", async () => {
      mockReadStoredWalletPresence.mockResolvedValue("unknown")

      const outcome = await removeStoredWallets()

      expect(mockLogout).not.toHaveBeenCalled()
      expect(outcome).toEqual({ isEveryWalletRemoved: false, isAppLockKept: true })
    })
  })
})
