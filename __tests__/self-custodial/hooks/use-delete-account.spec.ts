import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act } from "@testing-library/react-native"

import { AccountStatus, AccountType, DefaultAccountId } from "@app/types/wallet"

import {
  type DeleteAccountResult,
  useDeleteAccount,
} from "@app/self-custodial/hooks/use-delete-account"

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
  storageDirFor: (id: string, network: unknown) => mockStorageDirFor(id, network),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  removeBackupStateFor: (...args: unknown[]) => mockRemoveBackupStateFor(...args),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
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
  })

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
    expect(mockUpdateState).toHaveBeenCalled()
    expect(deletion).toEqual({ removed: true, outcome: "logged-out" })
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
    expect(deletion).toEqual({ removed: false, outcome: "logged-out" })
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
})
