import { renderHook, act } from "@testing-library/react-native"

import {
  CreationStatus,
  useCreateWallet,
} from "@app/screens/spark-onboarding/hooks/use-create-wallet"

const mockCreateWallet = jest.fn()
const mockUpdateState = jest.fn()
const mockDispatch = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  selfCustodialCreateWallet: () => mockCreateWallet(),
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

describe("useCreateWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateWallet.mockResolvedValue("word1 word2 word3")
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
      activeAccountId: "self-custodial-default",
    })
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

  it("does not update state on failure", async () => {
    mockCreateWallet.mockRejectedValue(new Error("fail"))

    const { result } = renderHook(() => useCreateWallet())

    await act(async () => {
      await result.current.create()
    })

    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
