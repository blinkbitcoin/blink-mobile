import { act, renderHook, waitFor } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useNonCustodialConversion } from "@app/screens/conversion-flow/hooks/use-non-custodial-conversion"
import { toBtcMoneyAmount, toDisplayAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  ConvertAmountAdjustment,
  ConvertDirection,
  PaymentResultStatus,
} from "@app/types/payment.types"

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
      ConversionConfirmationScreen: {
        amountFloored: () => "Amount increased to meet the conversion minimum.",
        amountDustBumped: () => "Amount increased to convert your full balance.",
      },
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
}

const makeQuote = (
  overrides: Partial<{
    amountAdjustment?: ConvertAmountAdjustment
    execute: jest.Mock
  }> = {},
) => ({
  feeAmount: toDisplayAmount({ amount: 5, currencyCode: "USD" }),
  amountAdjustment: overrides.amountAdjustment,
  execute:
    overrides.execute ??
    jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success }),
})

describe("useNonCustodialConversion", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertMoneyAmount.mockImplementation(
      (amount: { amount: number }, currency: WalletCurrency) =>
        currency === WalletCurrency.Btc
          ? toBtcMoneyAmount(amount.amount * 100)
          : toUsdMoneyAmount(amount.amount),
    )
  })

  it("stays idle when enabled is false and does not call getQuote", async () => {
    const { result } = renderHook(() =>
      useNonCustodialConversion({ ...defaultParams, enabled: false }),
    )

    await waitFor(() => {
      expect(result.current.isQuoting).toBe(false)
    })
    expect(result.current.canExecute).toBe(false)
    expect(mockGetQuote).not.toHaveBeenCalled()
  })

  it("transitions Loading → Ready and exposes the formatted fee", async () => {
    const quote = makeQuote()
    mockGetQuote.mockResolvedValue(quote)

    const { result } = renderHook(() => useNonCustodialConversion(defaultParams))

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

    const { result } = renderHook(() => useNonCustodialConversion(defaultParams))

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
    expect(result.current.canExecute).toBe(false)
    expect(result.current.feeText).toBe("")
  })

  it("falls into Error when getQuote rejects", async () => {
    mockGetQuote.mockRejectedValue(new Error("boom"))

    const { result } = renderHook(() => useNonCustodialConversion(defaultParams))

    await waitFor(() => expect(result.current.hasQuoteError).toBe(true))
    expect(result.current.canExecute).toBe(false)
  })

  it("maps FlooredToMin adjustment to the correct text", async () => {
    mockGetQuote.mockResolvedValue(
      makeQuote({ amountAdjustment: ConvertAmountAdjustment.FlooredToMin }),
    )

    const { result } = renderHook(() => useNonCustodialConversion(defaultParams))

    await waitFor(() =>
      expect(result.current.adjustmentText).toBe(
        "Amount increased to meet the conversion minimum.",
      ),
    )
  })

  it("maps IncreasedToAvoidDust adjustment to the correct text", async () => {
    mockGetQuote.mockResolvedValue(
      makeQuote({ amountAdjustment: ConvertAmountAdjustment.IncreasedToAvoidDust }),
    )

    const { result } = renderHook(() => useNonCustodialConversion(defaultParams))

    await waitFor(() =>
      expect(result.current.adjustmentText).toBe(
        "Amount increased to convert your full balance.",
      ),
    )
  })

  it("execute() delegates to quote.execute and reports success", async () => {
    const execute = jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success })
    mockGetQuote.mockResolvedValue(makeQuote({ execute }))

    const { result } = renderHook(() => useNonCustodialConversion(defaultParams))
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

    const { result } = renderHook(() => useNonCustodialConversion(defaultParams))
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

    const { result } = renderHook(() => useNonCustodialConversion(defaultParams))
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
})
