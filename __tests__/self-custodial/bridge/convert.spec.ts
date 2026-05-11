import { AmountAdjustmentReason } from "@breeztech/breez-sdk-spark-react-native"

import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  ConvertAmountAdjustment,
  ConvertDirection,
  ConvertErrorCode,
} from "@app/types/payment.types"
import { WalletCurrency } from "@app/graphql/generated"

import { createGetConversionQuote } from "@app/self-custodial/bridge/convert"

const mockFetchLimits = jest.fn()
const mockRequireTokenId = jest.fn(() => "usdb-token-id")
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: mockRecordError, log: jest.fn() }),
}))

jest.mock("@app/self-custodial/bridge/limits", () => {
  const actual = jest.requireActual("@app/self-custodial/bridge/limits")
  return {
    ...actual,
    fetchConversionLimits: (...args: unknown[]) => mockFetchLimits(...args),
  }
})

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: { maxSlippageBps: 50 },
  requireSparkTokenIdentifier: () => mockRequireTokenId(),
  SparkToken: { Label: "USDB", DefaultDecimals: 6 },
}))

const createSdk = () => ({
  prepareSendPayment: jest.fn().mockResolvedValue({
    paymentMethod: {},
    conversionEstimate: {
      fee: BigInt(50000),
      amountAdjustment: undefined,
    },
  }),
  sendPayment: jest.fn().mockResolvedValue(undefined),
  syncWallet: jest.fn().mockResolvedValue(undefined),
  receivePayment: jest.fn().mockResolvedValue({ paymentRequest: "sp1own-spark-address" }),
  getInfo: jest.fn().mockResolvedValue({
    balanceSats: 1_000_000_000n,
    tokenBalances: {
      "usdb-token-id": {
        balance: 1_000_000_000n,
        tokenMetadata: { identifier: "usdb-token-id", decimals: 6 },
      },
    },
  }),
})

describe("createGetConversionQuote — BTC → USD", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("prepares a payment to own spark address with FromBitcoin conversion and USDB destination amount in token base units", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 1000, minToAmount: 0 })
    const sdk = createSdk()

    const quote = await createGetConversionQuote(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(quote).not.toBeNull()
    expect(sdk.receivePayment).toHaveBeenCalled()
    // Exact-input algorithm runs at least one prepare call (discovery); the
    // destination amount is dynamic based on rate, so we only assert the
    // SDK contract (token id + conversion options) is wired correctly.
    const prepArg = sdk.prepareSendPayment.mock.calls[0][0]
    expect(prepArg.paymentRequest).toBe("sp1own-spark-address")
    expect(prepArg.tokenIdentifier).toBe("usdb-token-id")
    expect(prepArg.conversionOptions.conversionType).toEqual({ tag: "FromBitcoin" })
    expect(prepArg.conversionOptions.maxSlippageBps).toBe(50)
  })

  it("execute() sends the prepared payment and returns success", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 1000, minToAmount: 0 })
    const sdk = createSdk()

    const quote = await createGetConversionQuote(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    const result = await quote!.execute()

    expect(result.status).toBe("success")
    expect(sdk.sendPayment).toHaveBeenCalled()
    // Post-send syncWallet is load-bearing: until Breez materializes token balances
    // on payment insert, getInfo stays misaligned with the convert result without it.
    expect(sdk.syncWallet).toHaveBeenCalled()
  })

  it("exposes the estimated fee converted to a USD MoneyAmount in cents", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 0, minToAmount: 0 })
    const sdk = createSdk()

    const quote = await createGetConversionQuote(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(quote!.feeAmount.currency).toBe(WalletCurrency.Usd)
    expect(quote!.feeAmount.amount).toBe(5)
  })

  it("throws BelowMinimum and records to crashlytics when fromAmount is under the SDK minimum", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 10000, minToAmount: 0 })
    const sdk = createSdk()

    await expect(
      createGetConversionQuote(sdk as never)({
        fromAmount: toBtcMoneyAmount(5000),
        toAmount: toUsdMoneyAmount(137),
        direction: ConvertDirection.BtcToUsd,
      }),
    ).rejects.toMatchObject({ code: ConvertErrorCode.BelowMinimum })

    expect(mockRecordError).toHaveBeenCalled()
    expect(sdk.prepareSendPayment).not.toHaveBeenCalled()
  })

  it("throws LimitsUnavailable and records to crashlytics when fetchConversionLimits throws", async () => {
    mockFetchLimits.mockRejectedValue(new Error("limits unavailable"))
    const sdk = createSdk()

    await expect(
      createGetConversionQuote(sdk as never)({
        fromAmount: toBtcMoneyAmount(5000),
        toAmount: toUsdMoneyAmount(137),
        direction: ConvertDirection.BtcToUsd,
      }),
    ).rejects.toMatchObject({ code: ConvertErrorCode.LimitsUnavailable })

    expect(mockRecordError).toHaveBeenCalled()
    expect(sdk.prepareSendPayment).not.toHaveBeenCalled()
  })

  it("skips minimum check when minFromAmount is null (no limit)", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: null, minToAmount: null })
    const sdk = createSdk()

    const quote = await createGetConversionQuote(sdk as never)({
      fromAmount: toBtcMoneyAmount(100),
      toAmount: toUsdMoneyAmount(7),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(quote).not.toBeNull()
  })

  it("clamps the discovery destination up to minToAmount when it dominates (Important #8)", async () => {
    // Target=2000 cents → halfDestination=1000; minFromAmount=0 → fromMin=0;
    // minToAmount=1500 dominates the Math.max so the discovery destination
    // is the to-side floor (1500 cents → 15_000_000 token base units at 6 decimals).
    mockFetchLimits.mockResolvedValue({ minFromAmount: 0, minToAmount: 1500 })
    const sdk = createSdk()

    await createGetConversionQuote(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(2000),
      direction: ConvertDirection.BtcToUsd,
    })

    const prepArg = sdk.prepareSendPayment.mock.calls[0][0]
    expect(prepArg.amount).toBe(BigInt(1500 * 10 ** 4))
  })
})

