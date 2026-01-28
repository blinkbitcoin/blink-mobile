import React from "react"
import { Text as RNText } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { CardBalanceSection } from "@app/components/card-screen/card-balance-section"

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        CardDashboard: {
          addFunds: () => "Add funds",
        },
      },
    },
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  makeStyles: () => () => ({
    container: {},
    balanceColumn: {},
    balanceUsd: {},
    balanceSecondary: {},
    addFundsButton: {},
    addFundsDisabled: {},
    addFundsText: {},
    primaryColor: { color: "#F7931A" },
  }),
}))

const renderWithProviders = (component: React.ReactElement) => {
  return render(component)
}

describe("CardBalanceSection", () => {
  const mockOnAddFunds = jest.fn()

  const defaultProps = {
    balanceUsd: "$29.42",
    balanceSecondary: "~ Kč576.44",
    isDisabled: false,
    onAddFunds: mockOnAddFunds,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithProviders(<CardBalanceSection {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the USD balance correctly", () => {
      const { getByText } = renderWithProviders(<CardBalanceSection {...defaultProps} />)

      expect(getByText("$29.42")).toBeTruthy()
    })

    it("displays the secondary balance correctly", () => {
      const { getByText } = renderWithProviders(<CardBalanceSection {...defaultProps} />)

      expect(getByText("~ Kč576.44")).toBeTruthy()
    })

    it("displays the add funds button text", () => {
      const { getByText } = renderWithProviders(<CardBalanceSection {...defaultProps} />)

      expect(getByText("Add funds")).toBeTruthy()
    })

    it("renders with different balance values", () => {
      const { getByText } = renderWithProviders(
        <CardBalanceSection
          {...defaultProps}
          balanceUsd="$1,234.56"
          balanceSecondary="~ €1,100.00"
        />,
      )

      expect(getByText("$1,234.56")).toBeTruthy()
      expect(getByText("~ €1,100.00")).toBeTruthy()
    })

    it("renders with zero balance", () => {
      const { getByText } = renderWithProviders(
        <CardBalanceSection
          {...defaultProps}
          balanceUsd="$0.00"
          balanceSecondary="~ €0.00"
        />,
      )

      expect(getByText("$0.00")).toBeTruthy()
      expect(getByText("~ €0.00")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("calls onAddFunds when button is pressed and not disabled", () => {
      const { getByText } = renderWithProviders(<CardBalanceSection {...defaultProps} />)

      const addFundsButton = getByText("Add funds")
      fireEvent.press(addFundsButton)

      expect(mockOnAddFunds).toHaveBeenCalledTimes(1)
    })

    it("does not call onAddFunds when button is pressed and disabled", () => {
      const { getByText } = renderWithProviders(
        <CardBalanceSection {...defaultProps} isDisabled={true} />,
      )

      const addFundsButton = getByText("Add funds")
      fireEvent.press(addFundsButton)

      expect(mockOnAddFunds).not.toHaveBeenCalled()
    })

    it("calls onAddFunds multiple times on multiple presses", () => {
      const { getByText } = renderWithProviders(<CardBalanceSection {...defaultProps} />)

      const addFundsButton = getByText("Add funds")
      fireEvent.press(addFundsButton)
      fireEvent.press(addFundsButton)
      fireEvent.press(addFundsButton)

      expect(mockOnAddFunds).toHaveBeenCalledTimes(3)
    })
  })

  describe("disabled state", () => {
    it("renders in disabled state without crashing", () => {
      const { toJSON } = renderWithProviders(
        <CardBalanceSection {...defaultProps} isDisabled={true} />,
      )

      expect(toJSON()).toBeTruthy()
    })

    it("still displays balances when disabled", () => {
      const { getByText } = renderWithProviders(
        <CardBalanceSection {...defaultProps} isDisabled={true} />,
      )

      expect(getByText("$29.42")).toBeTruthy()
      expect(getByText("~ Kč576.44")).toBeTruthy()
    })

    it("still displays add funds button when disabled", () => {
      const { getByText } = renderWithProviders(
        <CardBalanceSection {...defaultProps} isDisabled={true} />,
      )

      expect(getByText("Add funds")).toBeTruthy()
    })
  })
})
