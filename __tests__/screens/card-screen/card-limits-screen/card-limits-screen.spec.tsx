import React from "react"
import { View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardLimitsScreen } from "@app/screens/card-screen/card-limits-screen"
import { CardStatus, CardType } from "@app/graphql/generated"
import { ContextForScreen } from "../../helper"

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    View,
    createAnimatedComponent: (component: React.ComponentType) => component,
  },
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  withTiming: (value: number) => value,
  interpolateColor: () => "transparent",
}))

jest.mock("react-native-modal", () => {
  const MockModal = ({
    isVisible,
    children,
  }: {
    isVisible: boolean
    children: React.ReactNode
  }) => {
    if (!isVisible) return null
    return <>{children}</>
  }
  return MockModal
})

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    getCurrencySymbol: ({ currency }: { currency: string }) => {
      const symbols: Record<string, string> = {
        USD: "$",
        EUR: "€",
      }
      return symbols[currency] || currency
    },
    getFractionDigits: ({ currency }: { currency: string }) => {
      const digits: Record<string, number> = {
        USD: 2,
        EUR: 2,
      }
      return digits[currency] ?? 2
    },
    currencyInfo: {},
  }),
}))

const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      goBack: mockGoBack,
    }),
  }
})

const mockUseCardData = jest.fn()
jest.mock("@app/screens/card-screen/hooks/use-card-data", () => ({
  useCardData: () => mockUseCardData(),
}))

const mockHandleUpdateDailyLimit = jest.fn()
const mockHandleUpdateMonthlyLimit = jest.fn()
jest.mock("@app/screens/card-screen/card-limits-screen/hooks/use-card-limits", () => ({
  useCardLimits: () => ({
    handleUpdateDailyLimit: mockHandleUpdateDailyLimit,
    handleUpdateMonthlyLimit: mockHandleUpdateMonthlyLimit,
    updatingField: null,
  }),
}))

const activeCard: {
  id: string
  lastFour: string
  status: CardStatus
  cardType: CardType
  createdAt: string
  dailyLimitCents: number | null
  monthlyLimitCents: number | null
} = {
  id: "card-1",
  lastFour: "4242",
  status: CardStatus.Active,
  cardType: CardType.Virtual,
  createdAt: "2025-04-23T12:00:00Z",
  dailyLimitCents: 100000,
  monthlyLimitCents: 500000,
}

const defaultCardData = {
  card: activeCard,
  loading: false,
  error: undefined,
  refetch: jest.fn(),
}

const setupMocks = (overrides?: { cardData?: Partial<typeof defaultCardData> }) => {
  mockUseCardData.mockReturnValue({ ...defaultCardData, ...overrides?.cardData })
}

describe("CardLimitsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    setupMocks()
  })

  describe("loading state", () => {
    it("renders loading indicator when card data is loading", () => {
      setupMocks({ cardData: { loading: true, card: undefined } })
      const { getByTestId } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByTestId("activity-indicator")).toBeTruthy()
    })
  })

  describe("no card", () => {
    it("navigates back when no card is available", () => {
      setupMocks({ cardData: { card: undefined } })
      render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(mockGoBack).toHaveBeenCalled()
    })
  })

  describe("current limits display", () => {
    it("displays daily spending limit formatted from cents", () => {
      const { getByText, getAllByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("Current limits")).toBeTruthy()
      expect(getAllByText("$1,000").length).toBeGreaterThanOrEqual(1)
    })

    it("displays monthly spending limit formatted from cents", () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getAllByText("$5,000").length).toBeGreaterThanOrEqual(1)
    })

    it("displays 'No limit' when daily limit is null", () => {
      setupMocks({
        cardData: { card: { ...activeCard, dailyLimitCents: null } },
      })
      const { getAllByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getAllByText("No limit").length).toBeGreaterThanOrEqual(1)
    })

    it("displays 'No limit' when monthly limit is null", () => {
      setupMocks({
        cardData: { card: { ...activeCard, monthlyLimitCents: null } },
      })
      const { getAllByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getAllByText("No limit").length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("spending limits section", () => {
    it("renders spending limits section", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("Spending limits")).toBeTruthy()
    })

    it("renders daily and monthly limit inputs", () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getAllByText("Daily spending").length).toBeGreaterThanOrEqual(1)
      expect(getAllByText("Monthly spending limits").length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("spending limits interaction", () => {
    it("opens daily limit modal when daily input is pressed", () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      const dailyInput = getByTestId("daily-limit-input")
      fireEvent.press(dailyInput.findByProps({ accessibilityRole: "button" }))
      expect(getByText("Confirm")).toBeTruthy()
    })

    it("opens monthly limit modal when monthly input is pressed", () => {
      const { getByTestId, getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      const monthlyInput = getByTestId("monthly-limit-input")
      fireEvent.press(monthlyInput.findByProps({ accessibilityRole: "button" }))
      expect(getByText("Confirm")).toBeTruthy()
    })

    it("displays helper texts for limit inputs", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("Maximum amount you can spend per day")).toBeTruthy()
      expect(getByText("Maximum amount you can spend per month")).toBeTruthy()
    })
  })

  describe("coming soon sections", () => {
    it("renders ATM limits and transaction types as disabled", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("Coming soon!")).toBeTruthy()
      expect(getByText("ATM withdrawal limits")).toBeTruthy()
      expect(getByText("Transaction types")).toBeTruthy()
      expect(getByText("Online purchases")).toBeTruthy()
      expect(getByText("Contactless payments")).toBeTruthy()
    })

    it("renders ATM limit inputs with helper texts", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("Daily ATM limits")).toBeTruthy()
      expect(getByText("Monthly ATM limit")).toBeTruthy()
      expect(getByText("Maximum ATM withdrawal per day")).toBeTruthy()
      expect(getByText("Maximum ATM withdrawal per month")).toBeTruthy()
    })

    it("renders transaction type switches", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("ATM withdrawals")).toBeTruthy()
    })
  })
})
