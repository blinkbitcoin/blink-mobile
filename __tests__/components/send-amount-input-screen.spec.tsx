import React from "react"
import { render } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { AmountInputScreen } from "@app/components/amount-input-screen/amount-input-screen"

const mockFormatMoneyAmount = jest.fn()
const mockGetSecondaryAmount = jest.fn()
const mockSavePreferredAmountCurrency = jest.fn()
const mockReadQuery = jest.fn()

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({
    readQuery: mockReadQuery,
    writeQuery: jest.fn(),
  }),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  PreferredAmountCurrency: { Display: "display", Default: "default" },
  savePreferredAmountCurrency: (...args: readonly []) =>
    mockSavePreferredAmountCurrency(...args),
}))

const stableCurrencyInfo = {
  BTC: {
    symbol: "",
    minorUnitToMajorUnitOffset: 0,
    showFractionDigits: false,
    currencyCode: "SAT",
  },
  USD: {
    symbol: "$",
    minorUnitToMajorUnitOffset: 2,
    showFractionDigits: true,
    currencyCode: "USD",
  },
  DisplayCurrency: {
    symbol: "$",
    minorUnitToMajorUnitOffset: 2,
    showFractionDigits: true,
    currencyCode: "USD",
  },
}

const stableZeroDisplayAmount = {
  amount: 0,
  currency: "DisplayCurrency",
  currencyCode: "USD",
}

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    currencyInfo: stableCurrencyInfo,
    formatMoneyAmount: mockFormatMoneyAmount,
    getSecondaryAmountIfCurrencyIsDifferent: mockGetSecondaryAmount,
    zeroDisplayAmount: stableZeroDisplayAmount,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AmountInputScreen: {
        maxAmountExceeded: ({ maxAmount }: { maxAmount: string }) =>
          `Maximum amount exceeded: ${maxAmount}`,
        exceedsAvailableBalance: ({ maxAmount }: { maxAmount: string }) =>
          `Exceeds available balance: ${maxAmount}`,
        minAmountNotMet: ({ minAmount }: { minAmount: string }) =>
          `Minimum amount not met: ${minAmount}`,
        setAmount: () => "Set Amount",
      },
    },
  }),
}))

jest.mock("@app/components/amount-input-screen/amount-input-screen-ui", () => ({
  AmountInputScreenUI: (props: Record<string, string | boolean | undefined>) => {
    const ReactNative = jest.requireActual("react-native")
    return (
      <ReactNative.View testID="amount-input-screen-ui">
        <ReactNative.Text testID="primary-code">
          {props.primaryCurrencyCode}
        </ReactNative.Text>
        <ReactNative.Text testID="primary-formatted">
          {props.primaryCurrencyFormattedAmount}
        </ReactNative.Text>
        <ReactNative.Text testID="secondary-code">
          {props.secondaryCurrencyCode ?? ""}
        </ReactNative.Text>
        <ReactNative.Text testID="error-message">{props.errorMessage}</ReactNative.Text>
        <ReactNative.Text testID="set-amount-disabled">
          {String(props.setAmountDisabled)}
        </ReactNative.Text>
      </ReactNative.View>
    )
  },
}))

