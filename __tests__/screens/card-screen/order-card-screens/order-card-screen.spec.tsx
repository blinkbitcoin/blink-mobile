import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { OrderCardScreen } from "@app/screens/card-screen/order-card-screens/order-card-screen"
import { ContextForScreen } from "../../helper"

jest.mock("react-native-reanimated", () => {
  const RNView = jest.requireActual<typeof import("react-native")>("react-native").View
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    interpolateColor: () => "transparent",
  }
})

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    replaceCardDeliveryConfig: {
      standard: { minDays: 7, maxDays: 10, priceUsd: 0 },
      express: { minDays: 1, maxDays: 2, priceUsd: 15 },
    },
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: ({
      amountInMajorUnits,
    }: {
      amountInMajorUnits: number
      currency: string
    }) => `$${amountInMajorUnits.toFixed(2)}`,
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
  shippingAddressToLines: (
    address: {
      addressLine1: string
      addressLine2: string
      city: string
      state: string
      postalCode: string
      country: string
    },
    includeFullName: boolean,
  ) => {
    const lines: string[] = []
    if (includeFullName) lines.push("Satoshi Nakamoto")
    lines.push(address.addressLine1)
    if (address.addressLine2) lines.push(address.addressLine2)
    lines.push(`${address.city}, ${address.state} ${address.postalCode}`)
    lines.push(address.country)
    return lines
  },
  US_STATES: [{ value: "NY", label: "New York" }],
  COUNTRIES: [{ value: "USA", label: "United States" }],
}))

jest.mock("@app/utils/helper", () => ({
  isIos: false,
}))

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockAddListener = jest.fn().mockReturnValue(jest.fn())

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      replace: mockReplace,
      addListener: mockAddListener,
    }),
  }
})

describe("OrderCardScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockAddListener.mockReturnValue(jest.fn())
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("renders at step 1 with shipping content", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Order your physical card")).toBeTruthy()
    })

    it("displays continue button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Continue")).toBeTruthy()
    })
  })

  describe("step 1 - shipping", () => {
    it("displays registered address", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Registered address")).toBeTruthy()
      expect(getByText("123 Main Street")).toBeTruthy()
    })

    it("displays standard delivery", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Standard delivery")).toBeTruthy()
      expect(getByText("7-10 business days")).toBeTruthy()
    })

    it("advances to step 2 on continue press", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(getByText("Confirm your order")).toBeTruthy()
    })
  })

  describe("step 2 - confirm", () => {
    const advanceToStep2 = async (getByText: ReturnType<typeof render>["getByText"]) => {
      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })
    }

    it("displays confirm content", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await advanceToStep2(getByText)

      expect(getByText("Confirm your order")).toBeTruthy()
      expect(getByText("Order summary")).toBeTruthy()
    })

    it("displays place order button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await advanceToStep2(getByText)

      expect(getByText("Place order")).toBeTruthy()
    })

    it("submits and navigates to status screen", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await advanceToStep2(getByText)

      await act(async () => {
        fireEvent.press(getByText("Place order"))
      })

      expect(mockReplace).toHaveBeenCalledWith("cardStatusScreen", {
        title: "Your physical card is on the way!",
        subtitle: "Order for delivery of your Blink Card has been submitted.",
        buttonLabel: "Create PIN",
        navigateTo: "cardCreatePinScreen",
        iconName: "delivery",
        iconColor: expect.any(String),
      })
    })
  })

  describe("complete flow", () => {
    it("navigates through all steps and submits", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Order your physical card")).toBeTruthy()

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(getByText("Confirm your order")).toBeTruthy()

      await act(async () => {
        fireEvent.press(getByText("Place order"))
      })

      expect(mockReplace).toHaveBeenCalledTimes(1)
    })
  })
})
