import { useMemo } from "react"
import { renderHook, waitFor } from "@testing-library/react-native"

import { useConversionQuote } from "@app/screens/conversion-flow/hooks/use-conversion-quote"
import {
  ConvertAmountAdjustment,
  ConvertDirection,
  PaymentResultStatus,
  type ConvertParams,
  type ConvertQuote,
} from "@app/types/payment.types"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"

const mockGetQuote = jest.fn()
const mockConvertMoneyAmount = jest.fn((amount) => amount)

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({ getConversionQuote: mockGetQuote }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `$${(moneyAmount.amount / 100).toFixed(2)}`,
  }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount }),
}))

jest.mock("@react-native-firebase/crashlytics", () => {
  const recordError = jest.fn()
  return {
    __esModule: true,
    default: () => ({ recordError }),
  }
})

const buildQuote = (amountAdjustment?: ConvertAmountAdjustment): ConvertQuote => ({
  feeAmount: toUsdMoneyAmount(5),
  amountAdjustment,
  execute: jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success }),
})

// renderHook passes initialProps by reference, so a single object survives re-renders.
const btcToUsdParams: ConvertParams = {
  fromAmount: toBtcMoneyAmount(10_000),
  toAmount: toUsdMoneyAmount(500),
  direction: ConvertDirection.BtcToUsd,
}

const usdToBtcParams: ConvertParams = {
  fromAmount: toUsdMoneyAmount(500),
  toAmount: toBtcMoneyAmount(10_000),
  direction: ConvertDirection.UsdToBtc,
}

// Memoize via useMemo so changing the direction key swaps objects exactly once.
const useHookUnderTest = (direction: ConvertDirection | null) => {
  const params = useMemo<ConvertParams | null>(() => {
    if (direction === ConvertDirection.BtcToUsd) return btcToUsdParams
    if (direction === ConvertDirection.UsdToBtc) return usdToBtcParams
    return null
  }, [direction])
  return useConversionQuote(params)
}

describe("useConversionQuote", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("stays idle when params are null", async () => {
    const { result } = renderHook(() => useHookUnderTest(null))

    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.quote).toBeNull()
    expect(result.current.feeText).toBe("")
    expect(mockGetQuote).not.toHaveBeenCalled()
  })

  it("transitions Loading → Ready and surfaces formattedFee", async () => {
    const quote = buildQuote()
    mockGetQuote.mockResolvedValue(quote)

    const { result } = renderHook(() => useHookUnderTest(ConvertDirection.BtcToUsd))

    await waitFor(() => expect(result.current.quote).toBe(quote))
    expect(result.current.feeText).toBe("$0.05")
    expect(result.current.isQuoting).toBe(false)
    expect(result.current.hasQuoteError).toBe(false)
  })

  it("converts feeAmount to display currency before formatting (avoids stale USD code)", async () => {
    const quote = buildQuote()
    mockGetQuote.mockResolvedValue(quote)

    const { result } = renderHook(() => useHookUnderTest(ConvertDirection.BtcToUsd))

    await waitFor(() => expect(result.current.quote).toBe(quote))
    expect(mockConvertMoneyAmount).toHaveBeenCalledWith(
      quote.feeAmount,
      "DisplayCurrency",
    )
  })

  it("falls back to the raw USD fee when convertMoneyAmount is unavailable", async () => {
    const quote = buildQuote()
    mockGetQuote.mockResolvedValue(quote)

    const usePriceConversionMock = jest.requireMock("@app/hooks/use-price-conversion")
    usePriceConversionMock.usePriceConversion = () => ({ convertMoneyAmount: undefined })

    const { result } = renderHook(() => useHookUnderTest(ConvertDirection.BtcToUsd))

    await waitFor(() => expect(result.current.quote).toBe(quote))
    // formatUsdInDisplay falls back to formatting the raw USD amount so the UI
    // never blocks on price loading.
    expect(result.current.feeText).toBe("$0.05")

    usePriceConversionMock.usePriceConversion = () => ({
      convertMoneyAmount: mockConvertMoneyAmount,
    })
  })

  it("transitions to Error when the quote is null", async () => {
    mockGetQuote.mockResolvedValue(null)

    const { result } = renderHook(() => useHookUnderTest(ConvertDirection.BtcToUsd))

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
    expect(result.current.quote).toBeNull()
    expect(result.current.feeText).toBe("")
  })

  it("transitions to Error when getConversionQuote rejects", async () => {
    mockGetQuote.mockRejectedValue(new Error("boom"))

    const { result } = renderHook(() => useHookUnderTest(ConvertDirection.BtcToUsd))

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
  })

  it("forwards FlooredToMin adjustment from the quote", async () => {
    mockGetQuote.mockResolvedValue(buildQuote(ConvertAmountAdjustment.FlooredToMin))

    const { result } = renderHook(() => useHookUnderTest(ConvertDirection.BtcToUsd))

    await waitFor(() =>
      expect(result.current.amountAdjustment).toBe(ConvertAmountAdjustment.FlooredToMin),
    )
  })

  it("forwards IncreasedToAvoidDust adjustment from the quote", async () => {
    mockGetQuote.mockResolvedValue(
      buildQuote(ConvertAmountAdjustment.IncreasedToAvoidDust),
    )

    const { result } = renderHook(() => useHookUnderTest(ConvertDirection.BtcToUsd))

    await waitFor(() =>
      expect(result.current.amountAdjustment).toBe(
        ConvertAmountAdjustment.IncreasedToAvoidDust,
      ),
    )
  })

  it("returns null amountAdjustment when the SDK reports none", async () => {
    mockGetQuote.mockResolvedValue(buildQuote())

    const { result } = renderHook(() => useHookUnderTest(ConvertDirection.BtcToUsd))

    await waitFor(() => expect(result.current.quote).not.toBeNull())
    expect(result.current.amountAdjustment).toBeNull()
  })

  it("cancels the stale in-flight request when params change", async () => {
    let resolveFirst: (value: ConvertQuote) => void = () => {}
    mockGetQuote.mockImplementationOnce(
      () =>
        new Promise<ConvertQuote>((resolve) => {
          resolveFirst = resolve
        }),
    )
    const second = buildQuote()
    mockGetQuote.mockResolvedValueOnce(second)

    const initialProps: { direction: ConvertDirection } = {
      direction: ConvertDirection.BtcToUsd,
    }
    const { result, rerender } = renderHook(
      ({ direction }: { direction: ConvertDirection }) => useHookUnderTest(direction),
      { initialProps },
    )

    rerender({ direction: ConvertDirection.UsdToBtc })

    await waitFor(() => expect(result.current.quote).toBe(second))

    resolveFirst(buildQuote())

    // Stale resolve should not overwrite newer state.
    expect(result.current.quote).toBe(second)
  })
})
