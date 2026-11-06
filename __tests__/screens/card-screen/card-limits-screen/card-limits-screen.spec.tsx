import React from "react"
import { ActivityIndicator } from "react-native"
import type { ReactTestInstance } from "react-test-renderer"
import { render, fireEvent, within } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardLimitsScreen } from "@app/screens/card-screen/card-limits-screen"
import { CardStatus, CardType, SpendingPeriod } from "@app/graphql/generated"
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

const mockUseCardAtmControls = jest.fn()
jest.mock(
  "@app/screens/card-screen/card-limits-screen/hooks/use-card-atm-controls",
  () => ({
    useCardAtmControls: () => mockUseCardAtmControls(),
  }),
)

const mockHandleUpdateAtmDailyLimit = jest.fn()
const mockHandleUpdateAtmMonthlyLimit = jest.fn()
const mockHandleToggleAtm = jest.fn()
const defaultAtmControls = {
  atmDailyLimitCents: null,
  atmMonthlyLimitCents: 50000,
  isAtmEnabled: true,
  hasAtmControls: true,
  loading: false,
  updatingAtmLimit: null,
  isTogglingAtm: false,
  handleUpdateAtmDailyLimit: mockHandleUpdateAtmDailyLimit,
  handleUpdateAtmMonthlyLimit: mockHandleUpdateAtmMonthlyLimit,
  handleToggleAtm: mockHandleToggleAtm,
}

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

type AtmControls = Omit<
  typeof defaultAtmControls,
  "atmDailyLimitCents" | "atmMonthlyLimitCents" | "updatingAtmLimit"
> & {
  atmDailyLimitCents: number | null
  atmMonthlyLimitCents: number | null
  updatingAtmLimit: SpendingPeriod | null
}

const setupMocks = (overrides?: {
  cardData?: Partial<typeof defaultCardData>
  atmControls?: Partial<AtmControls>
}) => {
  mockUseCardData.mockReturnValue({ ...defaultCardData, ...overrides?.cardData })
  mockUseCardAtmControls.mockReturnValue({
    ...defaultAtmControls,
    ...overrides?.atmControls,
  })
}

const renderScreen = () =>
  render(
    <ContextForScreen>
      <CardLimitsScreen />
    </ContextForScreen>,
  )

