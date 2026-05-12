import { renderHook, waitFor } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useNonCustodialConversionGuard } from "@app/screens/conversion-flow/hooks/use-non-custodial-conversion-guard"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  ConvertAmountAdjustment,
  PaymentResultStatus,
  type ConvertQuote,
} from "@app/types/payment"

const mockGetQuote = jest.fn()
const mockConvertMoneyAmount = jest.fn()
const mockFormatMoneyAmount = jest.fn(() => "$0.05")

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({ getConversionQuote: mockGetQuote }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
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

const defaultParams = {
  fromCurrency: WalletCurrency.Btc,
  amountInSourceCurrency: 1_000,
  fromWalletBalance: 5_000,
  enabled: true,
}

describe("useNonCustodialConversionGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertMoneyAmount.mockImplementation(
      (amount: { amount: number }, currency: WalletCurrency) =>
        currency === WalletCurrency.Btc
          ? toBtcMoneyAmount(amount.amount)
          : toUsdMoneyAmount(amount.amount),
    )
  })

  it("stays inactive and does not quote when disabled", async () => {
    const { result } = renderHook(() =>
      useNonCustodialConversionGuard({ ...defaultParams, enabled: false }),
    )

    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.blockingReason).toBeNull()
    expect(mockGetQuote).not.toHaveBeenCalled()
  })

  it("stays inactive when amountInSourceCurrency is zero", async () => {
    const { result } = renderHook(() =>
      useNonCustodialConversionGuard({ ...defaultParams, amountInSourceCurrency: 0 }),
    )

    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.blockingReason).toBeNull()
    expect(mockGetQuote).not.toHaveBeenCalled()
  })

  it("stays inactive when fromCurrency is undefined", async () => {
    const { result } = renderHook(() =>
      useNonCustodialConversionGuard({ ...defaultParams, fromCurrency: undefined }),
    )

    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.blockingReason).toBeNull()
    expect(mockGetQuote).not.toHaveBeenCalled()
  })

  it("returns null blockingReason for FlooredToMin — benign SDK floor must not block Review (Bug #2)", async () => {
    mockGetQuote.mockResolvedValue(buildQuote(ConvertAmountAdjustment.FlooredToMin))

    const { result } = renderHook(() =>
      useNonCustodialConversionGuard({
        ...defaultParams,
        amountInSourceCurrency: 50,
      }),
    )

    await waitFor(() => expect(mockGetQuote).toHaveBeenCalled())
    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.blockingReason).toBeNull()
  })

  it("forwards IncreasedToAvoidDust when amount is below balance", async () => {
    mockGetQuote.mockResolvedValue(
      buildQuote(ConvertAmountAdjustment.IncreasedToAvoidDust),
    )

    const { result } = renderHook(() =>
      useNonCustodialConversionGuard({
        ...defaultParams,
        amountInSourceCurrency: 4_500,
        fromWalletBalance: 5_000,
      }),
    )

    await waitFor(() =>
      expect(result.current.blockingReason).toBe(
        ConvertAmountAdjustment.IncreasedToAvoidDust,
      ),
    )
  })

  it("suppresses IncreasedToAvoidDust when amount equals balance (full balance guard)", async () => {
    mockGetQuote.mockResolvedValue(
      buildQuote(ConvertAmountAdjustment.IncreasedToAvoidDust),
    )

    const { result } = renderHook(() =>
      useNonCustodialConversionGuard({
        ...defaultParams,
        amountInSourceCurrency: 5_000,
        fromWalletBalance: 5_000,
      }),
    )

    await waitFor(() => expect(mockGetQuote).toHaveBeenCalled())
    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.blockingReason).toBeNull()
  })

  it("suppresses IncreasedToAvoidDust when amount exceeds balance", async () => {
    mockGetQuote.mockResolvedValue(
      buildQuote(ConvertAmountAdjustment.IncreasedToAvoidDust),
    )

    const { result } = renderHook(() =>
      useNonCustodialConversionGuard({
        ...defaultParams,
        amountInSourceCurrency: 5_500,
        fromWalletBalance: 5_000,
      }),
    )

    await waitFor(() => expect(mockGetQuote).toHaveBeenCalled())
    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.blockingReason).toBeNull()
  })

  it("returns IncreasedToAvoidDust defensively when fromWalletBalance is undefined", async () => {
    mockGetQuote.mockResolvedValue(
      buildQuote(ConvertAmountAdjustment.IncreasedToAvoidDust),
    )

    const { result } = renderHook(() =>
      useNonCustodialConversionGuard({
        ...defaultParams,
        amountInSourceCurrency: 4_500,
        fromWalletBalance: undefined,
      }),
    )

    await waitFor(() =>
      expect(result.current.blockingReason).toBe(
        ConvertAmountAdjustment.IncreasedToAvoidDust,
      ),
    )
  })

  it("returns null blockingReason when SDK reports no adjustment", async () => {
    mockGetQuote.mockResolvedValue(buildQuote())

    const { result } = renderHook(() => useNonCustodialConversionGuard(defaultParams))

    await waitFor(() => expect(mockGetQuote).toHaveBeenCalled())
    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.blockingReason).toBeNull()
  })

  it("reports isQuoting=true while the quote is in flight, then clears once the quote resolves", async () => {
    let resolveQuote: (value: ConvertQuote) => void = () => {}
    mockGetQuote.mockImplementation(
      () =>
        new Promise<ConvertQuote>((resolve) => {
          resolveQuote = resolve
        }),
    )

    const { result } = renderHook(() => useNonCustodialConversionGuard(defaultParams))

    await waitFor(() => expect(result.current.isQuoting).toBe(true))
    expect(result.current.blockingReason).toBeNull()

    resolveQuote(buildQuote(ConvertAmountAdjustment.IncreasedToAvoidDust))

    await waitFor(() =>
      expect(result.current.blockingReason).toBe(
        ConvertAmountAdjustment.IncreasedToAvoidDust,
      ),
    )
    expect(result.current.isQuoting).toBe(false)
  })

  it("surfaces hasQuoteError=true and keeps blockingReason null when the quote rejects (Critical #6)", async () => {
    mockGetQuote.mockRejectedValue(new Error("pools unavailable"))

    const { result } = renderHook(() => useNonCustodialConversionGuard(defaultParams))

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
    expect(result.current.isQuoting).toBe(false)
    expect(result.current.blockingReason).toBeNull()
  })

  it("surfaces hasQuoteError=true when the SDK returns a null quote (Critical #6)", async () => {
    mockGetQuote.mockResolvedValue(null)

    const { result } = renderHook(() => useNonCustodialConversionGuard(defaultParams))

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
    expect(result.current.blockingReason).toBeNull()
  })

  it("keeps hasQuoteError=false on the success path", async () => {
    mockGetQuote.mockResolvedValue(buildQuote())

    const { result } = renderHook(() => useNonCustodialConversionGuard(defaultParams))

    await waitFor(() => expect(mockGetQuote).toHaveBeenCalled())
    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.blockingReason).toBeNull()
    expect(result.current.hasQuoteError).toBe(false)
  })

  it("keeps hasQuoteError=false while the quote is in flight", async () => {
    mockGetQuote.mockImplementation(() => new Promise<ConvertQuote>(() => {}))

    const { result } = renderHook(() => useNonCustodialConversionGuard(defaultParams))

    await waitFor(() => expect(result.current.isQuoting).toBe(true))
    expect(result.current.hasQuoteError).toBe(false)
  })

  it("keeps hasQuoteError=false in the disabled and idle paths", async () => {
    const { result } = renderHook(() =>
      useNonCustodialConversionGuard({ ...defaultParams, enabled: false }),
    )

    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.hasQuoteError).toBe(false)
  })
})
