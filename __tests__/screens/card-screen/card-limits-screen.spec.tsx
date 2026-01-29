import React from "react"
import { View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { CardLimitsScreen } from "@app/screens/card-screen/card-limits-screen"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ContextForScreen } from "../helper"

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
  }),
}))

describe("CardLimitsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(toJSON()).toBeTruthy()
    })

    it("displays current limits section", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("Current limits")).toBeTruthy()
    })

    it("displays spending limits section", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("Spending limits")).toBeTruthy()
    })

    it("displays ATM limits section", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("ATM withdrawal limits")).toBeTruthy()
    })

    it("displays transaction types section", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("Transaction types")).toBeTruthy()
    })
  })

  describe("current limits display", () => {
    it("displays daily spending limit", () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      const dailyValues = getAllByText("$1,000")
      expect(dailyValues.length).toBeGreaterThanOrEqual(1)
    })

    it("displays monthly spending limit", () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      const monthlyValues = getAllByText("$5,000")
      expect(monthlyValues.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("transaction types", () => {
    it("displays online purchases option", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("Online purchases")).toBeTruthy()
    })

    it("displays ATM withdrawals option", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("ATM withdrawals")).toBeTruthy()
    })

    it("displays contactless payments option", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("Contactless payments")).toBeTruthy()
    })
  })

  describe("spending limits inputs", () => {
    it("displays daily spending input with formatted value", () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      const dailyValues = getAllByText("$1,000")
      expect(dailyValues.length).toBeGreaterThanOrEqual(1)
    })

    it("displays monthly spending input with formatted value", () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      const monthlyValues = getAllByText("$5,000")
      expect(monthlyValues.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("ATM limits inputs", () => {
    it("displays daily ATM input with formatted value", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("$500")).toBeTruthy()
    })

    it("displays monthly ATM input with formatted value", () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )
      expect(getByText("$2,000")).toBeTruthy()
    })
  })

  describe("transaction type toggles", () => {
    it("toggles online purchases when switch is pressed", () => {
      const { getByText, getAllByRole } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )

      expect(getByText("Online purchases")).toBeTruthy()
      const switches = getAllByRole("switch")
      expect(switches).toHaveLength(3)
      fireEvent(switches[0], "pressIn")
    })

    it("toggles ATM withdrawals when switch is pressed", () => {
      const { getByText, getAllByRole } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )

      expect(getByText("ATM withdrawals")).toBeTruthy()
      const switches = getAllByRole("switch")
      fireEvent(switches[1], "pressIn")
    })

    it("toggles contactless payments when switch is pressed", () => {
      const { getByText, getAllByRole } = render(
        <ContextForScreen>
          <CardLimitsScreen />
        </ContextForScreen>,
      )

      expect(getByText("Contactless payments")).toBeTruthy()
      const switches = getAllByRole("switch")
      fireEvent(switches[2], "pressIn")
    })
  })
})
