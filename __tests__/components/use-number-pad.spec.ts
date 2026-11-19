import { act, renderHook } from "@testing-library/react-native"

import { Key } from "@app/components/amount-input-screen/number-pad-reducer"
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

/** Sats-only mode: no rate, so the display currency is the sat. */
const satsOnlyCurrencyInfo = {
  ...mockCurrencyInfo,
  DisplayCurrency: { ...mockCurrencyInfo.BTC },
}

const mockDisplay = { currencyInfo: mockCurrencyInfo }

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => mockDisplay,
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

const satsOnlyConvert = <T extends WalletOrDisplayCurrency>(
  amount: MoneyAmount<WalletOrDisplayCurrency>,
  toCurrency: T,
): MoneyAmount<T> => {
  const isCents = (currency: WalletOrDisplayCurrency) => currency === WalletCurrency.Usd
  const sats = isCents(amount.currency) ? amount.amount / CENTS_PER_SAT : amount.amount
  return {
    amount: Math.round(isCents(toCurrency) ? sats * CENTS_PER_SAT : sats),
    currency: toCurrency,
    currencyCode: satsOnlyCurrencyInfo[toCurrency].currencyCode,
  }
}

/** One key per act, so each press reads the state the last one left. */
const typeKeys = (
  result: { current: { onKeyPress: (key: (typeof Key)[keyof typeof Key]) => void } },
  ...keys: (typeof Key)[keyof typeof Key][]
) => keys.forEach((key) => act(() => result.current.onKeyPress(key)))

type PadProps = {
  walletCurrency: WalletCurrency
  convert: typeof convertMoneyAmount
  amountOfRecord?: MoneyAmount<WalletOrDisplayCurrency>
}

/** Rendered with props so a test can move the rate, wallet or amount after mount. */
const renderPadWith = (initialProps: PadProps) =>
  renderHook(
    ({ walletCurrency, convert, amountOfRecord }: PadProps) =>
      useNumberPad({
        walletCurrency,
        convertMoneyAmount: convert,
        amountOfRecord,
        onAmountChange: jest.fn(),
      }),
    { initialProps },
  )

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
    mockDisplay.currencyInfo = mockCurrencyInfo
  })

  it("swaps currency from the amount of record, not the rounded mirror", () => {
    mockPreferredCurrencyData.data = { preferredAmountCurrency: "display" }
    const { result } = renderPad()
    const walletAmount = toBtcMoneyAmount(1001)

    act(() => result.current.showAmount(walletAmount))
    expect(result.current.padAmount.amount).toBe(90)

    act(() => result.current.toggleCurrency(WalletCurrency.Btc, walletAmount))

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

  it("re-reads sats typed before the rate arrived in the dollar, not as dollars", () => {
    mockPreferredCurrencyData.data = { preferredAmountCurrency: "display" }
    mockDisplay.currencyInfo = satsOnlyCurrencyInfo
    const typedSats = { amount: 1000, currency: DisplayCurrency, currencyCode: "SAT" }
    const { result, rerender } = renderPadWith({
      walletCurrency: WalletCurrency.Btc,
      convert: satsOnlyConvert,
    })
    typeKeys(result, Key[1], Key[0], Key[0], Key[0])
    expect(result.current.typedAmountText).toBe("1,000")
    rerender({
      walletCurrency: WalletCurrency.Btc,
      convert: satsOnlyConvert,
      amountOfRecord: typedSats,
    })

    // The rate lands before the caller has moved its amount: the pad waits for it.
    mockDisplay.currencyInfo = mockCurrencyInfo
    rerender({
      walletCurrency: WalletCurrency.Btc,
      convert: satsOnlyConvert,
      amountOfRecord: typedSats,
    })
    rerender({
      walletCurrency: WalletCurrency.Btc,
      convert: convertMoneyAmount,
      amountOfRecord: toBtcMoneyAmount(1000),
    })

    expect(result.current.padAmount).toEqual({
      amount: 90,
      currency: DisplayCurrency,
      currencyCode: "USD",
    })
    expect(result.current.typedAmountText).toBe("$0.90")
  })

  it("re-reads dollars typed before the rate was lost in sats", () => {
    mockPreferredCurrencyData.data = { preferredAmountCurrency: "display" }
    const { result, rerender } = renderPadWith({
      walletCurrency: WalletCurrency.Btc,
      convert: convertMoneyAmount,
    })
    typeKeys(result, Key[1], Key[0], Key.Decimal, Key[5], Key[0])
    expect(result.current.typedAmountText).toBe("$10.50")

    mockDisplay.currencyInfo = satsOnlyCurrencyInfo
    rerender({
      walletCurrency: WalletCurrency.Btc,
      convert: satsOnlyConvert,
      amountOfRecord: toBtcMoneyAmount(11667),
    })

    expect(result.current.padAmount).toEqual({
      amount: 11667,
      currency: DisplayCurrency,
      currencyCode: "SAT",
    })
  })

  it("follows the sending wallet when it settles after mount", () => {
    mockPreferredCurrencyData.data = { preferredAmountCurrency: "default" }
    const { result, rerender } = renderPadWith({
      walletCurrency: WalletCurrency.Btc,
      convert: convertMoneyAmount,
    })
    expect(result.current.padCurrency).toBe(WalletCurrency.Btc)

    rerender({
      walletCurrency: WalletCurrency.Usd,
      convert: convertMoneyAmount,
      amountOfRecord: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
    })

    expect(result.current.padCurrency).toBe(WalletCurrency.Usd)
    expect(mockSavePreferredAmountCurrency).not.toHaveBeenCalled()
  })

  it("keeps the display digits as typed when the sending wallet switches", () => {
    mockPreferredCurrencyData.data = { preferredAmountCurrency: "display" }
    const { result, rerender } = renderPadWith({
      walletCurrency: WalletCurrency.Btc,
      convert: convertMoneyAmount,
    })
    typeKeys(result, Key[1], Key.Decimal)

    rerender({
      walletCurrency: WalletCurrency.Usd,
      convert: convertMoneyAmount,
      amountOfRecord: { amount: 100, currency: DisplayCurrency, currencyCode: "USD" },
    })

    expect(result.current.typedAmountText).toBe("$1.")
  })
})
