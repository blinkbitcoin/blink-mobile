import { BackHandler } from "react-native"

import { act, renderHook } from "@testing-library/react-native"

import { useAccountRemoval } from "@app/screens/settings-screen/self-custodial/use-account-removal"

const mockNavigate = jest.fn()
const mockDispatch = jest.fn()
const mockSetOptions = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
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
    },
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockDeleteWallet = jest.fn()
jest.mock("@app/self-custodial/hooks/use-delete-account", () => ({
  useDeleteAccount: () => ({
    state: "idle",
    error: null,
    deleteWallet: mockDeleteWallet,
  }),
}))

const mockSetAccountIsBeingDeleted = jest.fn()
jest.mock("@app/screens/settings-screen/account/account-delete-context", () => ({
  useAccountDeleteContext: () => ({
    setAccountIsBeingDeleted: mockSetAccountIsBeingDeleted,
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
      return "switched-to-self-custodial"
    })
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())

    expect(mockDeleteWallet).toHaveBeenCalledWith("account-a")
    expect(lockedWhenDeleteStarted).toBe(true)
  })

  it("navigates away and names the removed account without dropping the lock first", async () => {
    mockDeleteWallet.mockResolvedValue("switched-to-self-custodial")
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())

    expect(mockNavigate).toHaveBeenCalledWith("Primary")
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        message: "You removed account Anon user.",
      }),
    )
    expect(mockSetAccountIsBeingDeleted).not.toHaveBeenCalledWith(false)
  })

  it("releases the lock and stays put when the removal fails", async () => {
    mockDeleteWallet.mockResolvedValue(undefined)
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())

    expect(mockSetAccountIsBeingDeleted).toHaveBeenLastCalledWith(false)
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("runs a confirmed removal once, even if the modal reports hiding again", async () => {
    mockDeleteWallet.mockResolvedValue("remained")
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())
    await act(() => result.current.runPendingRemoval())

    expect(mockDeleteWallet).toHaveBeenCalledTimes(1)
  })

  it("blocks every way back off the screen while the removal runs", async () => {
    const removeBackGuard = jest.fn()
    let backHandler: (() => boolean | null | undefined) | undefined
    const addListener = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        backHandler = handler
        return { remove: removeBackGuard }
      })
    let blockedWhileDeleting = false
    mockDeleteWallet.mockImplementation(async () => {
      blockedWhileDeleting =
        backHandler?.() === true &&
        mockSetOptions.mock.calls.some(
          ([options]) =>
            options.gestureEnabled === false && options.headerLeft?.() === null,
        )
      return "switched-to-self-custodial"
    })
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())

    expect(blockedWhileDeleting).toBe(true)
    expect(removeBackGuard).toHaveBeenCalledTimes(1)
    addListener.mockRestore()
  })

  it("gives the ways back again when the removal fails", async () => {
    const removeBackGuard = jest.fn()
    const addListener = jest
      .spyOn(BackHandler, "addEventListener")
      .mockReturnValue({ remove: removeBackGuard })
    mockDeleteWallet.mockResolvedValue(undefined)
    const { result } = renderHook(() => useAccountRemoval())

    act(() => result.current.requestRemoval("account-a", "Anon user"))
    await act(() => result.current.runPendingRemoval())

    expect(removeBackGuard).toHaveBeenCalledTimes(1)
    expect(mockSetOptions).toHaveBeenLastCalledWith({
      headerLeft: undefined,
      gestureEnabled: true,
    })
    addListener.mockRestore()
  })
})
