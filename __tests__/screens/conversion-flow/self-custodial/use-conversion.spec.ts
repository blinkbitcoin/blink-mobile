import { act, renderHook, waitFor } from "@testing-library/react-native"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"

import { WalletCurrency } from "@app/graphql/generated"
import { useSelfCustodialConversion } from "@app/screens/conversion-flow/hooks/self-custodial/use-conversion"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { ConvertDirection, PaymentResultStatus } from "@app/types/payment"

const mockGetQuote = jest.fn()
const mockConvertMoneyAmount = jest.fn()
const mockOnSuccess = jest.fn()
const mockRecordError = jest.fn()

let mockConvertReady = true

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({ getConversionQuote: mockGetQuote }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockConvertReady ? mockConvertMoneyAmount : undefined,
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `$${(moneyAmount.amount / 100).toFixed(2)}`,
  }),
}))

jest.mock("@app/utils/analytics", () => ({
  logConversionAttempt: jest.fn(),
  logConversionResult: jest.fn(),
}))

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: mockRecordError }),
}))

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
  enabled: true,
  onSuccess: mockOnSuccess,
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

describe("useSelfCustodialConversion", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertReady = true
    mockConvertMoneyAmount.mockImplementation(
      (amount: { amount: number }, currency: WalletCurrency) =>
        currency === WalletCurrency.Btc
          ? toBtcMoneyAmount(amount.amount * 100)
          : toUsdMoneyAmount(amount.amount),
    )
  })

  it("stays idle without error while enabled but the price feed is unavailable", async () => {
    mockConvertReady = false

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))

    await waitFor(() => expect(result.current.isQuoting).toBe(false))
    expect(result.current.hasQuoteError).toBe(false)
    expect(result.current.canExecute).toBe(false)
    expect(mockGetQuote).not.toHaveBeenCalled()
  })

  it("stays idle when enabled is false and does not call getQuote", async () => {
    const { result } = renderHook(() =>
      useSelfCustodialConversion({ ...defaultParams, enabled: false }),
    )

    await waitFor(() => {
      expect(result.current.isQuoting).toBe(false)
    })
    expect(result.current.canExecute).toBe(false)
    expect(mockGetQuote).not.toHaveBeenCalled()
  })

  it("transitions Loading to Ready and exposes the formatted fee", async () => {
    const quote = makeQuote()
    mockGetQuote.mockResolvedValue(quote)

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))

    await waitFor(() => expect(result.current.canExecute).toBe(true))
    expect(result.current.isQuoting).toBe(false)
    expect(result.current.feeText).toBe("$0.05")
    expect(result.current.hasQuoteError).toBe(false)
    expect(mockGetQuote).toHaveBeenCalledWith({
      fromAmount: expect.objectContaining({ currency: WalletCurrency.Btc }),
      toAmount: expect.objectContaining({ currency: WalletCurrency.Usd }),
      direction: ConvertDirection.BtcToUsd,
    })
  })

  it("falls into Error when getQuote resolves to null", async () => {
    mockGetQuote.mockResolvedValue(null)

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
    expect(result.current.canExecute).toBe(false)
    expect(result.current.feeText).toBe("")
  })

  it("falls into Error when getQuote rejects", async () => {
    mockGetQuote.mockRejectedValue(new Error("boom"))

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
    expect(result.current.canExecute).toBe(false)
  })

  it("execute() runs the quote and calls onSuccess on success", async () => {
    const execute = jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success })
    mockGetQuote.mockResolvedValue(makeQuote({ execute }))

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    await act(async () => {
      await result.current.execute()
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(mockOnSuccess).toHaveBeenCalledTimes(1)
    expect(result.current.errorMessage).toBeUndefined()
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
      "notificationSuccess",
      {
        ignoreAndroidSystemSettings: true,
      },
    )
  })

  it("execute() surfaces the SDK error message and does not call onSuccess on failure", async () => {
    const execute = jest.fn().mockResolvedValue({
      status: PaymentResultStatus.Failed,
      errors: [{ message: "SDK boom" }],
    })
    mockGetQuote.mockResolvedValue(makeQuote({ execute }))

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.errorMessage).toBe("SDK boom")
    expect(mockOnSuccess).not.toHaveBeenCalled()
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith("notificationError", {
      ignoreAndroidSystemSettings: true,
    })
  })

  it("execute() sets a generic error when no quote is ready", async () => {
    mockGetQuote.mockResolvedValue(null)

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.errorMessage).toBe("Generic error")
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })

  it("execute() falls back to a generic error when the SDK fails without a message", async () => {
    const execute = jest.fn().mockResolvedValue({ status: PaymentResultStatus.Failed })
    mockGetQuote.mockResolvedValue(makeQuote({ execute }))

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.errorMessage).toBe("Generic error")
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })

  it("execute() records a thrown error to crashlytics and surfaces its message", async () => {
    const execute = jest.fn().mockRejectedValue(new Error("SDK exploded"))
    mockGetQuote.mockResolvedValue(makeQuote({ execute }))

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    await act(async () => {
      await result.current.execute()
    })

    expect(mockRecordError).toHaveBeenCalledWith(expect.any(Error))
    expect(result.current.errorMessage).toBe("SDK exploded")
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })

  it("snapshots the first Ready quote and stops re-quoting on price ticks", async () => {
    const quote = makeQuote()
    mockGetQuote.mockResolvedValue(quote)

    const { result, rerender } = renderHook(() =>
      useSelfCustodialConversion(defaultParams),
    )

    await waitFor(() => expect(result.current.canExecute).toBe(true))
    expect(mockGetQuote).toHaveBeenCalledTimes(1)

    // Simulate a realtime-price tick: the price-conversion hook returns a new
    // identity for convertMoneyAmount, so liveQuoteParams would change.
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

  it("re-quotes after a failed execute so the retry never replays a stale quote", async () => {
    const failingExecute = jest.fn().mockResolvedValue({
      status: PaymentResultStatus.Failed,
      errors: [{ message: "SDK boom" }],
    })
    const succeedingExecute = jest
      .fn()
      .mockResolvedValue({ status: PaymentResultStatus.Success })
    mockGetQuote
      .mockResolvedValueOnce(makeQuote({ execute: failingExecute }))
      .mockResolvedValueOnce(makeQuote({ execute: succeedingExecute }))

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.errorMessage).toBe("SDK boom")
    await waitFor(() => expect(mockGetQuote).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    await act(async () => {
      await result.current.execute()
    })

    expect(failingExecute).toHaveBeenCalledTimes(1)
    expect(succeedingExecute).toHaveBeenCalledTimes(1)
  })

  it("re-quotes the live amount when the balance changed while the conversion was in flight", async () => {
    let rejectExecute: (err: Error) => void
    const hangingExecute = jest.fn().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectExecute = reject
        }),
    )
    mockGetQuote.mockResolvedValue(makeQuote({ execute: hangingExecute }))

    const { result, rerender } = renderHook(
      (params: typeof defaultParams) => useSelfCustodialConversion(params),
      { initialProps: defaultParams },
    )
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    let executePromise: Promise<unknown> = Promise.resolve()
    act(() => {
      executePromise = result.current.execute()
    })

    rerender({ ...defaultParams, moneyAmount: toUsdMoneyAmount(700) })
    await waitFor(() => expect(mockGetQuote).toHaveBeenCalledTimes(2))

    await act(async () => {
      rejectExecute!(new Error("conversion failed"))
      await executePromise
    })

    /** The failure re-quote must pin the live 700-cent amount, not the
     *  press-time 500-cent one. */
    await waitFor(() => expect(mockGetQuote).toHaveBeenCalledTimes(3))
    expect(mockGetQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fromAmount: expect.objectContaining({ amount: 70000 }),
      }),
    )
  })

  it("execute() surfaces a generic error and re-quotes when the SDK throws a non-Error", async () => {
    const execute = jest.fn().mockRejectedValue("string failure")
    mockGetQuote.mockResolvedValue(makeQuote({ execute }))

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.errorMessage).toBe("Generic error")
    expect(mockRecordError).toHaveBeenCalledWith(expect.any(Error))
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith("notificationError", {
      ignoreAndroidSystemSettings: true,
    })
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })

  it("ignores a second execute() while the first is still in flight", async () => {
    const execute = jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success })
    mockGetQuote.mockResolvedValue(makeQuote({ execute }))

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    await act(async () => {
      await Promise.all([result.current.execute(), result.current.execute()])
    })

    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("keeps loading until the awaited onSuccess settles", async () => {
    let resolveSuccess: () => void
    mockOnSuccess.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSuccess = resolve
      }),
    )
    mockGetQuote.mockResolvedValue(makeQuote())

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.canExecute).toBe(true))

    let executePromise: Promise<unknown> = Promise.resolve()
    act(() => {
      executePromise = result.current.execute()
    })

    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalledTimes(1))
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveSuccess!()
      await executePromise
    })

    expect(result.current.loading).toBe(false)
  })

  it("requote() stays put while the price feed is unavailable", async () => {
    mockConvertReady = false

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.isQuoting).toBe(false))

    act(() => {
      result.current.requote()
    })

    expect(mockGetQuote).not.toHaveBeenCalled()
  })

  it("requote() fetches a fresh quote after a quote error", async () => {
    mockGetQuote.mockRejectedValueOnce(new Error("quote down"))

    const { result } = renderHook(() => useSelfCustodialConversion(defaultParams))
    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))

    mockGetQuote.mockResolvedValue(makeQuote())
    act(() => {
      result.current.requote()
    })

    await waitFor(() => expect(result.current.canExecute).toBe(true))
    expect(mockGetQuote).toHaveBeenCalledTimes(2)
  })

  it("re-quotes when moneyAmount changes and execute() runs the latest quote", async () => {
    const firstQuote = makeQuote({ execute: jest.fn() })
    const secondQuote = makeQuote({
      execute: jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success }),
    })
    mockGetQuote.mockResolvedValueOnce(firstQuote).mockResolvedValueOnce(secondQuote)

    const { result, rerender } = renderHook(
      (params: typeof defaultParams) => useSelfCustodialConversion(params),
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
