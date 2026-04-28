import { renderHook, act, waitFor } from "@testing-library/react-native"

import { DefaultAccountId } from "@app/types/wallet.types"

import { useDeleteSelfCustodial } from "@app/screens/settings-screen/account/multi-account/hooks/use-delete-self-custodial"

const mockNavigationDispatch = jest.fn()
const mockDisconnectSdk = jest.fn()
const mockDeleteMnemonic = jest.fn()
const mockResetBackupState = jest.fn()
const mockSetActiveAccountId = jest.fn()
const mockUpdatePersistentState = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()
const mockUseHasCustodialAccount = jest.fn()
const mockCrashlyticsLog = jest.fn()
const mockCrashlyticsRecordError = jest.fn()
const mockRnfsUnlink = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ dispatch: mockNavigationDispatch }),
  CommonActions: { reset: (args: unknown) => ({ type: "reset", payload: args }) },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: mockCrashlyticsLog,
  recordError: mockCrashlyticsRecordError,
}))

jest.mock("@app/self-custodial/bridge", () => ({
  disconnectSdk: (...args: unknown[]) => mockDisconnectSdk(...args),
}))

jest.mock("@app/self-custodial/providers/backup-state-provider", () => ({
  useBackupState: () => ({ resetBackupState: mockResetBackupState }),
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ setActiveAccountId: mockSetActiveAccountId }),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => mockUseHasCustodialAccount(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ updateState: mockUpdatePersistentState }),
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: { storageDir: "/test/breez-sdk-spark-regtest" },
}))

jest.mock("react-native-fs", () => ({
  __esModule: true,
  default: { unlink: (...args: unknown[]) => mockRnfsUnlink(...args) },
  unlink: (...args: unknown[]) => mockRnfsUnlink(...args),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: { deleteMnemonic: (...args: unknown[]) => mockDeleteMnemonic(...args) },
}))

const mockSdk = { id: "sdk" }

describe("useDeleteSelfCustodial", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })
    mockUseHasCustodialAccount.mockReturnValue(false)
    mockDisconnectSdk.mockResolvedValue(undefined)
    mockDeleteMnemonic.mockResolvedValue(undefined)
    mockRnfsUnlink.mockResolvedValue(undefined)
  })

  it("starts in idle state with no error", () => {
    const { result } = renderHook(() => useDeleteSelfCustodial())

    expect(result.current.state).toBe("idle")
    expect(result.current.error).toBeNull()
  })

  it("disconnects SDK, deletes mnemonic, wipes storage, clears activeAccountId, and navigates to getStarted when no custodial account exists", async () => {
    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet()
    })

    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)
    expect(mockDeleteMnemonic).toHaveBeenCalled()
    expect(mockRnfsUnlink).toHaveBeenCalledWith("/test/breez-sdk-spark-regtest")
    expect(mockResetBackupState).toHaveBeenCalled()
    expect(mockSetActiveAccountId).not.toHaveBeenCalled()

    const updaterFn = mockUpdatePersistentState.mock.calls[0][0]
    expect(updaterFn({ activeAccountId: "self-custodial-default", other: 1 })).toEqual({
      activeAccountId: undefined,
      other: 1,
    })

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
      await result.current.deleteWallet()
    })

    expect(mockSetActiveAccountId).toHaveBeenCalledWith(DefaultAccountId.Custodial)
    expect(mockNavigationDispatch).toHaveBeenCalledWith({
      type: "reset",
      payload: { index: 0, routes: [{ name: "Primary" }] },
    })
  })

  it("skips disconnect when sdk is null but still wipes the mnemonic and navigates", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet()
    })

    expect(mockDisconnectSdk).not.toHaveBeenCalled()
    expect(mockDeleteMnemonic).toHaveBeenCalled()
    expect(mockNavigationDispatch).toHaveBeenCalled()
  })

  it("does not abort the flow when disconnectSdk rejects (logs and continues)", async () => {
    mockDisconnectSdk.mockRejectedValue(new Error("disconnect failed"))
    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet()
    })

    expect(mockCrashlyticsLog).toHaveBeenCalled()
    expect(mockDeleteMnemonic).toHaveBeenCalled()
    expect(mockNavigationDispatch).toHaveBeenCalled()
    expect(result.current.state).toBe("idle")
  })

  it("captures the error when deleteMnemonic fails and exposes it via state", async () => {
    mockDeleteMnemonic.mockRejectedValue(new Error("storage error"))
    const { result } = renderHook(() => useDeleteSelfCustodial())

    await act(async () => {
      await result.current.deleteWallet()
    })

    await waitFor(() => expect(result.current.state).toBe("error"))
    expect(result.current.error?.message).toBe("storage error")
    expect(mockCrashlyticsRecordError).toHaveBeenCalled()
  })
})
