import { act, renderHook } from "@testing-library/react-hooks"

import {
  useOrderCardFlow,
  Step,
} from "@app/screens/card-screen/order-card-screens/use-order-card-flow"

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

describe("useOrderCardFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAddListener.mockReturnValue(jest.fn())
  })

  describe("initial state", () => {
    it("starts at Step.Shipping", () => {
      const { result } = renderHook(() => useOrderCardFlow())

      expect(result.current.step).toBe(Step.Shipping)
    })

    it("has selectedDelivery as standard", () => {
      const { result } = renderHook(() => useOrderCardFlow())

      expect(result.current.state.selectedDelivery).toBe("standard")
    })

    it("has useRegisteredAddress as true", () => {
      const { result } = renderHook(() => useOrderCardFlow())

      expect(result.current.state.useRegisteredAddress).toBe(true)
    })

    it("has customAddress from registered address", () => {
      const { result } = renderHook(() => useOrderCardFlow())

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

  describe("toggleUseRegisteredAddress", () => {
    it("toggles from true to false", () => {
      const { result } = renderHook(() => useOrderCardFlow())

      act(() => {
        result.current.toggleUseRegisteredAddress()
      })

      expect(result.current.state.useRegisteredAddress).toBe(false)
    })

    it("toggles back to true", () => {
      const { result } = renderHook(() => useOrderCardFlow())

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
      const { result } = renderHook(() => useOrderCardFlow())

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
      const { result } = renderHook(() => useOrderCardFlow())

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(Step.Confirm)
    })

    it("does not advance past step 2", () => {
      const { result } = renderHook(() => useOrderCardFlow())

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
      const { result } = renderHook(() => useOrderCardFlow())

      act(() => {
        result.current.completeFlow()
      })

      expect(result.current).toBeTruthy()
    })
  })

  describe("navigation listener", () => {
    it("registers beforeRemove listener on mount", () => {
      renderHook(() => useOrderCardFlow())

      expect(mockAddListener).toHaveBeenCalledWith("beforeRemove", expect.any(Function))
    })

    it("returns unsubscribe function", () => {
      const unsubscribe = jest.fn()
      mockAddListener.mockReturnValue(unsubscribe)

      const { unmount } = renderHook(() => useOrderCardFlow())

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })

    it("prevents back navigation at step 2", () => {
      const { result } = renderHook(() => useOrderCardFlow())

      act(() => {
        result.current.goToNextStep()
      })

      const listener =
        mockAddListener.mock.calls[mockAddListener.mock.calls.length - 1][1]
      const event = { preventDefault: jest.fn() }
      listener(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(result.current.step).toBe(Step.Shipping)
    })

    it("does not prevent back navigation at step 1", () => {
      renderHook(() => useOrderCardFlow())

      const listener = mockAddListener.mock.calls[0][1]
      const event = { preventDefault: jest.fn() }
      listener(event)

      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })
})
