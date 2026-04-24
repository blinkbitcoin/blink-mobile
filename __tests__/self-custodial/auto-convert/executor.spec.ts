import { ConvertErrorCode, PaymentResultStatus } from "@app/types/payment.types"

import {
  executeAutoConvert,
  fetchAutoConvertMinSats,
  waitForPaymentCompleted,
} from "@app/self-custodial/auto-convert/executor"

const mockGetConversionQuote = jest.fn()
const mockFetchLimits = jest.fn()
const mockFetchDecimals = jest.fn()

jest.mock("@app/self-custodial/bridge/convert", () => ({
  createGetConversionQuote:
    () =>
    (...args: unknown[]) =>
      mockGetConversionQuote(...args),
}))

jest.mock("@app/self-custodial/bridge/limits", () => ({
  fetchConversionLimits: (...args: unknown[]) => mockFetchLimits(...args),
}))

jest.mock("@app/self-custodial/bridge/token-balance", () => ({
  fetchUsdbDecimals: (...args: unknown[]) => mockFetchDecimals(...args),
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  ConversionStatus: { Completed: "Completed", Pending: "Pending" },
  PaymentStatus: { Completed: "Completed", Pending: "Pending" },
  GetPaymentRequest: { create: (p: Record<string, unknown>) => p },
  ListPaymentsRequest: { create: (p: Record<string, unknown>) => p },
}))

const flushPromises = () =>
  new Promise((resolve) => {
    setImmediate(resolve)
  })

describe("waitForPaymentCompleted", () => {
  const options = { maxAttempts: 3, intervalMs: 10 }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns true on the first poll that reports Completed", async () => {
    const sdk = {
      getPayment: jest.fn().mockResolvedValue({
        payment: { status: "Completed" },
      }),
    }

    const settled = await waitForPaymentCompleted(sdk as never, "pid-1", options)

    expect(settled).toBe(true)
    expect(sdk.getPayment).toHaveBeenCalledTimes(1)
  })

  it("polls until Completed within the budget", async () => {
    const sdk = {
      getPayment: jest
        .fn()
        .mockResolvedValueOnce({ payment: { status: "Pending" } })
        .mockResolvedValueOnce({ payment: { status: "Pending" } })
        .mockResolvedValueOnce({ payment: { status: "Completed" } }),
    }

    const settled = await waitForPaymentCompleted(sdk as never, "pid", options)

    expect(settled).toBe(true)
    expect(sdk.getPayment).toHaveBeenCalledTimes(3)
  })

  it("returns false after exhausting maxAttempts without Completed", async () => {
    const sdk = {
      getPayment: jest.fn().mockResolvedValue({ payment: { status: "Pending" } }),
    }

    const settled = await waitForPaymentCompleted(sdk as never, "pid", options)

    expect(settled).toBe(false)
    expect(sdk.getPayment).toHaveBeenCalledTimes(3)
  })

  it("swallows transient getPayment errors and keeps polling", async () => {
    const sdk = {
      getPayment: jest
        .fn()
        .mockRejectedValueOnce(new Error("transient"))
        .mockResolvedValueOnce({ payment: { status: "Completed" } }),
    }

    const settled = await waitForPaymentCompleted(sdk as never, "pid", options)

    expect(settled).toBe(true)
    expect(sdk.getPayment).toHaveBeenCalledTimes(2)
  })
})

describe("fetchAutoConvertMinSats", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchDecimals.mockResolvedValue(6)
  })

  it("returns the pool's minFromAmount verbatim", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 800, minToAmount: null })

    const result = await fetchAutoConvertMinSats({} as never)

    expect(result).toBe(800)
  })

  it("returns undefined when minFromAmount is null", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: null, minToAmount: null })

    expect(await fetchAutoConvertMinSats({} as never)).toBeUndefined()
  })

  it("returns undefined on SDK failure (fail-open for the caller)", async () => {
    mockFetchLimits.mockRejectedValue(new Error("sdk down"))

    expect(await fetchAutoConvertMinSats({} as never)).toBeUndefined()
  })
})

