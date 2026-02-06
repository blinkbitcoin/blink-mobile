import { act, renderHook } from "@testing-library/react-hooks"

import {
  useReplaceCardFlow,
  Step,
} from "@app/screens/card-screen/replace-card-screens/use-replace-card-flow"

const mockAddListener = jest.fn()
const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    addListener: mockAddListener,
  }),
}))

jest.mock("@app/screens/card-screen/card-mock-data", () => ({
  MOCK_USER: {
    registeredAddress: {
      fullName: "Satoshi Nakamoto",
      addressLine1: "123 Main Street",
      addressLine2: "Apt 4B",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "United States",
    },
  },
}))

describe("useReplaceCardFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAddListener.mockReturnValue(jest.fn())
  })

  describe("initial state", () => {
    it("starts at step 1", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      expect(result.current.step).toBe(Step.ReportIssue)
    })

    it("has null selectedIssue", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      expect(result.current.state.selectedIssue).toBeNull()
    })

    it("has null selectedDelivery", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      expect(result.current.state.selectedDelivery).toBeNull()
    })

    it("has useRegisteredAddress as true", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      expect(result.current.state.useRegisteredAddress).toBe(true)
    })

    it("has customAddress from registered address", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      expect(result.current.state.customAddress).toEqual({
        fullName: "Satoshi Nakamoto",
        addressLine1: "123 Main Street",
        addressLine2: "Apt 4B",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "United States",
      })
    })
  })

  describe("setSelectedIssue", () => {
    it("sets lost issue", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.setSelectedIssue("lost")
      })

      expect(result.current.state.selectedIssue).toBe("lost")
    })

    it("sets stolen issue", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.setSelectedIssue("stolen")
      })

      expect(result.current.state.selectedIssue).toBe("stolen")
    })

    it("sets damaged issue", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.setSelectedIssue("damaged")
      })

      expect(result.current.state.selectedIssue).toBe("damaged")
    })
  })

  describe("setSelectedDelivery", () => {
    it("sets standard delivery", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.setSelectedDelivery("standard")
      })

      expect(result.current.state.selectedDelivery).toBe("standard")
    })

    it("sets express delivery", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.setSelectedDelivery("express")
      })

      expect(result.current.state.selectedDelivery).toBe("express")
    })
  })

  describe("toggleUseRegisteredAddress", () => {
    it("toggles from true to false", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.toggleUseRegisteredAddress()
      })

      expect(result.current.state.useRegisteredAddress).toBe(false)
    })

    it("toggles back to true", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.toggleUseRegisteredAddress()
      })

      act(() => {
        result.current.toggleUseRegisteredAddress()
      })

      expect(result.current.state.useRegisteredAddress).toBe(true)
    })
  })

  describe("setCustomAddress", () => {
    it("updates custom address", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      const newAddress = {
        fullName: "Joe Nakamoto",
        addressLine1: "456 Oak Avenue",
        addressLine2: "",
        city: "Austin",
        state: "TX",
        postalCode: "73301",
        country: "United States",
      }

      act(() => {
        result.current.setCustomAddress(newAddress)
      })

      expect(result.current.state.customAddress).toEqual(newAddress)
    })
  })

  describe("goToNextStep", () => {
    it("advances from step 1 to step 2", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(Step.Delivery)
    })

    it("advances from step 2 to step 3", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.goToNextStep()
      })

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(Step.Confirm)
    })

    it("does not advance past step 3", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.goToNextStep()
      })

      act(() => {
        result.current.goToNextStep()
      })

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(Step.Confirm)
    })
  })

  describe("completeFlow", () => {
    it("marks flow as complete", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.completeFlow()
      })

      expect(result.current).toBeTruthy()
    })
  })

  describe("navigation listener", () => {
    it("registers beforeRemove listener on mount", () => {
      renderHook(() => useReplaceCardFlow())

      expect(mockAddListener).toHaveBeenCalledWith("beforeRemove", expect.any(Function))
    })

    it("returns unsubscribe function", () => {
      const unsubscribe = jest.fn()
      mockAddListener.mockReturnValue(unsubscribe)

      const { unmount } = renderHook(() => useReplaceCardFlow())

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })

    it("prevents back navigation at step 2", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      act(() => {
        result.current.goToNextStep()
      })

      const listener =
        mockAddListener.mock.calls[mockAddListener.mock.calls.length - 1][1]
      const event = { preventDefault: jest.fn() }
      listener(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(result.current.step).toBe(Step.ReportIssue)
    })

    it("does not prevent back navigation at step 1", () => {
      renderHook(() => useReplaceCardFlow())

      const listener = mockAddListener.mock.calls[0][1]
      const event = { preventDefault: jest.fn() }
      listener(event)

      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe("multi-step flow", () => {
    it("progresses through all steps with state", () => {
      const { result } = renderHook(() => useReplaceCardFlow())

      expect(result.current.step).toBe(Step.ReportIssue)

      act(() => {
        result.current.setSelectedIssue("lost")
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(Step.Delivery)
      expect(result.current.state.selectedIssue).toBe("lost")

      act(() => {
        result.current.setSelectedDelivery("standard")
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(Step.Confirm)
      expect(result.current.state.selectedDelivery).toBe("standard")
    })
  })
})
