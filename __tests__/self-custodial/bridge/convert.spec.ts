import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { ConvertDirection, ConvertErrorCode } from "@app/types/payment.types"

import {
  createConvert,
  createGetConversionQuote,
} from "@app/self-custodial/bridge/convert"

const mockFetchLimits = jest.fn()

jest.mock("@app/self-custodial/bridge/limits", () => {
  const actual = jest.requireActual("@app/self-custodial/bridge/limits")
  return {
    ...actual,
    fetchConversionLimits: (...args: unknown[]) => mockFetchLimits(...args),
  }
})

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: { tokenIdentifier: "usdb-token-id", maxSlippageBps: 50 },
  SparkToken: { Label: "USDB", DefaultDecimals: 6 },
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  AmountAdjustmentReason: {
    FlooredToMinLimit: "FlooredToMinLimit",
    IncreasedToAvoidDust: "IncreasedToAvoidDust",
  },
  ConversionType: {
    FromBitcoin: class {
      readonly tag = "FromBitcoin"
    },
    ToBitcoin: class {
      readonly tag = "ToBitcoin"
      inner: Record<string, unknown>
      constructor(inner: Record<string, unknown>) {
        this.inner = inner
      }
    },
  },
  PrepareSendPaymentRequest: { create: (p: Record<string, unknown>) => p },
  ReceivePaymentRequest: { create: (p: Record<string, unknown>) => p },
  ReceivePaymentMethod: {
    SparkInvoice: class {
      inner: Record<string, unknown>
      constructor(inner: Record<string, unknown>) {
        this.inner = inner
      }
    },
  },
  SendPaymentRequest: { create: (p: Record<string, unknown>) => p },
}))

/** Minimal SDK that responds to prepareSendPayment with a fixed rate. */
const createSdk = (options?: {
  /** amountIn produced per (destination / ratioDenominator) — simulates rate+fee. */
  rateNumerator?: bigint
  rateDenominator?: bigint
  balanceSats?: bigint
  usdbBalance?: bigint
}) => {
  const rateNumerator = options?.rateNumerator ?? 1n
  const rateDenominator = options?.rateDenominator ?? 1n
  const balanceSats = options?.balanceSats ?? 1_000_000_000n
  const usdbBalance = options?.usdbBalance ?? 1_000_000_000n

  return {
    prepareSendPayment: jest.fn().mockImplementation((req: { amount: bigint }) => ({
      conversionEstimate: {
        amountIn: (req.amount * rateNumerator) / rateDenominator,
        amountOut: req.amount,
        fee: 0n,
        amountAdjustment: undefined,
      },
    })),
    sendPayment: jest.fn().mockResolvedValue(undefined),
    receivePayment: jest
      .fn()
      .mockResolvedValue({ paymentRequest: "sp1own-spark-address" }),
    getInfo: jest.fn().mockResolvedValue({
      balanceSats,
      tokenBalances: {
        "usdb-token-id": {
          balance: usdbBalance,
          tokenMetadata: { identifier: "usdb-token-id", decimals: 6 },
        },
      },
    }),
  }
}