const spinnersIn = (field: ReactTestInstance) =>
  within(field).UNSAFE_queryAllByType(ActivityIndicator)

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
    it("calls handleUpdateDailyLimit when daily field loses focus with a new value", () => {
      const { getByLabelText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      const dailyField = getByLabelText("Daily spending")
      fireEvent.changeText(dailyField, "2000")
      fireEvent(dailyField, "blur")
      expect(mockHandleUpdateDailyLimit).toHaveBeenCalledWith("2000")
    })

    it("does not call handleUpdateDailyLimit when value is unchanged on blur", () => {
      const { getByLabelText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      fireEvent(getByLabelText("Daily spending"), "blur")
      expect(mockHandleUpdateDailyLimit).not.toHaveBeenCalled()
    })

    it("calls handleUpdateMonthlyLimit when monthly field loses focus with a new value", () => {
      const { getByLabelText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      const monthlyField = getByLabelText("Monthly spending limits")
      fireEvent.changeText(monthlyField, "8000")
      fireEvent(monthlyField, "blur")
      expect(mockHandleUpdateMonthlyLimit).toHaveBeenCalledWith("8000")
    })

    it("saves spending limits for a card that has none yet", () => {
      setupMocks({
        cardData: {
          card: { ...activeCard, dailyLimitCents: null, monthlyLimitCents: null },
        },
      })
      const { getByLabelText } = renderScreen()

      const dailyField = getByLabelText("Daily spending")
      fireEvent.changeText(dailyField, "150")
      fireEvent(dailyField, "blur")
      const monthlyField = getByLabelText("Monthly spending limits")
      fireEvent.changeText(monthlyField, "900")
      fireEvent(monthlyField, "blur")

      expect(mockHandleUpdateDailyLimit).toHaveBeenCalledWith("150")
      expect(mockHandleUpdateMonthlyLimit).toHaveBeenCalledWith("900")
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

  describe("ATM controls", () => {
    it("waits for the ATM controls before showing the limits", () => {
      setupMocks({ atmControls: { loading: true } })

      const { getByTestId, queryByText } = renderScreen()

      expect(getByTestId("activity-indicator")).toBeTruthy()
      expect(queryByText("ATM withdrawal limits")).toBeNull()
    })

    it("shows the ATM limit inputs with their helper texts", () => {
      const { getByText } = renderScreen()

      expect(getByText("ATM withdrawal limits")).toBeTruthy()
      expect(getByText("Maximum ATM withdrawal per day")).toBeTruthy()
      expect(getByText("Maximum ATM withdrawal per month")).toBeTruthy()
    })

    it("shows No limit for an unset ATM limit and the amount of a set one", () => {
      const { getByLabelText } = renderScreen()

      const dailyField = getByLabelText("Daily ATM limits")
      expect(dailyField.props.value).toBe("")
      expect(dailyField.props.placeholder).toBe("No limit")
      expect(getByLabelText("Monthly ATM limit").props.value).toBe("$500")
    })

    it("saves the daily ATM limit when its field loses focus", () => {
      const { getByLabelText } = renderScreen()

      const dailyField = getByLabelText("Daily ATM limits")
      fireEvent.changeText(dailyField, "300")
      fireEvent(dailyField, "blur")

      expect(mockHandleUpdateAtmDailyLimit).toHaveBeenCalledWith("300")
    })

    it("saves the monthly ATM limit when its field loses focus", () => {
      const { getByLabelText } = renderScreen()

      const monthlyField = getByLabelText("Monthly ATM limit")
      fireEvent.changeText(monthlyField, "")
      fireEvent(monthlyField, "blur")

      expect(mockHandleUpdateAtmMonthlyLimit).toHaveBeenCalledWith("")
    })

    it("turns ATM withdrawals off from its switch", () => {
      const { getByRole } = renderScreen()

      fireEvent(getByRole("switch", { name: "ATM withdrawals" }), "pressIn")

      expect(mockHandleToggleAtm).toHaveBeenCalledWith(false)
    })

    it("shows ATM withdrawals as off when the card turned them off", () => {
      setupMocks({ atmControls: { isAtmEnabled: false } })

      const { getByRole } = renderScreen()

      expect(
        getByRole("switch", { name: "ATM withdrawals" }).props.accessibilityState.checked,
      ).toBe(false)
    })

    it("locks both ATM limits while one of them saves", () => {
      setupMocks({ atmControls: { updatingAtmLimit: SpendingPeriod.Daily } })

      const { getByLabelText, getByTestId } = renderScreen()

      expect(getByLabelText("Daily ATM limits").props.editable).toBe(false)
      expect(getByLabelText("Monthly ATM limit").props.editable).toBe(false)
      expect(spinnersIn(getByTestId("atm-daily-limit-input"))).toHaveLength(1)
      expect(spinnersIn(getByTestId("atm-monthly-limit-input"))).toHaveLength(0)
    })

    it("shows the monthly ATM limit as the one saving", () => {
      setupMocks({ atmControls: { updatingAtmLimit: SpendingPeriod.Monthly } })

      const { getByTestId } = renderScreen()

      expect(spinnersIn(getByTestId("atm-monthly-limit-input"))).toHaveLength(1)
      expect(spinnersIn(getByTestId("atm-daily-limit-input"))).toHaveLength(0)
    })

    it("locks the ATM switch while it saves", () => {
      setupMocks({ atmControls: { isTogglingAtm: true } })

      const { getByRole } = renderScreen()

      const atmSwitch = getByRole("switch", { name: "ATM withdrawals" })
      fireEvent(atmSwitch, "pressIn")

      expect(atmSwitch.props.accessibilityState.disabled).toBe(true)
      expect(mockHandleToggleAtm).not.toHaveBeenCalled()
    })

    it("locks every ATM control when they could not be loaded", () => {
      setupMocks({ atmControls: { hasAtmControls: false } })

      const { getByRole, getByLabelText } = renderScreen()

      expect(
        getByRole("switch", { name: "ATM withdrawals" }).props.accessibilityState
          .disabled,
      ).toBe(true)
      expect(getByLabelText("Daily ATM limits").props.editable).toBe(false)
      expect(getByLabelText("Monthly ATM limit").props.editable).toBe(false)
    })
  })

  describe("coming soon section", () => {
    it("keeps online and contactless payments as coming soon", () => {
      const { getByText, getByRole } = renderScreen()

      expect(getByText("Coming soon!")).toBeTruthy()
      expect(getByText("Transaction types")).toBeTruthy()
      expect(getByRole("switch", { name: "Online purchases" })).toBeTruthy()
      expect(getByRole("switch", { name: "Contactless payments" })).toBeTruthy()
    })
  })
})