describe("AmountInputScreen", () => {
  const mockConvertMoneyAmount = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertMoneyAmount.mockImplementation((amount) => amount)
    mockFormatMoneyAmount.mockReturnValue("$0.00")
    mockGetSecondaryAmount.mockReturnValue(undefined)
    mockReadQuery.mockReturnValue(null)
  })

  it("renders AmountInputScreenUI", () => {
    const { getByTestId } = render(
      <AmountInputScreen
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
      />,
    )

    expect(getByTestId("amount-input-screen-ui")).toBeTruthy()
  })

  it("uses zeroDisplayAmount when no initialAmount and no preference", () => {
    const { getByTestId } = render(
      <AmountInputScreen
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
      />,
    )

    expect(getByTestId("primary-code").props.children).toBe("USD")
  })

  it("uses initialAmount when provided with non-zero amount", () => {
    const { getByTestId } = render(
      <AmountInputScreen
        initialAmount={{ amount: 500, currency: WalletCurrency.Btc, currencyCode: "SAT" }}
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
      />,
    )

    expect(getByTestId("primary-code").props.children).toBe("BTC")
  })

  it("uses preferred currency from cache when no initial amount", () => {
    mockReadQuery.mockReturnValue({ preferredAmountCurrency: "display" })

    const { getByTestId } = render(
      <AmountInputScreen
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
      />,
    )

    expect(getByTestId("primary-code").props.children).toBe("USD")
  })

  it("shows no error when amount is within bounds", () => {
    const { getByTestId } = render(
      <AmountInputScreen
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
      />,
    )

    expect(getByTestId("error-message").props.children).toBe("")
  })

  it("pillLabel shows currencyCode for DisplayCurrency", () => {
    const { getByTestId } = render(
      <AmountInputScreen
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
      />,
    )

    expect(getByTestId("primary-code").props.children).toBe("USD")
  })

  it("pillLabel shows wallet currency string for BTC", () => {
    const { getByTestId } = render(
      <AmountInputScreen
        initialAmount={{ amount: 100, currency: WalletCurrency.Btc, currencyCode: "SAT" }}
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
      />,
    )

    expect(getByTestId("primary-code").props.children).toBe("BTC")
  })

  it("passes secondary code when secondary amount exists", () => {
    mockGetSecondaryAmount.mockReturnValue({
      amount: 100,
      currency: WalletCurrency.Btc,
      currencyCode: "SAT",
    })

    const { getByTestId } = render(
      <AmountInputScreen
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
      />,
    )

    expect(getByTestId("secondary-code").props.children).toBe("BTC")
  })

  it("disables set amount when there is an error", () => {
    mockConvertMoneyAmount.mockImplementation((amount) => amount)

    const { getByTestId } = render(
      <AmountInputScreen
        initialAmount={{
          amount: 99999,
          currency: "DisplayCurrency",
          currencyCode: "USD",
        }}
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
        maxAmount={{ amount: 100, currency: "DisplayCurrency", currencyCode: "USD" }}
        setAmount={jest.fn()}
      />,
    )

    expect(getByTestId("set-amount-disabled").props.children).toBe("true")
  })

  it("shows maxAmountExceeded error when amount exceeds maxAmount", () => {
    mockConvertMoneyAmount.mockImplementation((amount) => amount)
    mockFormatMoneyAmount.mockReturnValue("$1.00")

    const { getByTestId } = render(
      <AmountInputScreen
        initialAmount={{
          amount: 99999,
          currency: "DisplayCurrency",
          currencyCode: "USD",
        }}
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
        maxAmount={{ amount: 100, currency: "DisplayCurrency", currencyCode: "USD" }}
        setAmount={jest.fn()}
      />,
    )

    expect(getByTestId("error-message").props.children).toBe(
      "Maximum amount exceeded: $1.00",
    )
  })

  it("shows exceedsAvailableBalance error when maxAmountIsBalance is true", () => {
    mockConvertMoneyAmount.mockImplementation((amount) => amount)
    mockFormatMoneyAmount.mockReturnValue("100,000 SAT")

    const { getByTestId } = render(
      <AmountInputScreen
        initialAmount={{
          amount: 99999,
          currency: "DisplayCurrency",
          currencyCode: "USD",
        }}
        walletCurrency={WalletCurrency.Btc}
        convertMoneyAmount={mockConvertMoneyAmount}
        maxAmount={{ amount: 100, currency: "DisplayCurrency", currencyCode: "USD" }}
        maxAmountIsBalance
        setAmount={jest.fn()}
      />,
    )

    expect(getByTestId("error-message").props.children).toBe(
      "Exceeds available balance: 100,000 SAT",
    )
  })
})
