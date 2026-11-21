import React from "react"
import { act, render } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { AmountInputScreen } from "@app/components/amount-input-screen/amount-input-screen"
import { Key } from "@app/components/amount-input-screen/number-pad-reducer"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

const mockFormatMoneyAmount = jest.fn()
const mockGetSecondaryAmount = jest.fn()
const mockSavePreferredAmountCurrency = jest.fn()
const mockUiHandlers: {
  onKeyPress?: (key: Key) => void
  onToggleCurrency?: () => void
} = {}
const mockPreferredCurrencyData = {
  data: null as { preferredAmountCurrency: string } | null,
}

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({
    writeQuery: jest.fn(),
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  usePreferredAmountCurrencyQuery: () => mockPreferredCurrencyData,
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
  AmountInputScreenUI: (
    props: Record<string, string | boolean | undefined> & typeof mockUiHandlers,
  ) => {
    const ReactNative = jest.requireActual("react-native")
    mockUiHandlers.onKeyPress = props.onKeyPress
    mockUiHandlers.onToggleCurrency = props.onToggleCurrency
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
        <ReactNative.Text testID="warning-message">
          {props.warningMessage ?? ""}
        </ReactNative.Text>
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
    mockPreferredCurrencyData.data = null
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
    mockPreferredCurrencyData.data = { preferredAmountCurrency: "display" }

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

  describe("getAmountWarning", () => {
    const SATS_PER_CENT = 10
    const toSats = (amount: MoneyAmount<WalletOrDisplayCurrency>) =>
      amount.currency === WalletCurrency.Btc
        ? amount
        : { amount: amount.amount * SATS_PER_CENT, currency: WalletCurrency.Btc }
    const warnUnder = (sats: number) =>
      jest.fn((amount: MoneyAmount<WalletOrDisplayCurrency>) =>
        toSats(amount).amount > 0 && toSats(amount).amount < sats
          ? `under ${sats}`
          : undefined,
      )
    const press = (...keys: Key[]) =>
      keys.forEach((key) => act(() => mockUiHandlers.onKeyPress?.(key)))
    const satsAmount = { amount: 0, currency: WalletCurrency.Btc, currencyCode: "SAT" }

    it("re-reads the warning for the full typed value on every keystroke", () => {
      const getAmountWarning = warnUnder(2500)
      const { getByTestId } = render(
        <AmountInputScreen
          initialAmount={satsAmount}
          walletCurrency={WalletCurrency.Btc}
          convertMoneyAmount={mockConvertMoneyAmount}
          getAmountWarning={getAmountWarning}
        />,
      )
      const warning = () => getByTestId("warning-message").props.children

      press(Key[2])
      expect(warning()).toBe("under 2500")
      press(Key[4], Key[9], Key[9])
      expect(getAmountWarning).toHaveBeenLastCalledWith(
        expect.objectContaining({ amount: 2499 }),
      )
      expect(warning()).toBe("under 2500")
      press(Key[9])
      expect(warning()).toBe("")
      press(Key.Backspace)
      expect(warning()).toBe("under 2500")
    })

    it("converts a display-currency amount before every check", () => {
      mockConvertMoneyAmount.mockImplementation(toSats)
      const { getByTestId } = render(
        <AmountInputScreen
          initialAmount={{ amount: 0, currency: "DisplayCurrency", currencyCode: "USD" }}
          walletCurrency={WalletCurrency.Btc}
          convertMoneyAmount={mockConvertMoneyAmount}
          getAmountWarning={warnUnder(2500)}
        />,
      )
      const warning = () => getByTestId("warning-message").props.children

      // $2 = 200 cents = 2,000 sats; $25 = 2,500 cents = 25,000 sats
      press(Key[2])
      expect(warning()).toBe("under 2500")
      press(Key[5])
      expect(warning()).toBe("")
    })

    it("re-checks the same underlying amount when the unit is toggled", () => {
      mockConvertMoneyAmount.mockImplementation(toSats)
      mockGetSecondaryAmount.mockImplementation(({ primaryAmount }) =>
        primaryAmount.currency === WalletCurrency.Btc
          ? undefined
          : { ...toSats(primaryAmount), currencyCode: "SAT" },
      )
      const getAmountWarning = warnUnder(30000)
      const { getByTestId } = render(
        <AmountInputScreen
          initialAmount={{
            amount: 2500,
            currency: "DisplayCurrency",
            currencyCode: "USD",
          }}
          walletCurrency={WalletCurrency.Btc}
          convertMoneyAmount={mockConvertMoneyAmount}
          getAmountWarning={getAmountWarning}
        />,
      )
      expect(getByTestId("warning-message").props.children).toBe("under 30000")

      act(() => mockUiHandlers.onToggleCurrency?.())

      expect(getAmountWarning).toHaveBeenLastCalledWith(
        expect.objectContaining({ amount: 25000, currency: WalletCurrency.Btc }),
      )
      expect(getByTestId("warning-message").props.children).toBe("under 30000")
    })

    it("never disables Set Amount", () => {
      const { getByTestId } = render(
        <AmountInputScreen
          initialAmount={{ ...satsAmount, amount: 100 }}
          walletCurrency={WalletCurrency.Btc}
          convertMoneyAmount={mockConvertMoneyAmount}
          getAmountWarning={warnUnder(2500)}
          setAmount={jest.fn()}
        />,
      )

      expect(getByTestId("warning-message").props.children).toBe("under 2500")
      expect(getByTestId("set-amount-disabled").props.children).toBe("false")
    })

    it("yields to a blocking error", () => {
      const { getByTestId } = render(
        <AmountInputScreen
          initialAmount={{ ...satsAmount, amount: 100 }}
          walletCurrency={WalletCurrency.Btc}
          convertMoneyAmount={mockConvertMoneyAmount}
          maxAmount={{ ...satsAmount, amount: 50 }}
          getAmountWarning={warnUnder(2500)}
        />,
      )

      expect(getByTestId("error-message").props.children).toBeTruthy()
      expect(getByTestId("warning-message").props.children).toBe("")
    })
  })
})
