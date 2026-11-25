import { act, renderHook } from "@testing-library/react-hooks"

import {
  useOrderCardFlow,
  Step,
} from "@app/screens/card-screen/order-card-screens/hooks/use-order-card-flow"

import { ShippingAddress } from "@app/screens/card-screen/types"

jest.mock("@app/utils/address-metadata", () => ({
  getRegionsByCountry: () => [{ value: "AL", label: "Alabama" }],
}))

const mockDeviceLocation = jest.fn(() => ({
  countryCode: "US",
  loading: false,
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => mockDeviceLocation(),
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
  countryCode: "US",
}

describe("useOrderCardFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAddListener.mockReturnValue(jest.fn())
    mockDeviceLocation.mockReturnValue({ countryCode: "US", loading: false })
  })

  describe("initial state with existing address", () => {
    it("starts at Step.Shipping", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      expect(result.current.step).toBe(Step.Shipping)
    })

    /** The KYC address is a choice, unticked by default (D42, D123). */
    it("starts without the KYC address chosen", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      expect(result.current.state.useKycAddress).toBe(false)
    })

    /** A new address, never the one on file: only the cardholder's name carries over. */
    it("starts the address form with the cardholder's name and empty lines", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      expect(result.current.state.customAddress).toEqual({
        firstName: "Satoshi",
        lastName: "Nakamoto",
        line1: "",
        line2: "",
        city: "",
        region: "AL",
        postalCode: "",
        countryCode: "US",
      })
    })
  })

  describe("toggleUseKycAddress", () => {
    it("chooses the KYC address, then lets it go", () => {
      const { result } = renderHook(() =>
        useOrderCardFlow({ initialAddress: mockAddress }),
      )

      act(() => {
        result.current.toggleUseKycAddress()
      })
      expect(result.current.state.useKycAddress).toBe(true)

      act(() => {
        result.current.toggleUseKycAddress()
      })
      expect(result.current.state.useKycAddress).toBe(false)
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
        countryCode: "US",
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
      act(() => {
        listener(event)
      })

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
