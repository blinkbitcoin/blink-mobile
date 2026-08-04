import { renderHook, act } from "@testing-library/react-native"

import {
  CreationStatus,
  useCreateWallet,
} from "@app/screens/self-custodial/onboarding/hooks/use-create-wallet"

const mockProvision = jest.fn()
const mockUpdateState = jest.fn()
const mockDispatch = jest.fn()
const mockReportError = jest.fn()
const mockReinitSdk = jest.fn()
const mockToastShow = jest.fn()

const TEST_ACCOUNT_ID = "sc-account-1"

jest.mock("@app/self-custodial/hooks/use-provision-self-custodial-account", () => ({
  useProvisionSelfCustodialAccount: () => ({ provision: mockProvision }),
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

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
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
    mockProvision.mockResolvedValue(TEST_ACCOUNT_ID)
  })

  it("starts with idle status", () => {
    const { result } = renderHook(() => useCreateWallet())

    expect(result.current.status).toBe(CreationStatus.Idle)
  })

  it("sets creating status during creation", async () => {
    let resolveProvision: () => void
    mockProvision.mockReturnValue(
      new Promise((resolve) => {
        resolveProvision = () => resolve(TEST_ACCOUNT_ID)
      }),
    )

    const { result } = renderHook(() => useCreateWallet())

    act(() => {
      result.current.create()
    })

    expect(result.current.status).toBe(CreationStatus.Creating)

    await act(async () => {
      resolveProvision!()
    })
  })

  it("activates the provisioned account id on success", async () => {
    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockProvision).toHaveBeenCalledTimes(1)
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

  it("sets error status, reports and toasts when provisioning fails", async () => {
    mockProvision.mockRejectedValue(new Error("creation failed"))

    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(result.current.status).toBe(CreationStatus.Error)
    expect(mockReportError).toHaveBeenCalledWith("Wallet creation", expect.any(Error))
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to create wallet. Please try again.",
      }),
    )
  })

  it("does not update state on failure", async () => {
    mockProvision.mockRejectedValue(new Error("fail"))

    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReinitSdk).not.toHaveBeenCalled()
  })

  it("ignores reentrant create while one is already in flight", async () => {
    let resolveFirst: (accountId: string) => void
    mockProvision.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
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

    expect(mockProvision).toHaveBeenCalledTimes(1)
    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockReinitSdk).not.toHaveBeenCalled()

    await act(async () => {
      resolveFirst!(TEST_ACCOUNT_ID)
    })
  })
})
