import { renderHook, waitFor } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useStableBalanceToggleQuote } from "@app/screens/stable-balance-settings-screen/hooks/use-stable-balance-toggle-quote"
import { DisplayCurrency, toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { ConvertDirection, PaymentResultStatus } from "@app/types/payment.types"

const mockGetQuote = jest.fn()
const mockConvertMoneyAmount = jest.fn()

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({ getConversionQuote: mockGetQuote }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `$${(moneyAmount.amount / 100).toFixed(2)}`,
  }),
}))

jest.mock("@react-native-firebase/crashlytics", () => {
  const recordError = jest.fn()
  return {
    __esModule: true,
    default: () => ({ recordError }),
  }
})

const makeQuote = () => ({
  feeAmount: toUsdMoneyAmount(5),
  execute: jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success }),
})

describe("useStableBalanceToggleQuote", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertMoneyAmount.mockImplementation(
      (amount: { amount: number }, currency: WalletCurrency | typeof DisplayCurrency) => {
        if (currency === WalletCurrency.Btc) return toBtcMoneyAmount(amount.amount * 100)
        if (currency === DisplayCurrency) {
          return { amount: amount.amount, currency: DisplayCurrency, currencyCode: "USD" }
        }
        return toUsdMoneyAmount(Math.round(amount.amount / 100))
      },
    )
  })

  it("stays idle when enabled is false", async () => {
    const { result } = renderHook(() =>
      useStableBalanceToggleQuote({
        fromCurrency: WalletCurrency.Btc,
        sourceBalance: 5_000,
        enabled: false,
      }),
    )

    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(mockGetQuote).not.toHaveBeenCalled()
  })

  it("stays idle when sourceBalance is zero (no conversion to simulate)", async () => {
    const { result } = renderHook(() =>
      useStableBalanceToggleQuote({
        fromCurrency: WalletCurrency.Btc,
        sourceBalance: 0,
        enabled: true,
      }),
    )

    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(mockGetQuote).not.toHaveBeenCalled()
  })

  it("transitions to Ready and surfaces the formatted fee for BTC→USD", async () => {
    mockGetQuote.mockResolvedValue(makeQuote())

    const { result } = renderHook(() =>
      useStableBalanceToggleQuote({
        fromCurrency: WalletCurrency.Btc,
        sourceBalance: 5_000,
        enabled: true,
      }),
    )

    await waitFor(() => expect(result.current.feeText).toBe("$0.05"))
    expect(result.current.isQuoting).toBe(false)
    expect(result.current.hasQuoteError).toBe(false)
    expect(mockGetQuote).toHaveBeenCalledWith({
      fromAmount: expect.objectContaining({
        currency: WalletCurrency.Btc,
        amount: 5_000,
      }),
      toAmount: expect.objectContaining({ currency: WalletCurrency.Usd }),
      direction: ConvertDirection.BtcToUsd,
    })
  })

  it("passes USD→BTC direction when deactivating with a USD balance", async () => {
    mockGetQuote.mockResolvedValue(makeQuote())

    const { result } = renderHook(() =>
      useStableBalanceToggleQuote({
        fromCurrency: WalletCurrency.Usd,
        sourceBalance: 500,
        enabled: true,
      }),
    )

    await waitFor(() => expect(result.current.feeText).toBe("$0.05"))
    expect(mockGetQuote).toHaveBeenCalledWith(
      expect.objectContaining({ direction: ConvertDirection.UsdToBtc }),
    )
  })

  it("surfaces an error when the quote is null", async () => {
    mockGetQuote.mockResolvedValue(null)

    const { result } = renderHook(() =>
      useStableBalanceToggleQuote({
        fromCurrency: WalletCurrency.Btc,
        sourceBalance: 5_000,
        enabled: true,
      }),
    )

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
    expect(result.current.feeText).toBe("")
  })

  it("surfaces an error when the quote call rejects", async () => {
    mockGetQuote.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() =>
      useStableBalanceToggleQuote({
        fromCurrency: WalletCurrency.Btc,
        sourceBalance: 5_000,
        enabled: true,
      }),
    )

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
  })
})
