import { act, renderHook } from "@testing-library/react-native"

import { useNumberPad } from "@app/components/amount-input-screen/use-number-pad"
import { WalletCurrency } from "@app/graphql/generated"
import {
  DisplayCurrency,
  MoneyAmount,
  WalletOrDisplayCurrency,
  toBtcMoneyAmount,
} from "@app/types/amounts"

const mockSavePreferredAmountCurrency = jest.fn()
const mockPreferredCurrencyData = {
  data: null as { preferredAmountCurrency: string } | null,
}

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({ writeQuery: jest.fn() }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  usePreferredAmountCurrencyQuery: () => mockPreferredCurrencyData,
}))

jest.mock("@app/graphql/client-only-query", () => ({
  PreferredAmountCurrency: { Display: "display", Default: "default" },
  savePreferredAmountCurrency: (_client: unknown, currency: string) =>
    mockSavePreferredAmountCurrency(currency),
}))

const mockCurrencyInfo = {
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

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ currencyInfo: mockCurrencyInfo }),
}))

/** $90,000 per bitcoin: one sat is 0.09 cents, so 1,001 sats shows as $0.90. */
const CENTS_PER_SAT = 0.09

const convertMoneyAmount = <T extends WalletOrDisplayCurrency>(
  amount: MoneyAmount<WalletOrDisplayCurrency>,
  toCurrency: T,
): MoneyAmount<T> => {
  const isSats = (currency: WalletOrDisplayCurrency) => currency === WalletCurrency.Btc
  const sats = isSats(amount.currency) ? amount.amount : amount.amount / CENTS_PER_SAT
  return {
    amount: Math.round(isSats(toCurrency) ? sats : sats * CENTS_PER_SAT),
    currency: toCurrency,
    currencyCode: mockCurrencyInfo[toCurrency].currencyCode,
  }
}

const renderPad = () =>
  renderHook(() =>
    useNumberPad({
      walletCurrency: WalletCurrency.Btc,
      convertMoneyAmount,
      onAmountChange: jest.fn(),
    }),
  )

describe("useNumberPad", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPreferredCurrencyData.data = null
  })

  it("swaps currency from the amount of record, not the rounded mirror", () => {
    mockPreferredCurrencyData.data = { preferredAmountCurrency: "display" }
    const { result } = renderPad()
    const chipAmount = toBtcMoneyAmount(1001)

    act(() => result.current.showAmount(chipAmount))
    expect(result.current.padAmount.amount).toBe(90)

    act(() => result.current.toggleCurrency(WalletCurrency.Btc, chipAmount))

    expect(result.current.padCurrency).toBe(WalletCurrency.Btc)
    expect(result.current.padAmount.amount).toBe(1001)
  })

  it("saves the preference when a wallet switch moves the pad to the display currency", () => {
    mockPreferredCurrencyData.data = { preferredAmountCurrency: "default" }
    const { result } = renderPad()
    expect(result.current.padCurrency).toBe(WalletCurrency.Btc)

    act(() =>
      result.current.showAmount(
        { amount: 200, currency: DisplayCurrency, currencyCode: "USD" },
        DisplayCurrency,
      ),
    )

    expect(result.current.padCurrency).toBe(DisplayCurrency)
    expect(mockSavePreferredAmountCurrency).toHaveBeenCalledWith("display")
  })

  it("leaves the preference alone when the currency doesn't change", () => {
    mockPreferredCurrencyData.data = { preferredAmountCurrency: "display" }
    const { result } = renderPad()

    act(() => result.current.showAmount(toBtcMoneyAmount(1001)))

    expect(mockSavePreferredAmountCurrency).not.toHaveBeenCalled()
  })
})
