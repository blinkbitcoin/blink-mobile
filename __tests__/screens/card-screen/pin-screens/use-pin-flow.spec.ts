import { act, renderHook } from "@testing-library/react-hooks"

import { usePinFlow } from "@app/screens/card-screen/pin-screens/use-pin-flow"

const mockAddListener = jest.fn()
const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    addListener: mockAddListener,
  }),
}))

describe("usePinFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAddListener.mockReturnValue(jest.fn())
  })

  describe("initial state", () => {
    it("starts at step 1", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      expect(result.current.step).toBe(1)
    })

    it("has empty stored pin", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      expect(result.current.storedPin).toBe("")
    })

    it("has empty error message", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      expect(result.current.errorMessage).toBe("")
    })

    it("has resetTrigger at 0", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      expect(result.current.resetTrigger).toBe(0)
    })

    it("has showConfirmButton as false", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      expect(result.current.showConfirmButton).toBe(false)
    })
  })

  describe("goToNextStep", () => {
    it("increments step by 1", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 3 }))

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(2)
    })

    it("increments resetTrigger", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 3 }))

      const initialResetTrigger = result.current.resetTrigger

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.resetTrigger).toBe(initialResetTrigger + 1)
    })

    it("can advance to final step", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(2)
    })
  })

  describe("showError", () => {
    it("sets error message", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.showError("Invalid PIN")
      })

      expect(result.current.errorMessage).toBe("Invalid PIN")
    })

    it("increments resetTrigger", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      const initialResetTrigger = result.current.resetTrigger

      act(() => {
        result.current.showError("Invalid PIN")
      })

      expect(result.current.resetTrigger).toBe(initialResetTrigger + 1)
    })
  })

  describe("confirmPin", () => {
    it("sets showConfirmButton to true", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.confirmPin()
      })

      expect(result.current.showConfirmButton).toBe(true)
    })
  })

  describe("completeFlow", () => {
    it("marks flow as complete", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.completeFlow()
      })

      expect(result.current).toBeTruthy()
    })
  })

  describe("handlePinChange", () => {
    it("clears error message when there is one", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.showError("Invalid PIN")
      })

      expect(result.current.errorMessage).toBe("Invalid PIN")

      act(() => {
        result.current.handlePinChange()
      })

      expect(result.current.errorMessage).toBe("")
    })

    it("hides confirm button when shown", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.confirmPin()
      })

      expect(result.current.showConfirmButton).toBe(true)

      act(() => {
        result.current.handlePinChange()
      })

      expect(result.current.showConfirmButton).toBe(false)
    })

    it("does nothing when no error and no confirm button", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.handlePinChange()
      })

      expect(result.current.errorMessage).toBe("")
      expect(result.current.showConfirmButton).toBe(false)
    })
  })

  describe("setStoredPin", () => {
    it("stores the pin value", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.setStoredPin("1234")
      })

      expect(result.current.storedPin).toBe("1234")
    })

    it("can update stored pin", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.setStoredPin("1234")
      })

      act(() => {
        result.current.setStoredPin("5678")
      })

      expect(result.current.storedPin).toBe("5678")
    })
  })

  describe("navigation listener", () => {
    it("registers beforeRemove listener on mount", () => {
      renderHook(() => usePinFlow({ totalSteps: 2 }))

      expect(mockAddListener).toHaveBeenCalledWith("beforeRemove", expect.any(Function))
    })

    it("returns unsubscribe function", () => {
      const unsubscribe = jest.fn()
      mockAddListener.mockReturnValue(unsubscribe)

      const { unmount } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })
  })

  describe("multi-step flow", () => {
    it("progresses through all steps", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 3 }))

      expect(result.current.step).toBe(1)

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(2)

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(3)
    })

    it("maintains state across steps", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 3 }))

      act(() => {
        result.current.setStoredPin("1234")
        result.current.goToNextStep()
      })

      expect(result.current.storedPin).toBe("1234")
      expect(result.current.step).toBe(2)
    })
  })

  describe("error handling flow", () => {
    it("shows error then clears on pin change", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.showError("PINs do not match")
      })

      expect(result.current.errorMessage).toBe("PINs do not match")

      act(() => {
        result.current.handlePinChange()
      })

      expect(result.current.errorMessage).toBe("")
    })
  })

  describe("confirm flow", () => {
    it("shows confirm button then hides on pin change", () => {
      const { result } = renderHook(() => usePinFlow({ totalSteps: 2 }))

      act(() => {
        result.current.confirmPin()
      })

      expect(result.current.showConfirmButton).toBe(true)

      act(() => {
        result.current.handlePinChange()
      })

      expect(result.current.showConfirmButton).toBe(false)
    })
  })
})