describe("createConvert — BTC → USD exact-input", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("runs discovery before the final quote and sends the prepared response", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 1000, minToAmount: null })
    // 1 sat per base-unit rate (1:1) so amountIn == destination.
    const sdk = createSdk({ rateNumerator: 1n, rateDenominator: 1n })

    const result = await createConvert(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe("success")
    // Discovery + final (no correction needed when rate is exact).
    expect(sdk.prepareSendPayment).toHaveBeenCalledTimes(2)
    // Final call (second) targets the computed destination, not the user's raw toAmount.
    const finalCall = sdk.prepareSendPayment.mock.calls[1][0]
    expect(finalCall.tokenIdentifier).toBe("usdb-token-id")
    expect(finalCall.conversionOptions.conversionType).toEqual({ tag: "FromBitcoin" })
    expect(sdk.sendPayment).toHaveBeenCalled()
    // sendPayment receives the final prepare response.
    expect(sdk.sendPayment.mock.calls[0][0].prepareResponse).toBeDefined()
  })

  it("runs a correction quote when the final overshoots inputAmount", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 500, minToAmount: null })
    // Rate fluctuates: first two calls return amountIn > destination to force
    // the final to overshoot; correction brings it under.
    const sdk = createSdk()
    sdk.prepareSendPayment
      // Discovery: cheap rate (amountIn == destination / 2).
      .mockImplementationOnce((req: { amount: bigint }) => ({
        conversionEstimate: {
          amountIn: req.amount / 2n,
          amountOut: req.amount,
          fee: 0n,
        },
      }))
      // Final: scaled target overshoots (amountIn > inputAmount).
      .mockImplementationOnce((req: { amount: bigint }) => ({
        conversionEstimate: {
          amountIn: req.amount + 1000n, // overshoot
          amountOut: req.amount,
          fee: 0n,
        },
      }))
      // Correction: fits.
      .mockImplementationOnce((req: { amount: bigint }) => ({
        conversionEstimate: {
          amountIn: req.amount,
          amountOut: req.amount,
          fee: 0n,
        },
      }))

    const result = await createConvert(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe("success")
    expect(sdk.prepareSendPayment).toHaveBeenCalledTimes(3)
  })

  it("caps inputAmount at the SDK's real balance so we never target more than the wallet holds", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 10, minToAmount: null })
    // User claims 10000 sats but the SDK says 500 sats actually available.
    const sdk = createSdk({ rateNumerator: 1n, rateDenominator: 1n, balanceSats: 500n })

    await createConvert(sdk as never)({
      fromAmount: toBtcMoneyAmount(10000),
      toAmount: toUsdMoneyAmount(100),
      direction: ConvertDirection.BtcToUsd,
    })

    // Final (second call) targets the capped balance, not the user's requested amount.
    const finalCall = sdk.prepareSendPayment.mock.calls[1][0]
    expect(finalCall.amount <= 500n).toBe(true)
  })

  it("clamps discovery destination above minFromAmount translated via UI rate", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 800, minToAmount: null })
    const sdk = createSdk({ rateNumerator: 1n, rateDenominator: 1n })

    // 1339 sats → 105 cents. Half of 105 = 52 cents → implies amountIn < 800 sats.
    // The clamp raises the discovery destination so the implied input stays above 800.
    await createConvert(sdk as never)({
      fromAmount: toBtcMoneyAmount(1339),
      toAmount: toUsdMoneyAmount(105),
      direction: ConvertDirection.BtcToUsd,
    })

    const discoveryCall = sdk.prepareSendPayment.mock.calls[0][0]
    // 800 sats at 1:1 rate = 800 base units of USDB; with 10% margin ≈ 880.
    // centsToTokenBaseUnits(63 cents, 6 decimals) = 630_000.
    // Anything ≥ 800 base units is acceptable evidence the clamp worked.
    expect(discoveryCall.amount >= 800n).toBe(true)
  })

  it("rejects with BelowMinimum when fromAmount is under minFromAmount", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 10000, minToAmount: null })
    const sdk = createSdk()

    const result = await createConvert(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe("failed")
    expect(result.errors?.[0].code).toBe(ConvertErrorCode.BelowMinimum)
    expect(sdk.prepareSendPayment).not.toHaveBeenCalled()
    expect(sdk.sendPayment).not.toHaveBeenCalled()
  })

  it("returns LimitsUnavailable when fetchConversionLimits throws", async () => {
    mockFetchLimits.mockRejectedValue(new Error("limits unavailable"))
    const sdk = createSdk()

    const result = await createConvert(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe("failed")
    expect(result.errors?.[0].code).toBe(ConvertErrorCode.LimitsUnavailable)
    expect(sdk.prepareSendPayment).not.toHaveBeenCalled()
    expect(sdk.sendPayment).not.toHaveBeenCalled()
  })

  it("falls back to discovery when the final prepare throws", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: null, minToAmount: null })
    const sdk = createSdk()
    sdk.prepareSendPayment
      .mockImplementationOnce((req: { amount: bigint }) => ({
        conversionEstimate: {
          amountIn: req.amount,
          amountOut: req.amount,
          fee: 0n,
        },
      }))
      .mockRejectedValueOnce(new Error("final failed"))

    const result = await createConvert(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    // Discovery succeeded so we still ship its prepared response.
    expect(result.status).toBe("success")
    expect(sdk.sendPayment).toHaveBeenCalled()
  })
})

describe("createConvert — USD → BTC", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("uses ToBitcoin conversion type and destination in sats", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 10, minToAmount: 500 })
    const sdk = createSdk({ rateNumerator: 1n, rateDenominator: 1n })

    const result = await createConvert(sdk as never)({
      fromAmount: toUsdMoneyAmount(100),
      toAmount: toBtcMoneyAmount(1300),
      direction: ConvertDirection.UsdToBtc,
    })

    expect(result.status).toBe("success")
    const finalCall = sdk.prepareSendPayment.mock.calls[1][0]
    expect(finalCall.tokenIdentifier).toBeUndefined()
    expect(finalCall.conversionOptions.conversionType).toEqual({
      tag: "ToBitcoin",
      inner: { fromTokenIdentifier: "usdb-token-id" },
    })
    expect(finalCall.conversionOptions.maxSlippageBps).toBe(50)
  })
})

describe("createGetConversionQuote", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns null without throwing when the quote fails", async () => {
    mockFetchLimits.mockRejectedValue(new Error("limits unavailable"))
    const sdk = createSdk()

    const quote = await createGetConversionQuote(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(quote).toBeNull()
  })

  it("returns a quote with a formatted fee and an execute() that calls sendPayment", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: null, minToAmount: null })
    const sdk = createSdk({ rateNumerator: 1n, rateDenominator: 1n })

    const quote = await createGetConversionQuote(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(quote).not.toBeNull()
    expect(quote?.feeAmount.currency).toBe("DisplayCurrency")
    expect(quote?.feeAmount.currencyCode).toBe("USD")
    expect(typeof quote?.feeAmount.amount).toBe("number")
    expect(sdk.sendPayment).not.toHaveBeenCalled()
    await quote?.execute()
    expect(sdk.sendPayment).toHaveBeenCalled()
  })
})

describe("createConvert — execution errors", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchLimits.mockResolvedValue({ minFromAmount: null, minToAmount: null })
  })

  it("propagates sendPayment failure as Failed result with the SDK message", async () => {
    const sdk = createSdk()
    sdk.sendPayment.mockRejectedValue(new Error("send failed"))

    const result = await createConvert(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe("failed")
    expect(result.errors?.[0].message).toBe("send failed")
  })
})
