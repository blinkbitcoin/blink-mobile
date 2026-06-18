import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useSendDustWarning } from "@app/self-custodial/hooks/use-send-dust-warning"
import { toUsdMoneyAmount, type MoneyAmount } from "@app/types/amounts"
import { ConvertAmountAdjustment } from "@app/types/payment"

const mockConvertMoneyAmount = jest.fn()
const mockUseNonCustodialConversionLimits = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount }),
}))

jest.mock("@app/self-custodial/hooks/use-non-custodial-conversion-limits", () => ({
  useNonCustodialConversionLimits: (...args: unknown[]) =>
    mockUseNonCustodialConversionLimits(...args),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const usdAmount = (cents: number): MoneyAmount<typeof WalletCurrency.Usd> => ({
  amount: cents,
  currency: WalletCurrency.Usd,
  currencyCode: "USD",
})

// Deterministic rate for assertions: 1 USD cent <-> 10 sats.
const fakeConvert = (moneyAmount: { amount: number }, target: WalletCurrency) =>
  target === WalletCurrency.Btc
    ? {
        amount: Math.round(moneyAmount.amount * 10),
        currency: WalletCurrency.Btc,
        currencyCode: "BTC",
      }
    : {
        amount: Math.round(moneyAmount.amount / 10),
        currency: WalletCurrency.Usd,
        currencyCode: "USD",
      }

const baseParams = {
  amountAdjustment: ConvertAmountAdjustment.IncreasedToAvoidDust as
    | ConvertAmountAdjustment
    | undefined,
  fromCurrency: WalletCurrency.Usd as WalletCurrency | undefined,
  fromWalletBalance: 1000,
  unitOfAccountAmount: usdAmount(200),
  settlementAmount: 200,
  feeSats: 50,
  usdBalanceMoneyAmount: usdAmount(1000),
}

describe("useSendDustWarning", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertMoneyAmount.mockImplementation(fakeConvert)
    mockUseNonCustodialConversionLimits.mockReturnValue({
      limits: { minFromAmount: 800, minToAmount: null },
      loading: false,
      error: null,
    })
  })

  describe("hidden (no dust gate)", () => {
    it("is hidden for a BTC source wallet even when the SDK reports IncreasedToAvoidDust", () => {
      const { result } = renderHook(() =>
        useSendDustWarning({ ...baseParams, fromCurrency: WalletCurrency.Btc }),
      )
      expect(result.current.status).toBe("hidden")
    })

    it("is hidden when there is no amountAdjustment", () => {
      const { result } = renderHook(() =>
        useSendDustWarning({ ...baseParams, amountAdjustment: undefined }),
      )
      expect(result.current.status).toBe("hidden")
    })

    it("is hidden for the benign FlooredToMin adjustment", () => {
      const { result } = renderHook(() =>
        useSendDustWarning({
          ...baseParams,
          amountAdjustment: ConvertAmountAdjustment.FlooredToMin,
        }),
      )
      expect(result.current.status).toBe("hidden")
    })

    it("is hidden when the user drains the full balance (no remainder to sweep)", () => {
      const { result } = renderHook(() =>
        useSendDustWarning({
          ...baseParams,
          settlementAmount: 1000,
          fromWalletBalance: 1000,
        }),
      )
      expect(result.current.status).toBe("hidden")
    })
  })

  describe("fail-closed states", () => {
    it("is pending while the conversion limits are still loading", () => {
      mockUseNonCustodialConversionLimits.mockReturnValue({
        limits: null,
        loading: true,
        error: null,
      })
      const { result } = renderHook(() => useSendDustWarning(baseParams))
      expect(result.current.status).toBe("pending")
    })

    it("is blocked and logs when limits fail to fetch while a dust sweep is in play", () => {
      const error = new Error("limits fetch failed")
      mockUseNonCustodialConversionLimits.mockReturnValue({
        limits: null,
        loading: false,
        error,
      })
      const { result } = renderHook(() => useSendDustWarning(baseParams))
      expect(result.current.status).toBe("blocked")
      expect(mockReportError).toHaveBeenCalledWith(expect.any(String), error)
    })

    it("is blocked when limits resolve without a usable minimum", () => {
      mockUseNonCustodialConversionLimits.mockReturnValue({
        limits: { minFromAmount: null, minToAmount: null },
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useSendDustWarning(baseParams))
      expect(result.current.status).toBe("blocked")
    })
  })

  describe("visible", () => {
    it("returns raw money amounts with the minimum in USD (not sats)", () => {
      const { result } = renderHook(() => useSendDustWarning(baseParams))

      expect(result.current.status).toBe("visible")
      if (result.current.status !== "visible") return

      // I1: minimum must be USD (the source currency of the sweep), value = minFromAmount
      expect(result.current.minimum).toEqual(toUsdMoneyAmount(800))
      expect(result.current.minimum.currency).toBe(WalletCurrency.Usd)

      // D1: raw amounts, not formatted strings
      expect(result.current.remainingSats.currency).toBe(WalletCurrency.Btc)
      // balance 1000c -> 10000 sats; sent 200c -> 2000 sats; fee 50 -> 7950 sats
      expect(result.current.remainingSats.amount).toBe(7950)
      expect(result.current.remaining.currency).toBe(WalletCurrency.Usd)
    })

    it("requests UsdToBtc limits for a USD-source sweep", () => {
      renderHook(() => useSendDustWarning(baseParams))
      expect(mockUseNonCustodialConversionLimits).toHaveBeenCalledWith("usd_to_btc")
    })
  })
})
