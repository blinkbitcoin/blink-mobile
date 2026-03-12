import { act, renderHook } from "@testing-library/react-hooks"

import {
  useOrderCardFlow,
  Step,
} from "@app/screens/card-screen/order-card-screens/hooks/use-order-card-flow"

import { ShippingAddress } from "@app/screens/card-screen/types"

jest.mock("@app/screens/card-screen/country-region-data", () => ({
  SUPPORTED_COUNTRIES: [
    { value: "USA", label: "United States", isoAlpha2: "US", regions: [] },
  ],
  getRegionsByCountry: () => [{ value: "AL", label: "Alabama" }],
}))

const mockAddListener = jest.fn()
const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    addListener: mockAddListener,
  }),
}))

const mockAddress: ShippingAddress = {
  firstName: "Satoshi",
  lastName: "Nakamoto",
  line1: "123 Main Street",
  line2: "Apt 4B",
  city: "New York",
  region: "NY",
  postalCode: "10001",
  countryCode: "USA",
}

describe("useOrderCardFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAddListener.mockReturnValue(jest.fn())
  })

  describe("initial state with existing address", () => {
    it("starts at Step.Shipping", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      expect(result.current.step).toBe(Step.Shipping)
    })

    it("has selectedDelivery as standard", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      expect(result.current.state.selectedDelivery).toBe("standard")
    })

    it("has useRegisteredAddress as true when address exists", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      expect(result.current.state.useRegisteredAddress).toBe(true)
    })

    it("has customAddress from initial address", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      expect(result.current.state.customAddress).toEqual(mockAddress)
    })
  })

  describe("initial state with null address", () => {
    it("has useRegisteredAddress as false when no address", () => {
      const { result } = renderHook(() => useOrderCardFlow({ initialAddress: null }))

      expect(result.current.state.useRegisteredAddress).toBe(false)
    })

    it("has default customAddress with country and region when no address", () => {
      const { result } = renderHook(() => useOrderCardFlow({ initialAddress: null }))

      expect(result.current.state.customAddress).toEqual({
        firstName: "",
        lastName: "",
        line1: "",
        line2: "",
        city: "",
        region: "AL",
        postalCode: "",
        countryCode: "USA",
      })
    })
  })

  describe("toggleUseRegisteredAddress", () => {
    it("toggles from true to false", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      act(() => {
        result.current.toggleUseRegisteredAddress()
      })

      expect(result.current.state.useRegisteredAddress).toBe(false)
    })

    it("toggles back to true", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

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
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      const newAddress: ShippingAddress = {
        firstName: "Joe",
        lastName: "Nakamoto",
        line1: "456 Oak Avenue",
        line2: "",
        city: "Austin",
        region: "TX",
        postalCode: "73301",
        countryCode: "USA",
      }

      act(() => {
        result.current.setCustomAddress(newAddress)
      })

      expect(result.current.state.customAddress).toEqual(newAddress)
    })
  })

  describe("goToNextStep", () => {
    it("advances from step 1 to step 2", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.step).toBe(Step.Confirm)
    })

    it("does not advance past step 2", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

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
    it("allows navigation after completing flow", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      act(() => {
        result.current.goToNextStep()
      })

      act(() => {
        result.current.completeFlow()
      })

      const listener =
        mockAddListener.mock.calls[mockAddListener.mock.calls.length - 1][1]
      const event = { preventDefault: jest.fn() }
      listener(event)

      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe("navigation listener", () => {
    it("registers beforeRemove listener on mount", () => {
      renderHook(() => useOrderCardFlow({ initialAddress: mockAddress }))

      expect(mockAddListener).toHaveBeenCalledWith("beforeRemove", expect.any(Function))
    })

    it("returns unsubscribe function", () => {
      const unsubscribe = jest.fn()
      mockAddListener.mockReturnValue(unsubscribe)

      const { unmount } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })

    it("prevents back navigation at step 2", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

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
      renderHook(() => useOrderCardFlow({ initialAddress: mockAddress }))

      const listener = mockAddListener.mock.calls[0][1]
      const event = { preventDefault: jest.fn() }
      listener(event)

      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })
})
