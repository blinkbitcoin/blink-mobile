import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ReplaceCardScreen } from "@app/screens/card-screen/replace-card-screens/replace-card-screen"
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

describe("ReplaceCardScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockAddListener.mockReturnValue(jest.fn())
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("renders at step 1 with report issue content", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Report card Issue")).toBeTruthy()
    })

    it("displays continue button", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Continue")).toBeTruthy()
    })
  })

  describe("step 1 - report issue", () => {
    it("displays issue options", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Lost card")).toBeTruthy()
      expect(getByText("Stolen card")).toBeTruthy()
      expect(getByText("Damaged card")).toBeTruthy()
    })

    it("selects an issue and advances to step 2", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Lost card"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(getByText("Delivery options")).toBeTruthy()
    })
  })

  describe("step 2 - delivery", () => {
    const advanceToStep2 = async (getByText: ReturnType<typeof render>["getByText"]) => {
      await act(async () => {
        fireEvent.press(getByText("Lost card"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })
    }

    it("displays delivery options", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await advanceToStep2(getByText)

      expect(getByText("Standard delivery")).toBeTruthy()
      expect(getByText("Express delivery")).toBeTruthy()
    })

    it("selects delivery and advances to step 3", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await advanceToStep2(getByText)

      await act(async () => {
        fireEvent.press(getByText("Standard delivery"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(getByText("Confirm replacement")).toBeTruthy()
    })
  })

  describe("step 3 - confirm", () => {
    const advanceToStep3 = async (getByText: ReturnType<typeof render>["getByText"]) => {
      await act(async () => {
        fireEvent.press(getByText("Lost card"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      await act(async () => {
        fireEvent.press(getByText("Standard delivery"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })
    }

    it("displays confirm content", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await advanceToStep3(getByText)

      expect(getByText("Confirm replacement")).toBeTruthy()
      expect(getByText("Request summary")).toBeTruthy()
    })

    it("submits and navigates to status screen", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await advanceToStep3(getByText)

      await act(async () => {
        fireEvent.press(getByText("Submit request"))
      })

      expect(mockReplace).toHaveBeenCalledWith("cardStatusScreen", {
        title: "Your new card is on the way!",
        subtitle: "Order for delivery of your Blink Card has been submitted.",
        buttonLabel: "Dashboard",
        navigateTo: "cardDashboardScreen",
        iconName: "delivery",
        iconColor: expect.any(String),
      })
    })
  })

  describe("complete flow", () => {
    it("navigates through all steps and submits", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Report card Issue")).toBeTruthy()

      await act(async () => {
        fireEvent.press(getByText("Damaged card"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(getByText("Delivery options")).toBeTruthy()

      await act(async () => {
        fireEvent.press(getByText("Express delivery"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(getByText("Confirm replacement")).toBeTruthy()

      await act(async () => {
        fireEvent.press(getByText("Submit request"))
      })

      expect(mockReplace).toHaveBeenCalledTimes(1)
    })
  })
})
