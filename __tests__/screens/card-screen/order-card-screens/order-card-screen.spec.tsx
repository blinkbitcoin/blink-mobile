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

jest.mock(
  "@app/utils/address-metadata",
  () =>
    jest.requireActual<typeof import("../helpers/mock-address-metadata")>(
      "../helpers/mock-address-metadata",
    ).mockAddressMetadata,
)

jest.mock("@app/screens/card-screen/utils", () => ({
  addressToLines: jest.requireActual<typeof import("../helpers/mock-address-utils")>(
    "../helpers/mock-address-utils",
  ).mockAddressToLines,
}))

jest.mock("@app/utils/helper", () => ({
  isIos: false,
}))

const mockCreateCard = jest.fn()
const mockGoBack = jest.fn()

const mockAddress = {
  firstName: "Satoshi",
  lastName: "Nakamoto",
  line1: "123 Main Street",
  line2: "Apt 4B",
  city: "New York",
  region: "NY",
  postalCode: "10001",
  countryCode: "US",
}

const mockUseCardData = jest.fn()
jest.mock("@app/hooks/use-card-data", () => ({
  useCardData: () => mockUseCardData(),
}))

const mockUseShippingAddressData = jest.fn()
jest.mock("@app/screens/card-screen/card-shipping-address-screen/hooks", () => ({
  useShippingAddressData: () => mockUseShippingAddressData(),
}))

jest.mock("@app/screens/card-screen/order-card-screens/hooks", () => {
  const actual = jest.requireActual("@app/screens/card-screen/order-card-screens/hooks")
  return {
    ...actual,
    useCreateCard: () => ({
      createCard: mockCreateCard,
      loading: false,
    }),
  }
})

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
      goBack: mockGoBack,
      addListener: mockAddListener,
    }),
  }
})

describe("OrderCardScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockAddListener.mockReturnValue(jest.fn())
    mockCreateCard.mockResolvedValue({ lastFour: "1234", cardType: "PHYSICAL" })
    mockUseCardData.mockReturnValue({
      card: { id: "card-1" },
      hasPhysicalCard: false,
      applicationId: "app-123",
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    })
    mockUseShippingAddressData.mockReturnValue({
      initialAddress: mockAddress,
      phone: "+1234567890",
      loading: false,
    })
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

    it("calls createCard and navigates to status screen on submit", async () => {
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

      expect(mockCreateCard).toHaveBeenCalledWith({
        applicationId: "app-123",
        shippingAddress: {
          firstName: "Satoshi",
          lastName: "Nakamoto",
          line1: "123 Main Street",
          line2: "Apt 4B",
          city: "New York",
          region: "NY",
          postalCode: "10001",
          countryCode: "US",
          phoneNumber: "+1234567890",
        },
      })

      expect(mockReplace).toHaveBeenCalledWith("cardStatusScreen", {
        title: "Your physical card is on the way!",
        subtitle: "Order for delivery of your Blink Card has been submitted.",
        buttonLabel: "Create PIN",
        navigateTo: "cardCreatePinScreen",
        iconName: "delivery",
        iconColor: expect.any(String),
        lastFour: "1234",
        cardId: "card-1",
      })
    })

    it("does not navigate when createCard fails", async () => {
      mockCreateCard.mockResolvedValue(null)

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

      expect(mockCreateCard).toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
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

  describe("loading state", () => {
    it("shows spinner when card data is loading", async () => {
      mockUseCardData.mockReturnValue({
        card: undefined,
        hasPhysicalCard: false,
        applicationId: null,
        loading: true,
        error: undefined,
        refetch: jest.fn(),
      })

      const { getByTestId, queryByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByTestId("activity-indicator")).toBeTruthy()
      expect(queryByText("Order your physical card")).toBeNull()
    })

    it("shows spinner when address data is loading", async () => {
      mockUseShippingAddressData.mockReturnValue({
        initialAddress: null,
        phone: "",
        loading: true,
      })

      const { getByTestId, queryByText } = render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByTestId("activity-indicator")).toBeTruthy()
      expect(queryByText("Order your physical card")).toBeNull()
    })
  })

  describe("error states", () => {
    it("navigates back when card query fails", async () => {
      mockUseCardData.mockReturnValue({
        card: undefined,
        hasPhysicalCard: false,
        applicationId: null,
        loading: false,
        error: new Error("Card query failed"),
        refetch: jest.fn(),
      })

      render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockGoBack).toHaveBeenCalled()
    })

    it("navigates back when applicationId is null", async () => {
      mockUseCardData.mockReturnValue({
        card: { id: "card-1" },
        hasPhysicalCard: false,
        applicationId: null,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      })

      render(
        <ContextForScreen>
          <OrderCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockGoBack).toHaveBeenCalled()
    })
  })
})