describe("executeAutoConvert", () => {
  const baseParams = {
    satsAmount: 5000,
    usdCentsAmount: 100,
    isStableBalanceActive: false,
    recordCreatedAtMs: 1_000_000,
  }

  const sdkWith = (payments: unknown[]) =>
    ({
      listPayments: jest.fn().mockResolvedValue({ payments }),
    }) as never

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const successQuote = () => ({
    execute: jest.fn().mockResolvedValue({ status: PaymentResultStatus.Success }),
  })

  it("short-circuits with SkippedStableBalanceActive when the sweep owns the conversion", async () => {
    const outcome = await executeAutoConvert(sdkWith([]), {
      ...baseParams,
      isStableBalanceActive: true,
    })

    expect(outcome).toEqual({ status: "skipped-stable-balance-active" })
    expect(mockGetConversionQuote).not.toHaveBeenCalled()
  })

  it("detects a prior matching conversion and returns AlreadyConverted", async () => {
    const outcome = await executeAutoConvert(
      sdkWith([
        {
          conversionDetails: {
            status: "Completed",
            from: { amount: 5000n },
          },
          timestamp: 2000n, // seconds; paymentMs = 2_000_000
        },
      ]),
      baseParams,
    )

    expect(outcome).toEqual({ status: "already-converted" })
    expect(mockGetConversionQuote).not.toHaveBeenCalled()
  })

  it("ignores conversions recorded before the pending record was created", async () => {
    mockGetConversionQuote.mockResolvedValue(successQuote())

    const outcome = await executeAutoConvert(
      sdkWith([
        {
          conversionDetails: {
            status: "Completed",
            from: { amount: 5000n },
          },
          timestamp: 500n, // paymentMs = 500_000 < recordCreatedAtMs (1_000_000)
        },
      ]),
      baseParams,
    )

    expect(outcome).toEqual({ status: "converted" })
    expect(mockGetConversionQuote).toHaveBeenCalled()
  })

  it("tolerates ±5% amount drift when matching prior conversions", async () => {
    const outcome = await executeAutoConvert(
      sdkWith([
        {
          conversionDetails: {
            status: "Completed",
            from: { amount: 5200n }, // 4% off of 5000
          },
          timestamp: 2000n,
        },
      ]),
      baseParams,
    )

    expect(outcome).toEqual({ status: "already-converted" })
  })

  it("does NOT match a conversion whose amount drift exceeds the tolerance", async () => {
    mockGetConversionQuote.mockResolvedValue(successQuote())

    await executeAutoConvert(
      sdkWith([
        {
          conversionDetails: {
            status: "Completed",
            from: { amount: 10_000n }, // 100% off
          },
          timestamp: 2000n,
        },
      ]),
      baseParams,
    )

    expect(mockGetConversionQuote).toHaveBeenCalled()
  })

  it("requests a quote and returns Converted on success", async () => {
    mockGetConversionQuote.mockResolvedValue(successQuote())

    const outcome = await executeAutoConvert(sdkWith([]), baseParams)

    expect(outcome).toEqual({ status: "converted" })
  })

  it("returns SkippedBelowMin when getConversionQuote throws BelowMinimum", async () => {
    mockGetConversionQuote.mockRejectedValue(
      Object.assign(new Error("below"), { code: ConvertErrorCode.BelowMinimum }),
    )

    const outcome = await executeAutoConvert(sdkWith([]), baseParams)

    expect(outcome).toEqual({ status: "skipped-below-min" })
  })

  it("returns Failed when getConversionQuote throws any other error", async () => {
    mockGetConversionQuote.mockRejectedValue(new Error("network"))

    const outcome = await executeAutoConvert(sdkWith([]), baseParams)

    expect(outcome).toEqual({ status: "failed" })
  })

  it("returns Failed when getConversionQuote returns null (no estimate)", async () => {
    mockGetConversionQuote.mockResolvedValue(null)

    const outcome = await executeAutoConvert(sdkWith([]), baseParams)

    expect(outcome).toEqual({ status: "failed" })
  })

  it("returns Failed when execute() reports failure", async () => {
    mockGetConversionQuote.mockResolvedValue({
      execute: jest.fn().mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "send failed" }],
      }),
    })

    const outcome = await executeAutoConvert(sdkWith([]), baseParams)

    expect(outcome).toEqual({ status: "failed" })
  })

  it("treats a listPayments failure as 'no prior conversion' (fail-open)", async () => {
    mockGetConversionQuote.mockResolvedValue(successQuote())
    const sdk = {
      listPayments: jest.fn().mockRejectedValue(new Error("network")),
    }

    const outcome = await executeAutoConvert(sdk as never, baseParams)

    expect(outcome).toEqual({ status: "converted" })
    await flushPromises()
  })
})
