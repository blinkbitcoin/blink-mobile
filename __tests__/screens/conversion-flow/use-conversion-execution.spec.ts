import { act, renderHook, waitFor } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useConversionExecution } from "@app/screens/conversion-flow/hooks/use-conversion-execution"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { ConvertDirection, PaymentResultStatus } from "@app/types/payment"

const mockGetQuote = jest.fn()
const mockConvertMoneyAmount = jest.fn()

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({ convert: { getQuote: mockGetQuote } }),
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

jest.mock("@app/utils/analytics", () => ({
  logConversionAttempt: jest.fn(),
}))

jest.mock("@react-native-firebase/crashlytics", () => {
  const recordError = jest.fn()
  return {
    __esModule: true,
    default: () => ({ recordError }),
  }
})

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      errors: {
        generic: () => "Generic error",
      },
    },
  }),
}))

const defaultParams = {
  fromCurrency: WalletCurrency.Btc,
  moneyAmount: toUsdMoneyAmount(500),
}

const makeQuote = (
  overrides: Partial<{
    feeAmount: ReturnType<typeof toUsdMoneyAmount>
    execute: jest.Mock
  }> = {},
) => ({
  feeAmount: overrides.feeAmount ?? toUsdMoneyAmount(5),
  execute:
    overrides.execute ??
    jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success }),
})

describe("useConversionExecution", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertMoneyAmount.mockImplementation(
      (amount: { amount: number }, currency: WalletCurrency) =>
        currency === WalletCurrency.Btc
          ? toBtcMoneyAmount(amount.amount * 100)
          : toUsdMoneyAmount(amount.amount),
    )
  })

  it("transitions Loading → Ready and exposes the formatted fee", async () => {
    const quote = makeQuote()
    mockGetQuote.mockResolvedValue(quote)

    const { result } = renderHook(() => useConversionExecution(defaultParams))

    await waitFor(() => expect(result.current.canExecute).toBe(true))
    expect(result.current.isQuoting).toBe(false)
    expect(result.current.feeText).toBe("$0.05")
    expect(result.current.hasQuoteError).toBe(false)
    expect(result.current.hasFee).toBe(true)
    expect(mockGetQuote).toHaveBeenCalledWith({
      fromAmount: expect.objectContaining({ currency: WalletCurrency.Btc }),
      toAmount: expect.objectContaining({ currency: WalletCurrency.Usd }),
      direction: ConvertDirection.BtcToUsd,
    })
  })

  it("reports hasFee=false when the quote fee is zero (custodial intra-ledger path)", async () => {
    mockGetQuote.mockResolvedValue(makeQuote({ feeAmount: toUsdMoneyAmount(0) }))

    const { result } = renderHook(() => useConversionExecution(defaultParams))

    await waitFor(() => expect(result.current.canExecute).toBe(true))
    expect(result.current.hasFee).toBe(false)
  })

  it("falls into Error when getQuote resolves to null", async () => {
    mockGetQuote.mockResolvedValue(null)

    const { result } = renderHook(() => useConversionExecution(defaultParams))

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
    expect(result.current.canExecute).toBe(false)
    expect(result.current.feeText).toBe("")
  })

  it("falls into Error when getQuote rejects", async () => {
    mockGetQuote.mockRejectedValue(new Error("boom"))

    const { result } = renderHook(() => useConversionExecution(defaultParams))

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
    expect(result.current.canExecute).toBe(false)
  })

  it("execute() delegates to quote.execute and reports success", async () => {
    const execute = jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success })
    mockGetQuote.mockResolvedValue(makeQuote({ execute }))

    const { result } = renderHook(() => useConversionExecution(defaultParams))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    let outcome: Awaited<ReturnType<typeof result.current.execute>> | undefined
    await act(async () => {
      outcome = await result.current.execute()
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(outcome).toEqual({ status: PaymentResultStatus.Success })
  })

  it("execute() surfaces the SDK error message on failure", async () => {
    const execute = jest.fn().mockResolvedValue({
      status: PaymentResultStatus.Failed,
      errors: [{ message: "SDK boom" }],
    })
    mockGetQuote.mockResolvedValue(makeQuote({ execute }))

    const { result } = renderHook(() => useConversionExecution(defaultParams))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    let outcome: Awaited<ReturnType<typeof result.current.execute>> | undefined
    await act(async () => {
      outcome = await result.current.execute()
    })

    expect(outcome).toEqual({
      status: PaymentResultStatus.Failed,
      message: "SDK boom",
    })
  })

  it("execute() refuses to run when no quote is ready", async () => {
    mockGetQuote.mockResolvedValue(null)

    const { result } = renderHook(() => useConversionExecution(defaultParams))
    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))

    let outcome: Awaited<ReturnType<typeof result.current.execute>> | undefined
    await act(async () => {
      outcome = await result.current.execute()
    })

    expect(outcome).toEqual({
      status: PaymentResultStatus.Failed,
      message: "Generic error",
    })
  })

  it("snapshots the first Ready quote and stops re-quoting on price ticks", async () => {
    const quote = makeQuote()
    mockGetQuote.mockResolvedValue(quote)

    const { result, rerender } = renderHook(() => useConversionExecution(defaultParams))

    await waitFor(() => expect(result.current.canExecute).toBe(true))
    expect(mockGetQuote).toHaveBeenCalledTimes(1)

    mockConvertMoneyAmount.mockImplementation(
      (amount: { amount: number }, currency: WalletCurrency) =>
        currency === WalletCurrency.Btc
          ? toBtcMoneyAmount(amount.amount * 101)
          : toUsdMoneyAmount(amount.amount),
    )
    rerender({})

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 600)
    })
    expect(mockGetQuote).toHaveBeenCalledTimes(1)
  })

  it("re-quotes when moneyAmount changes and execute() runs the latest quote", async () => {
    const firstQuote = makeQuote({ execute: jest.fn() })
    const secondQuote = makeQuote({
      execute: jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success }),
    })
    mockGetQuote.mockResolvedValueOnce(firstQuote).mockResolvedValueOnce(secondQuote)

    const { result, rerender } = renderHook(
      (params: typeof defaultParams) => useConversionExecution(params),
      { initialProps: defaultParams },
    )

    await waitFor(() => expect(result.current.canExecute).toBe(true))

    rerender({ ...defaultParams, moneyAmount: toUsdMoneyAmount(700) })

    await waitFor(() => expect(mockGetQuote).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    await act(async () => {
      await result.current.execute()
    })

    expect(secondQuote.execute).toHaveBeenCalledTimes(1)
    expect(firstQuote.execute).not.toHaveBeenCalled()
  })
})
