import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { LimitInput } from "@app/components/card-screen"
import { WalletCurrency } from "@app/graphql/generated"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    getCurrencySymbol: ({ currency }: { currency: string }) => {
      const symbols: Record<string, string> = {
        USD: "$",
        EUR: "€",
        JPY: "¥",
      }
      return symbols[currency] || currency
    },
    getFractionDigits: ({ currency }: { currency: string }) => {
      const digits: Record<string, number> = {
        USD: 2,
        EUR: 2,
        JPY: 0,
      }
      return digits[currency] ?? 2
    },
    currencyInfo: {},
  }),
}))

type MockModalProps = {
  children: React.ReactNode
  isVisible: boolean
}

jest.mock("react-native-modal", () => {
  const RNView = jest.requireActual<typeof import("react-native")>("react-native").View
  const MockModal = ({ children, isVisible }: MockModalProps) => {
    return isVisible ? <RNView testID="modal">{children}</RNView> : null
  }
  MockModal.displayName = "MockModal"
  return MockModal
})

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">{component}</TypesafeI18n>
    </ThemeProvider>,
  )
}

describe("LimitInput", () => {
  const mockOnChangeValue = jest.fn()

  const defaultProps = {
    label: "Daily Limit",
    value: "1000",
    helperText: "Maximum daily spending",
    onChangeValue: mockOnChangeValue,
  }

  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithProviders(<LimitInput {...defaultProps} />)
      expect(toJSON()).toBeTruthy()
    })

    it("displays label correctly", () => {
      const { getByText } = renderWithProviders(<LimitInput {...defaultProps} />)
      expect(getByText("Daily Limit")).toBeTruthy()
    })

    it("displays helper text correctly", () => {
      const { getByText } = renderWithProviders(<LimitInput {...defaultProps} />)
      expect(getByText("Maximum daily spending")).toBeTruthy()
    })

    it("displays formatted value with currency symbol", () => {
      const { getByText } = renderWithProviders(<LimitInput {...defaultProps} />)
      expect(getByText("$1,000")).toBeTruthy()
    })

    it("displays EUR symbol when currency is EUR", () => {
      const { getByText } = renderWithProviders(
        <LimitInput {...defaultProps} currency={"EUR" as WalletCurrency} />,
      )
      expect(getByText("€1,000")).toBeTruthy()
    })
  })

  describe("modal", () => {
    it("opens modal when pressed", () => {
      const { getByText, getByTestId } = renderWithProviders(
        <LimitInput {...defaultProps} />,
      )

      const pressable = getByText("$1,000")
      fireEvent.press(pressable)

      expect(getByTestId("modal")).toBeTruthy()
    })

    it("displays label in modal header", () => {
      const { getByText, getAllByText } = renderWithProviders(
        <LimitInput {...defaultProps} />,
      )

      fireEvent.press(getByText("$1,000"))

      const labels = getAllByText("Daily Limit")
      expect(labels.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("loading state", () => {
    it("disables pressable when loading", () => {
      const { getByRole } = renderWithProviders(
        <LimitInput {...defaultProps} loading={true} />,
      )
      const button = getByRole("button")
      expect(button.props.accessibilityState?.disabled).toBe(true)
    })

    it("does not open modal when loading", () => {
      const { getByText, queryByTestId } = renderWithProviders(
        <LimitInput {...defaultProps} loading={true} />,
      )
      fireEvent.press(getByText("$1,000"))
      expect(queryByTestId("modal")).toBeNull()
    })
  })

  describe("disabled state", () => {
    it("disables pressable when disabled", () => {
      const { getByRole } = renderWithProviders(
        <LimitInput {...defaultProps} disabled={true} />,
      )
      const button = getByRole("button")
      expect(button.props.accessibilityState?.disabled).toBe(true)
    })

    it("does not open modal when disabled", () => {
      const { getByText, queryByTestId } = renderWithProviders(
        <LimitInput {...defaultProps} disabled={true} />,
      )
      fireEvent.press(getByText("$1,000"))
      expect(queryByTestId("modal")).toBeNull()
    })
  })

  describe("confirm behavior", () => {
    it("does not call onChangeValue when value is unchanged", () => {
      const { getByText, getByRole } = renderWithProviders(
        <LimitInput {...defaultProps} />,
      )

      fireEvent.press(getByText("$1,000"))

      const confirmButton = getByRole("button", { name: /confirm/i })
      fireEvent.press(confirmButton)

      expect(mockOnChangeValue).not.toHaveBeenCalled()
    })

    it("calls onChangeValue when value changes", () => {
      const { getByText, getByRole } = renderWithProviders(
        <LimitInput {...defaultProps} />,
      )

      fireEvent.press(getByText("$1,000"))
      fireEvent.press(getByText("5"))

      const confirmButton = getByRole("button", { name: /confirm/i })
      fireEvent.press(confirmButton)

      expect(mockOnChangeValue).toHaveBeenCalled()
    })
  })

  describe("default props", () => {
    it("renders with only required props", () => {
      const { getByText } = renderWithProviders(
        <LimitInput label="Test" helperText="Helper" />,
      )
      expect(getByText("Test")).toBeTruthy()
      expect(getByText("Helper")).toBeTruthy()
      expect(getByText("$0")).toBeTruthy()
    })

    it("uses default currency USD", () => {
      const { getByText } = renderWithProviders(<LimitInput {...defaultProps} />)
      expect(getByText("$1,000")).toBeTruthy()
    })
  })
})