describe("createGetConversionQuote — USD → BTC", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("prepares a payment with ToBitcoin conversion and sat destination amount", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 10, minToAmount: 500 })
    const sdk = createSdk()

    const quote = await createGetConversionQuote(sdk as never)({
      fromAmount: toUsdMoneyAmount(100),
      toAmount: toBtcMoneyAmount(1300),
      direction: ConvertDirection.UsdToBtc,
    })

    expect(quote).not.toBeNull()
    const arg = sdk.prepareSendPayment.mock.calls[0][0]
    expect(arg.paymentRequest).toBe("sp1own-spark-address")
    expect(arg.tokenIdentifier).toBeUndefined()
    expect(arg.conversionOptions.conversionType).toEqual({
      tag: "ToBitcoin",
      inner: { fromTokenIdentifier: "usdb-token-id" },
    })
    expect(arg.conversionOptions.maxSlippageBps).toBe(50)
  })
})

describe("createGetConversionQuote — error handling", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchLimits.mockResolvedValue({ minFromAmount: null, minToAmount: null })
  })

  it("re-throws and records to crashlytics when prepareSendPayment fails", async () => {
    const sdk = {
      prepareSendPayment: jest.fn().mockRejectedValue(new Error("prepare failed")),
      sendPayment: jest.fn(),
      receivePayment: jest
        .fn()
        .mockResolvedValue({ paymentRequest: "sp1own-spark-address" }),
      getInfo: jest.fn().mockResolvedValue({ tokenBalances: {} }),
    }

    await expect(
      createGetConversionQuote(sdk as never)({
        fromAmount: toBtcMoneyAmount(5000),
        toAmount: toUsdMoneyAmount(137),
        direction: ConvertDirection.BtcToUsd,
      }),
    ).rejects.toThrow("prepare failed")

    expect(mockRecordError).toHaveBeenCalled()
    expect(sdk.sendPayment).not.toHaveBeenCalled()
  })

  it("execute() records to crashlytics and returns failed when sendPayment throws", async () => {
    const sdk = {
      prepareSendPayment: jest.fn().mockResolvedValue({
        paymentMethod: {},
        conversionEstimate: { fee: BigInt(0), amountAdjustment: undefined },
      }),
      sendPayment: jest.fn().mockRejectedValue(new Error("send failed")),
      receivePayment: jest
        .fn()
        .mockResolvedValue({ paymentRequest: "sp1own-spark-address" }),
      getInfo: jest.fn().mockResolvedValue({ tokenBalances: {} }),
    }

    const quote = await createGetConversionQuote(sdk as never)({
      fromAmount: toBtcMoneyAmount(5000),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })
    const result = await quote!.execute()

    expect(result.status).toBe("failed")
    expect(result.errors?.[0].message).toBe("send failed")
    expect(mockRecordError).toHaveBeenCalled()
  })

  it("bails out of the correction step when the SDK signals IncreasedToAvoidDust on the final quote, surfacing the all-balance quote unchanged (Bug #2)", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 50, minToAmount: null })
    const balance = BigInt(2_996_706)
    const sdk = {
      prepareSendPayment: jest
        .fn()
        .mockResolvedValueOnce({
          paymentMethod: {},
          conversionEstimate: {
            amountIn: BigInt(1_251_471),
            amountOut: BigInt(1_524),
            fee: BigInt(1_252),
            amountAdjustment: undefined,
          },
        })
        .mockResolvedValueOnce({
          paymentMethod: {},
          conversionEstimate: {
            amountIn: balance,
            amountOut: BigInt(3_651),
            fee: BigInt(2_998),
            amountAdjustment: AmountAdjustmentReason.IncreasedToAvoidDust,
          },
        }),
      sendPayment: jest.fn().mockResolvedValue(undefined),
      syncWallet: jest.fn().mockResolvedValue(undefined),
      receivePayment: jest
        .fn()
        .mockResolvedValue({ paymentRequest: "sp1own-spark-address" }),
      getInfo: jest.fn().mockResolvedValue({
        balanceSats: 0n,
        tokenBalances: {
          "usdb-token-id": {
            balance,
            tokenMetadata: { identifier: "usdb-token-id", decimals: 6 },
          },
        },
      }),
    }

    const quote = await createGetConversionQuote(sdk as never)({
      fromAmount: toUsdMoneyAmount(249),
      toAmount: toBtcMoneyAmount(3_032),
      direction: ConvertDirection.UsdToBtc,
    })

    expect(sdk.prepareSendPayment).toHaveBeenCalledTimes(2)
    expect(quote?.amountAdjustment).toBe(ConvertAmountAdjustment.IncreasedToAvoidDust)
  })

  it("rethrows when the corrected re-quote rejects after an overshoot, never executing the discovery quote (Critical #3)", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: null, minToAmount: null })
    const sdk = {
      prepareSendPayment: jest
        .fn()
        .mockResolvedValueOnce({
          paymentMethod: {},
          conversionEstimate: {
            amountIn: BigInt(2500),
            amountOut: BigInt(60),
            fee: BigInt(50),
            amountAdjustment: undefined,
          },
        })
        .mockResolvedValueOnce({
          paymentMethod: {},
          conversionEstimate: {
            amountIn: BigInt(7500),
            amountOut: BigInt(180),
            fee: BigInt(50),
            amountAdjustment: undefined,
          },
        })
        .mockRejectedValueOnce(new Error("corrected quote rejected")),
      sendPayment: jest.fn(),
      receivePayment: jest
        .fn()
        .mockResolvedValue({ paymentRequest: "sp1own-spark-address" }),
      getInfo: jest.fn().mockResolvedValue({
        balanceSats: BigInt(1_000_000_000),
        tokenBalances: {
          "usdb-token-id": {
            balance: BigInt(1_000_000_000),
            tokenMetadata: { identifier: "usdb-token-id", decimals: 6 },
          },
        },
      }),
    }

    await expect(
      createGetConversionQuote(sdk as never)({
        fromAmount: toBtcMoneyAmount(5000),
        toAmount: toUsdMoneyAmount(180),
        direction: ConvertDirection.BtcToUsd,
      }),
    ).rejects.toThrow("corrected quote rejected")

    expect(sdk.prepareSendPayment).toHaveBeenCalledTimes(3)
    expect(sdk.sendPayment).not.toHaveBeenCalled()
    expect(mockRecordError).toHaveBeenCalled()
  })

  it("propagates the configuration error when SPARK_TOKEN_IDENTIFIER is missing", async () => {
    mockFetchLimits.mockResolvedValue({ minFromAmount: 0, minToAmount: 0 })
    mockRequireTokenId.mockImplementationOnce(() => {
      throw new Error("SPARK_TOKEN_IDENTIFIER is not configured for this build")
    })
    const sdk = createSdk()

    await expect(
      createGetConversionQuote(sdk as never)({
        fromAmount: toBtcMoneyAmount(5000),
        toAmount: toUsdMoneyAmount(137),
        direction: ConvertDirection.BtcToUsd,
      }),
    ).rejects.toThrow("SPARK_TOKEN_IDENTIFIER is not configured for this build")

    expect(mockRecordError).toHaveBeenCalled()
    expect(sdk.prepareSendPayment).not.toHaveBeenCalled()
    expect(sdk.sendPayment).not.toHaveBeenCalled()
  })
})
