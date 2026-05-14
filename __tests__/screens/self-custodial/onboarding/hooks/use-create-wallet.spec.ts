import { renderHook, act } from "@testing-library/react-native"

import {
  CreationStatus,
  useCreateWallet,
} from "@app/screens/self-custodial/onboarding/hooks/use-create-wallet"

const mockCreateWallet = jest.fn()
const mockUpdateState = jest.fn()
const mockDispatch = jest.fn()
const mockRecordError = jest.fn()
const mockReinitSdk = jest.fn()
const mockReloadSelfCustodialAccounts = jest.fn()
const mockToastShow = jest.fn()

const TEST_ACCOUNT_ID = "test-account-id-123"

jest.mock("react-native-quick-crypto", () => ({
  randomUUID: () => "test-account-id-123",
}))

jest.mock("@app/self-custodial/bridge", () => ({
  selfCustodialCreateWallet: (accountId: string) => mockCreateWallet(accountId),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
  }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    updateState: mockUpdateState,
  }),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    dispatch: mockDispatch,
  }),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ retry: mockReinitSdk }),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: Error[]) => mockRecordError(...args),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: {
        createFailed: () => "Failed to create wallet. Please try again.",
      },
    },
  }),
}))

describe("useCreateWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateWallet.mockResolvedValue(undefined)
    mockReloadSelfCustodialAccounts.mockResolvedValue(undefined)
  })

  it("starts with idle status", () => {
    const { result } = renderHook(() => useCreateWallet())

    expect(result.current.status).toBe(CreationStatus.Idle)
  })

  it("sets creating status during creation", async () => {
    let resolveCreate: () => void
    mockCreateWallet.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = () => resolve("mnemonic")
      }),
    )

    const { result } = renderHook(() => useCreateWallet())

    act(() => {
      result.current.create()
    })

    expect(result.current.status).toBe(CreationStatus.Creating)

    await act(async () => {
      resolveCreate!()
    })
  })

  it("updates activeAccountId on success", async () => {
    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockUpdateState).toHaveBeenCalledTimes(1)

    const updater = mockUpdateState.mock.calls[0][0]
    expect(updater(null)).toBeNull()
    expect(updater({ galoyAuthToken: "t" })).toEqual({
      galoyAuthToken: "t",
      activeAccountId: TEST_ACCOUNT_ID,
    })
  })

  it("reinits SDK on success", async () => {
    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockReinitSdk).toHaveBeenCalledTimes(1)
  })

  it("navigates to Primary on success", async () => {
    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: expect.objectContaining({
          routes: [{ name: "Primary" }],
        }),
      }),
    )
  })

  it("sets error status on failure", async () => {
    mockCreateWallet.mockRejectedValue(new Error("creation failed"))

    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(result.current.status).toBe(CreationStatus.Error)
  })

  it("shows a toast with the createFailed message on failure", async () => {
    mockCreateWallet.mockRejectedValue(new Error("creation failed"))

    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to create wallet. Please try again.",
      }),
    )
  })

  it("wraps non-Error rejection for crashlytics", async () => {
    mockCreateWallet.mockRejectedValue("string error")

    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(result.current.status).toBe(CreationStatus.Error)
    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Wallet creation failed: string error" }),
    )
  })

  it("does not update state on failure", async () => {
    mockCreateWallet.mockRejectedValue(new Error("fail"))

    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReinitSdk).not.toHaveBeenCalled()
  })

  it("ignores reentrant create while one is already in flight", async () => {
    let resolveFirst: () => void
    mockCreateWallet.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve
        }),
    )

    const { result } = renderHook(() => useCreateWallet())

    act(() => {
      result.current.create()
    })

    expect(result.current.status).toBe(CreationStatus.Creating)

    await act(async () => {
      await result.current.create()
    })

    expect(mockCreateWallet).toHaveBeenCalledTimes(1)
    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReinitSdk).not.toHaveBeenCalled()

    await act(async () => {
      resolveFirst!()
    })
  })
})
