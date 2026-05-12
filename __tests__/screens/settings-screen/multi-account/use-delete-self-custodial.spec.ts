import { renderHook, act, waitFor } from "@testing-library/react-native"

import { AccountStatus, AccountType, DefaultAccountId } from "@app/types/wallet"

import { useDeleteSelfCustodial } from "@app/screens/settings-screen/account/multi-account/hooks/use-delete-self-custodial"

const TEST_SC_ACCOUNT_ID = "test-sc-uuid"

const mockNavigationDispatch = jest.fn()
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

const mockNavigationNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    dispatch: mockNavigationDispatch,
    navigate: mockNavigationNavigate,
  }),
  CommonActions: { reset: (args: unknown) => ({ type: "reset", payload: args }) },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: mockCrashlyticsLog,
  recordError: jest.fn(),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@app/self-custodial/bridge", () => ({
  disconnectSdk: (...args: unknown[]) => mockDisconnectSdk(...args),
}))

jest.mock("@app/self-custodial/config", () => ({
  storageDirFor: (id: string) => `/tmp/${id}`,
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

describe("useDeleteSelfCustodial", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

  it("starts in idle state with no error", () => {
    const { result } = renderHook(() => useDeleteSelfCustodial())

    expect(result.current.state).toBe("idle")
    expect(result.current.error).toBeNull()
  })

  it("disconnects SDK, wipes mnemonic, and navigates to getStarted when no custodial account exists", async () => {
    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    expect(mockRemoveSelfCustodialAccountId).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    expect(mockRemoveBackupStateFor).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    expect(mockUpdateState).toHaveBeenCalled()
    expect(mockNavigationDispatch).toHaveBeenCalledWith({
      type: "reset",
      payload: { index: 0, routes: [{ name: "getStarted" }] },
    })
    expect(result.current.state).toBe("idle")
  })

  it("switches to the custodial account and navigates to Primary when a custodial account exists", async () => {
    mockUseHasCustodialAccount.mockReturnValue(true)
    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith(DefaultAccountId.Custodial)
    expect(mockNavigationDispatch).toHaveBeenCalledWith({
      type: "reset",
      payload: { index: 0, routes: [{ name: "Primary" }] },
    })
  })

  it("switches to a remaining self-custodial account and navigates to Primary when one is left", async () => {
    const remaining = {
      ...activeSelfCustodialAccount,
      id: "other-sc-id",
      selected: false,
    }
    mockUseAccountRegistry.mockReturnValue({
      accounts: [activeSelfCustodialAccount, remaining],
      activeAccount: activeSelfCustodialAccount,
      setActiveAccountId: mockSetActiveAccountId,
      reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
    })

    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("other-sc-id")
    expect(mockNavigationNavigate).toHaveBeenCalledWith("Primary")
  })

  it("skips disconnect when sdk is null but still wipes the mnemonic and navigates", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockDisconnectSdk).not.toHaveBeenCalled()
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalledWith(TEST_SC_ACCOUNT_ID)
    expect(mockNavigationDispatch).toHaveBeenCalled()
  })

  it("does not abort the flow when disconnectSdk rejects (logs and continues)", async () => {
    mockDisconnectSdk.mockRejectedValue(new Error("disconnect failed"))
    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockCrashlyticsLog).toHaveBeenCalled()
    expect(mockDeleteMnemonicForAccount).toHaveBeenCalled()
    expect(mockNavigationDispatch).toHaveBeenCalled()
    expect(result.current.state).toBe("idle")
  })

  it("captures the error when deleteMnemonicForAccount fails and exposes it via state", async () => {
    mockDeleteMnemonicForAccount.mockRejectedValue(new Error("storage error"))
    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    await waitFor(() => expect(result.current.state).toBe("error"))
    expect(result.current.error?.message).toBe("storage error")
    expect(mockReportError).toHaveBeenCalled()
  })

  it("switches the active account BEFORE disconnecting the SDK so useSdkLifecycle does not poll a stale ref (Important #2)", async () => {
    const remaining = {
      ...activeSelfCustodialAccount,
      id: "other-sc-id",
      selected: false,
    }
    mockUseAccountRegistry.mockReturnValue({
      accounts: [activeSelfCustodialAccount, remaining],
      activeAccount: activeSelfCustodialAccount,
      setActiveAccountId: mockSetActiveAccountId,
      reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
    })

    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("other-sc-id")
    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)

    const setActiveOrder = mockSetActiveAccountId.mock.invocationCallOrder[0]
    const disconnectOrder = mockDisconnectSdk.mock.invocationCallOrder[0]
    const deleteOrder = mockDeleteMnemonicForAccount.mock.invocationCallOrder[0]

    expect(setActiveOrder).toBeLessThan(disconnectOrder)
    expect(disconnectOrder).toBeLessThan(deleteOrder)
  })

  it("clears activeAccountId BEFORE disconnecting when no fallback exists (Important #2 — getStarted path)", async () => {
    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet(TEST_SC_ACCOUNT_ID)
    })

    expect(mockUpdateState).toHaveBeenCalled()
    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)

    const updateOrder = mockUpdateState.mock.invocationCallOrder[0]
    const disconnectOrder = mockDisconnectSdk.mock.invocationCallOrder[0]

    expect(updateOrder).toBeLessThan(disconnectOrder)
  })

  it("switches to the custodial account BEFORE disconnecting (Important #2 — custodial-fallback path)", async () => {
    mockUseHasCustodialAccount.mockReturnValue(true)
    const { result } = renderHook(() => useDeleteSelfCustodial())

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
