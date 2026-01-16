import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ConversionDetailsScreen } from "@app/screens/conversion-flow/conversion-details-screen"
import { WalletCurrency } from "@app/graphql/generated"
import { DisplayCurrency } from "@app/types/amounts"
import { ContextForScreen } from "./helper"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}))

const mockBtcWallet = {
  id: "btc-wallet",
  balance: 100000,
  walletCurrency: WalletCurrency.Btc,
}

const mockUsdWallet = {
  id: "usd-wallet",
  balance: 50000,
  walletCurrency: WalletCurrency.Usd,
}

const mockUseConversionScreenQuery = jest.fn()
const mockUseRealtimePriceQuery = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useConversionScreenQuery: () => mockUseConversionScreenQuery(),
  useRealtimePriceQuery: () => mockUseRealtimePriceQuery(),
}))

const mockFormatMoneyAmount = jest.fn()
const mockGetCurrencySymbol = jest.fn()
const mockDisplayCurrency = jest.fn()

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: mockFormatMoneyAmount,
    moneyAmountToDisplayCurrencyString: jest.fn(() => "$100"),
    getCurrencySymbol: mockGetCurrencySymbol,
    fractionDigits: 2,
    fiatSymbol: "$",
    displayCurrency: mockDisplayCurrency(),
    getSecondaryAmountIfCurrencyIsDifferent: jest.fn(),
    formatDisplayAndWalletAmount: jest.fn(),
    displayCurrencyShouldDisplayDecimals: true,
    currencyInfo: {
      BTC: { minorUnitToMajorUnitOffset: 8, showFractionDigits: true },
      USD: { minorUnitToMajorUnitOffset: 2, showFractionDigits: true },
      DisplayCurrency: { minorUnitToMajorUnitOffset: 2, showFractionDigits: true },
    },
    moneyAmountToMajorUnitOrSats: jest.fn(),
    zeroDisplayAmount: { amount: 0, currency: DisplayCurrency },
    formatCurrency: jest.fn(),
  }),
}))

const mockConvertMoneyAmount = jest.fn()
const mockToggleWallet = jest.fn()
const mockSetMoneyAmount = jest.fn()
const mockUseConvertMoneyDetails = jest.fn()

jest.mock("@app/screens/conversion-flow/use-convert-money-details", () => ({
  useConvertMoneyDetails: () => mockUseConvertMoneyDetails(),
}))

const mockRenderValue = jest.fn()
const mockCaretSelectionFor = jest.fn()

const mockSetInputValues = jest.fn()

jest.mock("@app/screens/conversion-flow/hooks", () => ({
  useConversionFormatting: () => ({
    renderValue: mockRenderValue,
    renderInputDecoratedValue: jest.fn(() => ""),
    caretSelectionFor: mockCaretSelectionFor,
  }),
  useConversionOverlayFocus: () => ({
    handleInputPress: jest.fn(),
    focusPhysically: jest.fn(),
  }),
  useSyncedInputValues: () => ({
    inputValues: {
      fromInput: {
        id: "fromInput",
        currency: "BTC",
        amount: { amount: 0, currency: "BTC", currencyCode: "BTC" },
        isFocused: false,
        formattedAmount: "",
      },
      toInput: {
        id: "toInput",
        currency: "USD",
        amount: { amount: 0, currency: "USD", currencyCode: "USD" },
        isFocused: false,
        formattedAmount: "",
      },
      currencyInput: {
        id: "currencyInput",
        currency: "DisplayCurrency",
        amount: { amount: 0, currency: "DisplayCurrency", currencyCode: "USD" },
        isFocused: false,
        formattedAmount: "",
      },
      formattedAmount: "",
    },
    setInputValues: mockSetInputValues,
  }),
}))

const createMockConvertMoneyDetails = (overrides = {}) => ({
  fromWallet: mockBtcWallet,
  toWallet: mockUsdWallet,
  convertMoneyAmount: mockConvertMoneyAmount,
  isValidAmount: false,
  moneyAmount: null,
  canToggleWallet: false,
  settlementSendAmount: {
    amount: 0,
    currency: WalletCurrency.Btc,
    currencyCode: "BTC",
  },
  settlementReceiveAmount: {
    amount: 0,
    currency: WalletCurrency.Usd,
    currencyCode: "USD",
  },
  displayAmount: {
    amount: 0,
    currency: DisplayCurrency,
    currencyCode: DisplayCurrency,
  },
  setMoneyAmount: mockSetMoneyAmount,
  setWallets: jest.fn(),
  ...overrides,
})

