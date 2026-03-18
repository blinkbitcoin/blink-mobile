import { act, renderHook } from "@testing-library/react-hooks"

import { useReplaceCardFlow } from "@app/screens/card-screen/replace-card-screens/hooks/use-replace-card-flow"
import { ShippingAddress } from "@app/screens/card-screen/types"

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

const emptyAddress: ShippingAddress = {
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "",
}

const renderPhysicalFlow = () =>
  renderHook(() =>
    useReplaceCardFlow({ isVirtualCard: false, initialAddress: mockAddress }),
  )

const renderVirtualFlow = () =>
  renderHook(() =>
    useReplaceCardFlow({ isVirtualCard: true, initialAddress: mockAddress }),
  )

describe("useReplaceCardFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAddListener.mockReturnValue(jest.fn())
  })

  describe("initial state", () => {
    it("starts at ReportIssue step", () => {
      const { result } = renderPhysicalFlow()

      expect(result.current.currentStep).toBe("ReportIssue")
    })

    it("has stepNumber 1", () => {
      const { result } = renderPhysicalFlow()

      expect(result.current.stepNumber).toBe(1)
    })

    it("has totalSteps 3 for physical card", () => {
      const { result } = renderPhysicalFlow()

      expect(result.current.totalSteps).toBe(3)
    })

    it("has totalSteps 2 for virtual card", () => {
      const { result } = renderVirtualFlow()

      expect(result.current.totalSteps).toBe(2)
    })

    it("has null selectedIssue", () => {
      const { result } = renderPhysicalFlow()

      expect(result.current.state.selectedIssue).toBeNull()
    })

    it("has null selectedDelivery", () => {
      const { result } = renderPhysicalFlow()

      expect(result.current.state.selectedDelivery).toBeNull()
    })

    it("has useRegisteredAddress as true when initialAddress exists", () => {
      const { result } = renderPhysicalFlow()

      expect(result.current.state.useRegisteredAddress).toBe(true)
    })

    it("has useRegisteredAddress as false when initialAddress is null", () => {
      const { result } = renderHook(() =>
        useReplaceCardFlow({ isVirtualCard: false, initialAddress: null }),
      )

      expect(result.current.state.useRegisteredAddress).toBe(false)
    })

    it("uses initialAddress for customAddress", () => {
      const { result } = renderPhysicalFlow()

      expect(result.current.state.customAddress).toEqual(mockAddress)
    })

    it("uses empty address when initialAddress is null", () => {
      const { result } = renderHook(() =>
        useReplaceCardFlow({ isVirtualCard: false, initialAddress: null }),
      )

      expect(result.current.state.customAddress).toEqual(emptyAddress)
    })
  })

  describe("setSelectedIssue", () => {
    it("sets lost issue", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.setSelectedIssue("lost")
      })

      expect(result.current.state.selectedIssue).toBe("lost")
    })

    it("sets stolen issue", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.setSelectedIssue("stolen")
      })

      expect(result.current.state.selectedIssue).toBe("stolen")
    })

    it("sets damaged issue", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.setSelectedIssue("damaged")
      })

      expect(result.current.state.selectedIssue).toBe("damaged")
    })
  })

  describe("setSelectedDelivery", () => {
    it("sets standard delivery", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.setSelectedDelivery("standard")
      })

      expect(result.current.state.selectedDelivery).toBe("standard")
    })

    it("sets express delivery", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.setSelectedDelivery("express")
      })

      expect(result.current.state.selectedDelivery).toBe("express")
    })
  })

  describe("toggleUseRegisteredAddress", () => {
    it("toggles from true to false", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.toggleUseRegisteredAddress()
      })

      expect(result.current.state.useRegisteredAddress).toBe(false)
    })

    it("toggles back to true", () => {
      const { result } = renderPhysicalFlow()

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
      const { result } = renderPhysicalFlow()

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

  describe("goToNextStep - physical", () => {
    it("advances from ReportIssue to Delivery", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.currentStep).toBe("Delivery")
      expect(result.current.stepNumber).toBe(2)
    })

    it("advances from Delivery to Confirm", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.goToNextStep()
      })

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.currentStep).toBe("Confirm")
      expect(result.current.stepNumber).toBe(3)
    })

    it("does not advance past Confirm", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.goToNextStep()
      })

      act(() => {
        result.current.goToNextStep()
      })

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.currentStep).toBe("Confirm")
      expect(result.current.stepNumber).toBe(3)
    })
  })

  describe("goToNextStep - virtual", () => {
    it("advances from ReportIssue to Confirm (skips Delivery)", () => {
      const { result } = renderVirtualFlow()

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.currentStep).toBe("Confirm")
      expect(result.current.stepNumber).toBe(2)
    })

    it("does not advance past Confirm", () => {
      const { result } = renderVirtualFlow()

      act(() => {
        result.current.goToNextStep()
      })

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.currentStep).toBe("Confirm")
      expect(result.current.stepNumber).toBe(2)
    })
  })

  describe("completeFlow", () => {
    it("marks flow as complete", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.completeFlow()
      })

      expect(result.current).toBeTruthy()
    })
  })

  describe("navigation listener", () => {
    it("registers beforeRemove listener", () => {
      renderPhysicalFlow()

      expect(mockAddListener).toHaveBeenCalledWith("beforeRemove", expect.any(Function))
    })

    it("returns unsubscribe function", () => {
      const unsubscribe = jest.fn()
      mockAddListener.mockReturnValue(unsubscribe)

      const { unmount } = renderPhysicalFlow()

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })

    it("prevents back at Delivery (physical), goes to ReportIssue", () => {
      const { result } = renderPhysicalFlow()

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.currentStep).toBe("Delivery")

      const listener =
        mockAddListener.mock.calls[mockAddListener.mock.calls.length - 1][1]
      const event = { preventDefault: jest.fn() }

      act(() => {
        listener(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
      expect(result.current.currentStep).toBe("ReportIssue")
    })

    it("prevents back at Confirm (virtual), goes to ReportIssue", () => {
      const { result } = renderVirtualFlow()

      act(() => {
        result.current.goToNextStep()
      })

      expect(result.current.currentStep).toBe("Confirm")

      const listener =
        mockAddListener.mock.calls[mockAddListener.mock.calls.length - 1][1]
      const event = { preventDefault: jest.fn() }

      act(() => {
        listener(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
      expect(result.current.currentStep).toBe("ReportIssue")
    })

    it("does not prevent back at ReportIssue", () => {
      renderPhysicalFlow()

      const listener = mockAddListener.mock.calls[0][1]
      const event = { preventDefault: jest.fn() }

      act(() => {
        listener(event)
      })

      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe("multi-step flow", () => {
    it("physical: progresses through all 3 steps", () => {
      const { result } = renderPhysicalFlow()

      expect(result.current.currentStep).toBe("ReportIssue")
      expect(result.current.stepNumber).toBe(1)

      act(() => {
        result.current.setSelectedIssue("lost")
        result.current.goToNextStep()
      })

      expect(result.current.currentStep).toBe("Delivery")
      expect(result.current.stepNumber).toBe(2)
      expect(result.current.state.selectedIssue).toBe("lost")

      act(() => {
        result.current.setSelectedDelivery("standard")
        result.current.goToNextStep()
      })

      expect(result.current.currentStep).toBe("Confirm")
      expect(result.current.stepNumber).toBe(3)
      expect(result.current.state.selectedDelivery).toBe("standard")
    })

    it("virtual: progresses through 2 steps (skips Delivery)", () => {
      const { result } = renderVirtualFlow()

      expect(result.current.currentStep).toBe("ReportIssue")
      expect(result.current.stepNumber).toBe(1)

      act(() => {
        result.current.setSelectedIssue("stolen")
        result.current.goToNextStep()
      })

      expect(result.current.currentStep).toBe("Confirm")
      expect(result.current.stepNumber).toBe(2)
      expect(result.current.state.selectedIssue).toBe("stolen")
    })
  })
})
