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

jest.mock("postcode-validator", () => ({
  postcodeValidator: () => true,
  postcodeValidatorExistsForCountry: () => true,
}))

jest.mock("@app/utils/country-region-data", () => ({
  getAllCountries: () => [{ value: "US", label: "United States" }],
  getRegionsByCountry: () => [{ value: "NY", label: "New York" }],
  getCountryLabel: (code: string) => (code === "US" ? "United States" : code),
}))

jest.mock("@app/screens/card-screen/utils", () => ({
  addressToLines: jest.requireActual<typeof import("../helpers/mock-address-utils")>(
    "../helpers/mock-address-utils",
  ).mockAddressToLines,
}))

jest.mock("@app/utils/helper", () => ({
  isIos: false,
}))

const mockCardReplace = jest.fn()
const mockLockCard = jest.fn()

jest.mock("@app/screens/card-screen/hooks", () => ({
  useCardData: () => ({ card: { id: "card-123", cardType: "PHYSICAL" } }),
}))

jest.mock("@app/screens/card-screen/card-shipping-address-screen/hooks", () => ({
  useShippingAddressData: () => ({
    initialAddress: {
      firstName: "Satoshi",
      lastName: "Nakamoto",
      line1: "123 Main Street",
      line2: "Apt 4B",
      city: "New York",
      region: "NY",
      postalCode: "10001",
      countryCode: "US",
    },
    loading: false,
  }),
}))

jest.mock("@app/screens/card-screen/replace-card-screens/hooks", () => ({
  ...jest.requireActual("@app/screens/card-screen/replace-card-screens/hooks"),
  useReplaceCard: () => ({ replaceCard: mockCardReplace, loading: false }),
  useLockCard: () => ({ lockCard: mockLockCard, loading: false }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  CardType: { Virtual: "VIRTUAL", Physical: "PHYSICAL" },
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
    useRoute: () => ({ params: { cardId: "card-123" } }),
  }
})

describe("ReplaceCardScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockAddListener.mockReturnValue(jest.fn())
    mockCardReplace.mockResolvedValue({ lastFour: "4321", cardType: "VIRTUAL" })
    mockLockCard.mockResolvedValue(true)
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

    it("selects Damaged and advances to step 2 (delivery for physical)", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Damaged card"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(getByText("Delivery options")).toBeTruthy()
    })
  })

  describe("lock on lost/stolen", () => {
    it("calls lockCard when Lost selected and Continue pressed", async () => {
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

      expect(mockLockCard).toHaveBeenCalledWith("card-123")

      expect(getByText("Delivery options")).toBeTruthy()
    })

    it("calls lockCard when Stolen selected", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Stolen card"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(mockLockCard).toHaveBeenCalledWith("card-123")

      expect(getByText("Delivery options")).toBeTruthy()
    })

    it("does NOT call lockCard when Damaged selected", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <ReplaceCardScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByText("Damaged card"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(mockLockCard).not.toHaveBeenCalled()
    })

    it("stays on step 1 when lock fails", async () => {
      mockLockCard.mockResolvedValueOnce(false)

      const { getByText, queryByText } = render(
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

      expect(mockLockCard).toHaveBeenCalledWith("card-123")
      expect(queryByText("Delivery options")).toBeNull()
      expect(getByText("Report card Issue")).toBeTruthy()
    })
  })

  describe("step 2 - delivery (physical)", () => {
    const advanceToStep2 = async (getByText: ReturnType<typeof render>["getByText"]) => {
      await act(async () => {
        fireEvent.press(getByText("Damaged card"))
      })

      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })
    }

    it("displays delivery options after advancing from step 1", async () => {
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
  })

  describe("step 3 - confirm", () => {
    const advanceToStep3 = async (getByText: ReturnType<typeof render>["getByText"]) => {
      await act(async () => {
        fireEvent.press(getByText("Damaged card"))
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

    it("displays confirm content after completing flow", async () => {
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
      mockCardReplace.mockResolvedValueOnce({ lastFour: "4321", cardType: "VIRTUAL" })

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

      expect(mockCardReplace).toHaveBeenCalledWith("card-123")
      expect(mockReplace).toHaveBeenCalledWith("cardStatusScreen", {
        title: "Your new card is on the way!",
        subtitle: "Order for delivery of your Blink Card has been submitted.",
        buttonLabel: "Dashboard",
        navigateTo: "cardDashboardScreen",
        iconName: "delivery",
        iconColor: expect.any(String),
        lastFour: "4321",
      })
    })

    it("stays on screen when replace fails", async () => {
      mockCardReplace.mockResolvedValueOnce(null)

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

      expect(mockCardReplace).toHaveBeenCalledWith("card-123")
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  describe("virtual card flow", () => {
    beforeEach(() => {
      jest
        .spyOn(
          jest.requireMock("@app/screens/card-screen/hooks") as {
            useCardData: () => { card: { id: string; cardType: string } }
          },
          "useCardData",
        )
        .mockReturnValue({ card: { id: "card-123", cardType: "VIRTUAL" } })
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it("skips delivery step: ReportIssue then Confirm directly", async () => {
      const { getByText, queryByText } = render(
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

      expect(queryByText("Delivery options")).toBeNull()
      expect(getByText("Confirm replacement")).toBeTruthy()
    })
  })
})