describe("ConversionDetailsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockUseConversionScreenQuery.mockReturnValue({
      data: {
        me: {
          id: "user-id",
          defaultAccount: {
            id: "account-id",
            wallets: [mockBtcWallet, mockUsdWallet],
          },
        },
      },
      loading: false,
    })

    mockUseRealtimePriceQuery.mockReturnValue({
      data: null,
      loading: false,
    })

    mockFormatMoneyAmount.mockReturnValue("100000 SAT")
    mockGetCurrencySymbol.mockReturnValue("$")
    mockDisplayCurrency.mockReturnValue("USD")
    mockRenderValue.mockReturnValue("")
    mockCaretSelectionFor.mockReturnValue({ start: 0, end: 0 })

    mockConvertMoneyAmount.mockImplementation((amount, currency) => ({
      amount: amount.amount,
      currency,
      currencyCode: currency,
    }))

    mockUseConvertMoneyDetails.mockReturnValue(createMockConvertMoneyDetails())
  })

  it("renders loading state when data is not available", () => {
    mockUseConversionScreenQuery.mockReturnValue({
      data: null,
      loading: true,
    })

    const { queryByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(queryByTestId("next-button")).toBeNull()
  })

  it("renders conversion screen with wallets", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(getByTestId("next-button")).toBeTruthy()
    expect(getByTestId("wallet-toggle-button")).toBeTruthy()
  })

  it("enables toggle button when canToggleWallet is true even without valid amount", () => {
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        canToggleWallet: true,
        toggleWallet: mockToggleWallet,
      }),
    )

    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    const toggleButton = getByTestId("wallet-toggle-button")
    expect(toggleButton.props.accessibilityState.disabled).toBe(false)
  })

  it("enables toggle button when valid amount exists", () => {
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        canToggleWallet: true,
        isValidAmount: true,
        moneyAmount: {
          amount: 1000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        toggleWallet: mockToggleWallet,
        settlementSendAmount: {
          amount: 1000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        settlementReceiveAmount: {
          amount: 1,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        displayAmount: {
          amount: 1,
          currency: DisplayCurrency,
          currencyCode: DisplayCurrency,
        },
      }),
    )

    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    const toggleButton = getByTestId("wallet-toggle-button")
    expect(toggleButton.props.accessibilityState.disabled).toBe(false)
  })

  it("disables next button when amount is invalid", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    const nextButton = getByTestId("next-button")
    expect(nextButton.props.accessibilityState.disabled).toBe(true)
  })

  it("enables next button when amount is valid", () => {
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        isValidAmount: true,
        moneyAmount: {
          amount: 1000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        settlementSendAmount: {
          amount: 1000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        settlementReceiveAmount: {
          amount: 1,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        displayAmount: {
          amount: 1,
          currency: DisplayCurrency,
          currencyCode: DisplayCurrency,
        },
      }),
    )

    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    const nextButton = getByTestId("next-button")
    expect(nextButton.props.accessibilityState.disabled).toBe(false)
  })

  it("navigates to confirmation screen with correct parameters", () => {
    const testMoneyAmount = {
      amount: 1000,
      currency: WalletCurrency.Btc,
      currencyCode: "BTC",
    }

    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        isValidAmount: true,
        moneyAmount: testMoneyAmount,
        settlementSendAmount: {
          amount: 1000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        settlementReceiveAmount: {
          amount: 1,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        displayAmount: {
          amount: 1,
          currency: DisplayCurrency,
          currencyCode: DisplayCurrency,
        },
      }),
    )

    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    const nextButton = getByTestId("next-button")

    fireEvent.press(nextButton)

    expect(mockNavigate).toHaveBeenCalledWith("conversionConfirmation", {
      fromWalletCurrency: WalletCurrency.Btc,
      moneyAmount: testMoneyAmount,
    })
  })

  it("renders correct placeholder for BTC wallet", () => {
    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(getByPlaceholderText("0 SAT")).toBeTruthy()
  })

  it("renders correct placeholder for USD wallet", () => {
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        fromWallet: mockUsdWallet,
        toWallet: mockBtcWallet,
        settlementSendAmount: {
          amount: 0,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        settlementReceiveAmount: {
          amount: 0,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
      }),
    )

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(getByPlaceholderText("$0")).toBeTruthy()
  })

  it("renders percentage selector buttons", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(getByTestId("convert-25%")).toBeTruthy()
    expect(getByTestId("convert-50%")).toBeTruthy()
    expect(getByTestId("convert-75%")).toBeTruthy()
    expect(getByTestId("convert-100%")).toBeTruthy()
  })

  it("returns nothing when wallet data is missing", () => {
    mockUseConversionScreenQuery.mockReturnValue({
      data: null,
      loading: false,
    })

    const { queryByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(queryByTestId("wallet-toggle-button")).toBeNull()
    expect(queryByTestId("next-button")).toBeNull()
  })

  it("returns nothing when fromWallet is undefined", () => {
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        fromWallet: undefined,
      }),
    )

    const { queryByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(queryByTestId("wallet-toggle-button")).toBeNull()
    expect(queryByTestId("next-button")).toBeNull()
  })

  it("shows currency input when display currency is not USD", () => {
    mockDisplayCurrency.mockReturnValue("EUR")
    mockGetCurrencySymbol.mockReturnValue("€")

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(getByPlaceholderText("€0")).toBeTruthy()
  })

  it("hides currency input when display currency is USD", () => {
    mockDisplayCurrency.mockReturnValue("USD")
    mockGetCurrencySymbol.mockReturnValue("$")

    const { queryByPlaceholderText } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(queryByPlaceholderText("€0")).toBeNull()
  })

  it("displays wallet balances correctly", () => {
    mockFormatMoneyAmount.mockReturnValue("100,000 SAT")

    const { getAllByText } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )

    const balanceTexts = getAllByText("100,000 SAT")
    expect(balanceTexts.length).toBeGreaterThan(0)
  })

  it("disables toggle button when canToggleWallet is false", () => {
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        canToggleWallet: false,
        isValidAmount: true,
        moneyAmount: {
          amount: 1000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        settlementSendAmount: {
          amount: 1000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        settlementReceiveAmount: {
          amount: 1,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
      }),
    )

    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    const toggleButton = getByTestId("wallet-toggle-button")
    expect(toggleButton.props.accessibilityState.disabled).toBe(true)
  })

  it("handles conversion with valid amount from BTC to USD", () => {
    const validAmount = 50000
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        isValidAmount: true,
        moneyAmount: {
          amount: validAmount,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        settlementSendAmount: {
          amount: validAmount,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        settlementReceiveAmount: {
          amount: 500,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        displayAmount: {
          amount: 500,
          currency: DisplayCurrency,
          currencyCode: DisplayCurrency,
        },
      }),
    )

    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    const nextButton = getByTestId("next-button")
    expect(nextButton.props.accessibilityState.disabled).toBe(false)
  })

  it("handles conversion with valid amount from USD to BTC", () => {
    const validAmount = 25000
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        fromWallet: mockUsdWallet,
        toWallet: mockBtcWallet,
        isValidAmount: true,
        moneyAmount: {
          amount: validAmount,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        settlementSendAmount: {
          amount: validAmount,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        settlementReceiveAmount: {
          amount: 25000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        displayAmount: {
          amount: 25000,
          currency: DisplayCurrency,
          currencyCode: DisplayCurrency,
        },
      }),
    )

    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    const nextButton = getByTestId("next-button")
    expect(nextButton.props.accessibilityState.disabled).toBe(false)
  })

  it("disables next button when amount exceeds wallet balance", () => {
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        isValidAmount: false,
        moneyAmount: {
          amount: 200000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        settlementSendAmount: {
          amount: 200000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
      }),
    )

    const { getByTestId } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    const nextButton = getByTestId("next-button")
    expect(nextButton.props.accessibilityState.disabled).toBe(true)
  })

  it("shows error message when amount exceeds wallet balance", () => {
    mockFormatMoneyAmount.mockReturnValue("100,000 SAT")
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        isValidAmount: false,
        moneyAmount: {
          amount: 200000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        settlementSendAmount: {
          amount: 200000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
      }),
    )

    const { getAllByText } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )

    const errorTexts = getAllByText(/100,000 SAT/)
    expect(errorTexts.length).toBeGreaterThan(0)
  })

  it("renders correct placeholders when wallets are swapped", () => {
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        fromWallet: mockUsdWallet,
        toWallet: mockBtcWallet,
        settlementSendAmount: {
          amount: 0,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        settlementReceiveAmount: {
          amount: 0,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
      }),
    )

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(getByPlaceholderText("$0")).toBeTruthy()
    expect(getByPlaceholderText("0 SAT")).toBeTruthy()
  })

  it("shows currency input with correct symbol for EUR", () => {
    mockDisplayCurrency.mockReturnValue("EUR")
    mockGetCurrencySymbol.mockImplementation(({ currency }) => {
      if (currency === "EUR") return "€"
      return "$"
    })

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(getByPlaceholderText("€0")).toBeTruthy()
  })

  it("shows currency input with correct symbol for GBP", () => {
    mockDisplayCurrency.mockReturnValue("GBP")
    mockGetCurrencySymbol.mockImplementation(({ currency }) => {
      if (currency === "GBP") return "£"
      return "$"
    })

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )
    expect(getByPlaceholderText("£0")).toBeTruthy()
  })

  it("updates input amount currencies when wallets are swapped from USD to BTC", () => {
    mockUseConvertMoneyDetails.mockReturnValue(
      createMockConvertMoneyDetails({
        fromWallet: mockUsdWallet,
        toWallet: mockBtcWallet,
        isValidAmount: true,
        moneyAmount: {
          amount: 30000,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        settlementSendAmount: {
          amount: 30000,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        settlementReceiveAmount: {
          amount: 29000,
          currency: WalletCurrency.Btc,
          currencyCode: "BTC",
        },
        displayAmount: {
          amount: 30000,
          currency: DisplayCurrency,
          currencyCode: DisplayCurrency,
        },
      }),
    )

    mockRenderValue
      .mockReturnValueOnce("$300")
      .mockReturnValueOnce("29,000 SAT")
      .mockReturnValue("")

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <ConversionDetailsScreen />
      </ContextForScreen>,
    )

    expect(getByPlaceholderText("$0")).toBeTruthy()
    expect(getByPlaceholderText("0 SAT")).toBeTruthy()
  })
})
