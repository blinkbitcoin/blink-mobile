import React from "react"
import { Text as ReactNativeText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { ReceiveAmountRow } from "@app/components/receive-amount-row"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: MoneyAmount<WalletOrDisplayCurrency> }) =>
    `$${moneyAmount.amount}`,
)

const mockGetSecondary = jest.fn(() => null)

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: mockFormatMoneyAmount,
    getSecondaryAmountIfCurrencyIsDifferent: mockGetSecondary,
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  useTheme: () => ({
    theme: {
      colors: {
        black: "black",
        grey1: "grey1",
        grey5: "grey5",
        background: "background",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    disabledOverlay: {},
    textDisabled: {},
    amountSection: {},
    amountText: {},
    placeholderText: {},
    secondaryText: {},
    walletSection: {},
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AmountInputButton: {
        tapToSetAmount: () => "Tap to set amount",
      },
    },
  }),
}))

jest.mock("@app/components/animations", () => ({
  useAlternatingSpin: () => ({
    triggerSpin: jest.fn(),
    spinStyle: {},
  }),
}))

jest.mock("@app/components/atomic/currency-pill", () => ({
  CurrencyPill: ({ currency }: { currency: string }) => (
    <View testID={`currency-pill-${currency}`} />
  ),
  useEqualPillWidth: () => ({
    widthStyle: {},
    onPillLayout: () => jest.fn(),
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name }: { name: string }) => <View testID={`galoy-icon-${name}`} />,
}))

jest.mock("@app/components/amount-input/amount-input-modal", () => ({
  AmountInputModal: () => null,
}))

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View },
}))

const mockConvertMoneyAmount = jest.fn(() => ({
  amount: 100,
  currency: "DisplayCurrency",
  currencyCode: "USD",
})) as jest.Mock & ConvertMoneyAmount

describe("ReceiveAmountRow", () => {
  const mockSetAmount = jest.fn()
  const mockOnToggleWallet = jest.fn()

  const defaultProps = {
    walletCurrency: WalletCurrency.Btc,
    convertMoneyAmount: mockConvertMoneyAmount,
    setAmount: mockSetAmount,
    canSetAmount: true,
    onToggleWallet: mockOnToggleWallet,
    canToggleWallet: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<ReceiveAmountRow {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("shows placeholder when no amount is set", () => {
      const { getByText } = render(<ReceiveAmountRow {...defaultProps} />)

      expect(getByText("Tap to set amount")).toBeTruthy()
    })

    it("renders currency pill with correct currency", () => {
      const { getByTestId } = render(<ReceiveAmountRow {...defaultProps} />)

      expect(getByTestId("currency-pill-BTC")).toBeTruthy()
    })

    it("renders USD currency pill when walletCurrency is USD", () => {
      const { getByTestId } = render(
        <ReceiveAmountRow {...defaultProps} walletCurrency={WalletCurrency.Usd} />,
      )

      expect(getByTestId("currency-pill-USD")).toBeTruthy()
    })

    it("renders refresh icon", () => {
      const { getByTestId } = render(<ReceiveAmountRow {...defaultProps} />)

      expect(getByTestId("galoy-icon-refresh")).toBeTruthy()
    })
  })

  describe("amount section interactions", () => {
    it("amount section is pressable when canSetAmount is true", () => {
      const { getByLabelText } = render(<ReceiveAmountRow {...defaultProps} />)

      const button = getByLabelText("Tap to set amount")
      fireEvent.press(button)

      expect(button).toBeTruthy()
    })

    it("amount section is disabled when canSetAmount is false", () => {
      const { getByLabelText } = render(
        <ReceiveAmountRow {...defaultProps} canSetAmount={false} />,
      )

      const button = getByLabelText("Tap to set amount")

      expect(button.props.accessibilityState?.disabled).toBe(true)
    })
  })

  describe("wallet toggle interactions", () => {
    it("calls onToggleWallet when toggle is pressed", () => {
      const { getByLabelText } = render(<ReceiveAmountRow {...defaultProps} />)

      fireEvent.press(getByLabelText("Toggle wallet"))

      expect(mockOnToggleWallet).toHaveBeenCalledTimes(1)
    })

    it("toggle is disabled when canToggleWallet is false", () => {
      const { getByLabelText } = render(
        <ReceiveAmountRow {...defaultProps} canToggleWallet={false} />,
      )

      fireEvent.press(getByLabelText("Toggle wallet"))

      expect(mockOnToggleWallet).not.toHaveBeenCalled()
    })
  })

  describe("disabled state", () => {
    it("disables amount section when disabled prop is true", () => {
      const { getByLabelText } = render(<ReceiveAmountRow {...defaultProps} disabled />)

      const button = getByLabelText("Tap to set amount")

      expect(button.props.accessibilityState?.disabled).toBe(true)
    })

    it("wallet toggle remains functional when disabled is true but canToggleWallet is true", () => {
      const { getByLabelText } = render(<ReceiveAmountRow {...defaultProps} disabled />)

      fireEvent.press(getByLabelText("Toggle wallet"))

      expect(mockOnToggleWallet).toHaveBeenCalledTimes(1)
    })
  })
})
