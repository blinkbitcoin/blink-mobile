import { renderHook } from "@testing-library/react-native"

import { useHomeOnBackWhenSpent } from "@app/screens/send-bitcoin-screen/hooks/use-home-on-back-when-spent"

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

describe("useHomeOnBackWhenSpent", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListeners.length = 0
  })

  it("leaves back alone before the send is spent", () => {
    renderHook(() => useHomeOnBackWhenSpent(false))

    expect(remove("GO_BACK")).not.toHaveBeenCalled()
    expect(mockSetOptions).toHaveBeenCalledWith({ gestureEnabled: true })
  })
  BACKWARD_ACTIONS.forEach((type) => {
    it(`sends ${type} Home once spent, never back to a screen that can pay again`, () => {
      renderHook(() => useHomeOnBackWhenSpent(true))

      expect(remove(type)).toHaveBeenCalled()
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "POP_TO_TOP" }),
      )
      expect(mockSetOptions).toHaveBeenCalledWith({ gestureEnabled: false })
    })
  })

  it("lets the reset to the completed screen through", () => {
    renderHook(() => useHomeOnBackWhenSpent(true))

    expect(remove("RESET")).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
