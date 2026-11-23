import { renderHook } from "@testing-library/react-native"

import { useHomeOnBackAfterSend } from "@app/screens/send-bitcoin-screen/hooks/use-home-on-back-after-send"

type BeforeRemove = (event: {
  data: { action: { type: string } }
  preventDefault: () => void
}) => void

const mockDispatch = jest.fn()
const mockSetOptions = jest.fn()
const mockListeners: BeforeRemove[] = []

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    dispatch: mockDispatch,
    setOptions: mockSetOptions,
    addListener: (_: string, listener: BeforeRemove) => {
      mockListeners.push(listener)
      return () => mockListeners.splice(mockListeners.indexOf(listener), 1)
    },
  }),
}))

const BACKWARD_ACTIONS = ["GO_BACK", "POP"]

const remove = (type: string) => {
  const preventDefault = jest.fn()
  mockListeners.forEach((listener) =>
    listener({ data: { action: { type } }, preventDefault }),
  )
  return preventDefault
}

describe("useHomeOnBackAfterSend", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListeners.length = 0
  })

  it("leaves back and the swipe alone before any send", () => {
    renderHook(() => useHomeOnBackAfterSend(false))

    expect(remove("GO_BACK")).not.toHaveBeenCalled()
    expect(mockSetOptions).not.toHaveBeenCalled()
  })

  BACKWARD_ACTIONS.forEach((type) => {
    it(`sends ${type} Home after a send, never back to a screen that can pay again`, () => {
      renderHook(() => useHomeOnBackAfterSend(true))

      expect(remove(type)).toHaveBeenCalled()
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "POP_TO_TOP" }),
      )
      expect(mockSetOptions).toHaveBeenCalledWith({ gestureEnabled: false })
    })
  })

  it("lets the reset to the completed screen and the sheet's exits through", () => {
    renderHook(() => useHomeOnBackAfterSend(true))

    for (const type of ["RESET", "POP_TO", "POP_TO_TOP"]) {
      expect(remove(type)).not.toHaveBeenCalled()
    }
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("takes over back from the first attempt on", () => {
    const { rerender } = renderHook(
      ({ hasAttemptedSend }: { hasAttemptedSend: boolean }) =>
        useHomeOnBackAfterSend(hasAttemptedSend),
      { initialProps: { hasAttemptedSend: false } },
    )
    expect(remove("GO_BACK")).not.toHaveBeenCalled()

    rerender({ hasAttemptedSend: true })

    expect(remove("GO_BACK")).toHaveBeenCalled()
  })
})
