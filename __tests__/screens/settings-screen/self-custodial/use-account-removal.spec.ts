import { act, renderHook } from "@testing-library/react-native"

import { useAccountRemoval } from "@app/screens/settings-screen/self-custodial/use-account-removal"

const mockPopTo = jest.fn()
const mockDispatch = jest.fn()
const mockSetOptions = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    popTo: mockPopTo,
    dispatch: mockDispatch,
    setOptions: mockSetOptions,
  }),
  CommonActions: { reset: (args: unknown) => ({ type: "reset", payload: args }) },
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      ProfileScreen: {
        removedAccount: ({ identifier }: { identifier: string }) =>
          `You removed account ${identifier}.`,
      },
      SelfCustodialDelete: {
        removalFailed: ({ identifier }: { identifier: string }) =>
          `Couldn't remove account ${identifier}. Please try again.`,
      },
    },
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockDeleteWallet = jest.fn()
jest.mock("@app/self-custodial/hooks/use-delete-account", () => ({
  useDeleteAccount: () => ({ deleteWallet: mockDeleteWallet }),
}))

const mockSetAccountIsBeingDeleted = jest.fn()
const mockLeaveWhileDeleting = jest.fn((navigate: () => void) => navigate())
jest.mock("@app/screens/settings-screen/account/account-delete-context", () => ({
  useAccountDeleteContext: () => ({
    setAccountIsBeingDeleted: mockSetAccountIsBeingDeleted,
    leaveWhileDeleting: (navigate: () => void) => mockLeaveWhileDeleting(navigate),
  }),
}))

describe("useAccountRemoval", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("does nothing when the modal closes without a confirmed removal", async () => {
    const { result } = renderHook(() => useAccountRemoval())

    await act(() => result.current.runPendingRemoval())

    expect(mockDeleteWallet).not.toHaveBeenCalled()
    expect(mockSetAccountIsBeingDeleted).not.toHaveBeenCalled()
  })

  it("does not start the removal when it is requested, only when it is run", () => {
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))

    expect(mockDeleteWallet).not.toHaveBeenCalled()
    expect(mockSetAccountIsBeingDeleted).not.toHaveBeenCalled()
  })

  it("raises the lock naming the removed account before the delete switches accounts", async () => {
    let lockedWhenDeleteStarted = false
    mockDeleteWallet.mockImplementation(async () => {
      lockedWhenDeleteStarted = mockSetAccountIsBeingDeleted.mock.calls.some(
        ([isBeingDeleted, identifier]) => isBeingDeleted && identifier === "Anon user",
      )
      return { removed: true, outcome: "switched-to-self-custodial" }
    })
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())

    expect(mockDeleteWallet).toHaveBeenCalledWith("account-a")
    expect(lockedWhenDeleteStarted).toBe(true)
  })

  it("navigates away and names the removed account without dropping the lock first", async () => {
    mockDeleteWallet.mockResolvedValue({
      removed: true,
      outcome: "switched-to-self-custodial",
    })
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())

    expect(mockPopTo).toHaveBeenCalledWith("Primary")
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        message: "You removed account Anon user.",
      }),
    )
    expect(mockSetAccountIsBeingDeleted).not.toHaveBeenCalledWith(false)
  })

  it("releases the lock, stays put and says so when an inactive account fails to go", async () => {
    mockDeleteWallet.mockResolvedValue({ removed: false, outcome: "remained" })
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())

    expect(mockSetAccountIsBeingDeleted).toHaveBeenLastCalledWith(false)
    expect(mockPopTo).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "Couldn't remove account Anon user. Please try again.",
      }),
    )
  })

  /** The active account moved before the failure, so staying would leave the user on a
   *  screen that already describes the next account. */
  it("follows the switch a failed removal already made, and says it failed", async () => {
    mockDeleteWallet.mockResolvedValue({
      removed: false,
      outcome: "switched-to-self-custodial",
    })
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())

    expect(mockLeaveWhileDeleting).toHaveBeenCalledTimes(1)
    expect(mockPopTo).toHaveBeenCalledWith("Primary")
    expect(mockSetAccountIsBeingDeleted).not.toHaveBeenCalledWith(false)
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "Couldn't remove account Anon user. Please try again.",
      }),
    )
  })

  it("drops a confirmed removal once it is cancelled", async () => {
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    act(() => result.current.cancelRemoval())
    await act(() => result.current.runPendingRemoval())

    expect(mockDeleteWallet).not.toHaveBeenCalled()
  })

  it("runs a confirmed removal once, even if the modal reports hiding again", async () => {
    mockDeleteWallet.mockResolvedValue({ removed: true, outcome: "remained" })
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())
    await act(() => result.current.runPendingRemoval())

    expect(mockDeleteWallet).toHaveBeenCalledTimes(1)
  })

  /** The lock stays up while the screen is left, so the provider has to be told this
   *  navigation is the removal's own and not an exit it should refuse. */
  it("leaves the screen through the lock rather than around it", async () => {
    let navigatedThroughLock = false
    mockLeaveWhileDeleting.mockImplementationOnce((navigate) => {
      navigate()
      navigatedThroughLock = mockPopTo.mock.calls.length === 1
    })
    mockDeleteWallet.mockResolvedValue({
      removed: true,
      outcome: "switched-to-self-custodial",
    })
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())

    expect(navigatedThroughLock).toBe(true)
    expect(mockPopTo).toHaveBeenCalledTimes(1)
  })
})
