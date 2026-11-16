import { it } from "@jest/globals"
import { AmountAdjustmentReason } from "@breeztech/breez-sdk-spark-react-native"

import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  ConvertAmountAdjustment,
  ConvertDirection,
  ConvertErrorCode,
} from "@app/types/payment"
import { WalletCurrency } from "@app/graphql/generated"

import {
  createGetConversionQuote,
  LOST_CONVERSION_DELIVERY_WINDOW_MS,
  mapAmountAdjustment,
} from "@app/self-custodial/bridge/convert"
import {
  measureObservedPayment,
  resetMeasuredOnceKeys,
  resetMeasurementContext,
  resetSettlementTracking,
  setMeasurementContext,
} from "@app/self-custodial/measurement"
import { AccountMode } from "@app/types/account"

const mockFetchLimits = jest.fn()
const mockRequireTokenId = jest.fn(() => "usdb-token-id")
const mockRecordError = jest.fn()
const mockFindLostConversion = jest.fn()
/** Where the wallet's received payments stood as the conversion went out. */
const MARK = { walletClockSec: 1_700_000_000, knownPaymentIds: ["rcv-before"] }
const mockMarkReceivedHistory = jest.fn()

jest.mock("@app/self-custodial/payment-details/lost-send", () => ({
  ...jest.requireActual("@app/self-custodial/payment-details/lost-send"),
  findLostConversion: (...args: unknown[]) => mockFindLostConversion(...args),
  markReceivedHistory: (...args: unknown[]) => mockMarkReceivedHistory(...args),
}))

beforeEach(() => {
  mockMarkReceivedHistory.mockResolvedValue(MARK)
})

jest.mock("@app/self-custodial/analytics-identity", () => ({
  /** The identity owner's own spec covers when delivery is safe; here it is in place. */
  isEnhancedIdentityApplied: () => true,
  onEnhancedIdentityApplied: () => () => undefined,
}))

const mockCrashLog = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: mockRecordError, log: mockCrashLog }),
}))

const mockLogEvent = jest.fn()
jest.mock("@react-native-firebase/analytics", () => () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

jest.mock("@app/self-custodial/bridge/limits", () => {
  const actual = jest.requireActual("@app/self-custodial/bridge/limits")
  return {
    ...actual,
    fetchConversionLimits: (...args: unknown[]) => mockFetchLimits(...args),
  }
})

jest.mock("@app/self-custodial/config", () => ({
  MAX_SLIPPAGE_BPS: 50,
  requireSparkTokenIdentifier: () => mockRequireTokenId(),
  sparkTokenIdentifier: () => mockRequireTokenId(),
  SparkToken: { Label: "USDB", DefaultDecimals: 6 },
}))

/** The phone's clock, moved past the window in which a lost conversion may still
 *  deliver. */
let movedClock: jest.SpyInstance | undefined
const afterTheDeliveryWindow = () => {
  const movedTo = Date.now() + LOST_CONVERSION_DELIVERY_WINDOW_MS + 1
  movedClock = jest.spyOn(Date, "now").mockReturnValue(movedTo)
}
afterEach(() => {
  movedClock?.mockRestore()
  movedClock = undefined
})

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
    expect(prepArg.paymentRequest).toEqual({
      tag: "Input",
      inner: { input: "sp1own-spark-address" },
    })
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

  it("clamps the discovery destination up to minToAmount when it dominates", async () => {
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
    expect(arg.paymentRequest).toEqual({
      tag: "Input",
      inner: { input: "sp1own-spark-address" },
    })
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
    /** The breadcrumb names the direction only: amounts are payment data. */
    expect(mockCrashLog).toHaveBeenCalledWith(expect.stringContaining("[Convert]"))
    const breadcrumbs = mockCrashLog.mock.calls.map(([line]) => String(line)).join("\n")
    expect(breadcrumbs).not.toMatch(/5000|137/)
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
    mockFindLostConversion.mockResolvedValue({ status: "not-found" })
    const result = await quote!.execute()

    expect(result.status).toBe("failed")
    expect(result.errors?.[0].code).toBe(ConvertErrorCode.OutcomeUnknown)
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

  it("rethrows when the corrected re-quote rejects after an overshoot, never executing the discovery quote", async () => {
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

describe("mapAmountAdjustment", () => {
  it("maps undefined to undefined", () => {
    expect(mapAmountAdjustment(undefined)).toBeUndefined()
  })

  it("maps FlooredToMinLimit to the benign FlooredToMin adjustment", () => {
    expect(mapAmountAdjustment(AmountAdjustmentReason.FlooredToMinLimit)).toBe(
      ConvertAmountAdjustment.FlooredToMin,
    )
  })

  it("maps IncreasedToAvoidDust to the dust-gate adjustment", () => {
    expect(mapAmountAdjustment(AmountAdjustmentReason.IncreasedToAvoidDust)).toBe(
      ConvertAmountAdjustment.IncreasedToAvoidDust,
    )
  })
})

describe("swap telemetry", () => {
  const COMPLETED = 0
  const PENDING = 1
  const FAILED = 2
  const SEND = 0

  const loggedEvents = () => mockLogEvent.mock.calls.map(([name]) => name)
  const params = {
    fromAmount: toBtcMoneyAmount(5000),
    toAmount: toUsdMoneyAmount(137),
    direction: ConvertDirection.BtcToUsd,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    resetMeasuredOnceKeys()
    resetSettlementTracking()
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Enhanced,
      network: "mainnet",
    })
    mockFetchLimits.mockResolvedValue({ minFromAmount: 1000, minToAmount: 0 })
    mockFindLostConversion.mockResolvedValue({ status: "not-found" })
  })

  afterAll(() => {
    resetMeasurementContext()
  })

  it("logs nothing for fetching a quote: a fetched quote is not a shown one", async () => {
    await createGetConversionQuote(createSdk() as never)(params)

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it("reports a conversion the SDK completed, with its source", async () => {
    const sdk = createSdk()
    sdk.sendPayment.mockResolvedValue({ payment: { id: "cv-1", status: COMPLETED } })

    const quote = await createGetConversionQuote(sdk as never)({
      ...params,
      source: "auto_convert",
    })
    await quote!.execute()

    expect(mockLogEvent).toHaveBeenCalledWith("sc_swap_completed", {
      network: "mainnet",
      direction: ConvertDirection.BtcToUsd,
      source: "auto_convert",
    })
  })

  it("holds a pending conversion until the SDK says how it ended", async () => {
    const sdk = createSdk()
    sdk.sendPayment.mockResolvedValue({ payment: { id: "cv-1", status: PENDING } })

    const quote = await createGetConversionQuote(sdk as never)(params)
    const result = await quote!.execute()

    expect(result.status).toBe("success")
    expect(mockLogEvent).not.toHaveBeenCalled()

    measureObservedPayment({
      id: "cv-1",
      status: FAILED,
      paymentType: SEND,
      method: 0,
    } as never)

    expect(loggedEvents()).toEqual(["sc_swap_failed"])
  })

  it("does not report a quote made for one account but executed after a switch", async () => {
    const sdk = createSdk()
    sdk.sendPayment.mockResolvedValue({ payment: { id: "cv-1", status: COMPLETED } })
    const quote = await createGetConversionQuote(sdk as never)(params)

    setMeasurementContext({
      accountId: "sc-2",
      mode: AccountMode.Enhanced,
      network: "mainnet",
    })
    await quote!.execute()

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it("does not report a rejection that arrives after a switch to another account", async () => {
    const sdk = createSdk()
    let rejectSend: (err: unknown) => void = () => undefined
    /** The conversion goes out only once the wallet's received payments are marked. */
    const sendStarted = new Promise<void>((started) => {
      sdk.sendPayment.mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            rejectSend = reject
            started()
          }),
      )
    })
    const quote = await createGetConversionQuote(sdk as never)(params)

    const executing = quote!.execute()
    await sendStarted
    setMeasurementContext({
      accountId: "sc-2",
      mode: AccountMode.Enhanced,
      network: "mainnet",
    })
    rejectSend(new Error("send failed"))
    await executing

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it("reports a thrown conversion as failed", async () => {
    const sdk = createSdk()
    sdk.sendPayment.mockRejectedValue(new Error("send failed"))

    const quote = await createGetConversionQuote(sdk as never)(params)
    await quote!.execute()

    expect(loggedEvents()).toEqual(["sc_swap_failed"])
  })

  it("reports a thrown conversion the wallet turns out to hold as completed", async () => {
    mockFindLostConversion.mockResolvedValue({
      status: "found",
      payment: { id: "cv-1", details: { tag: "Token", inner: {} } },
    })
    const sdk = createSdk()
    sdk.sendPayment.mockRejectedValue(new Error("connection reset"))

    const quote = await createGetConversionQuote(sdk as never)(params)
    await quote!.execute()

    expect(loggedEvents()).toEqual(["sc_swap_completed"])
  })
})

describe("createGetConversionQuote — a conversion whose response is lost", () => {
  /** What the quote pays in: the sats entered. */
  const PAID_IN = 5000

  const throwingSdk = () => ({
    prepareSendPayment: jest.fn().mockResolvedValue({
      paymentMethod: {},
      conversionEstimate: {
        fee: BigInt(0),
        amountIn: BigInt(PAID_IN),
        amountOut: BigInt(1_370_000),
        amountAdjustment: undefined,
      },
    }),
    sendPayment: jest.fn().mockRejectedValue(new Error("connection reset")),
    receivePayment: jest.fn().mockResolvedValue({ paymentRequest: "sp1own-invoice" }),
    getInfo: jest.fn().mockResolvedValue({ tokenBalances: {} }),
    listPayments: jest.fn(),
    syncWallet: jest.fn().mockResolvedValue({}),
  })

  const quoteFor = (sdk: ReturnType<typeof throwingSdk>) =>
    createGetConversionQuote(sdk as never)({
      fromAmount: toBtcMoneyAmount(PAID_IN),
      toAmount: toUsdMoneyAmount(137),
      direction: ConvertDirection.BtcToUsd,
    })

  /** What a conversion from bitcoin delivered: dollars, a token payment, and what it paid
   *  in once the wallet has filled in its legs. */
  const delivered = ({
    id = "rcv-usdb",
    tag = "Token",
    paidIn,
    amount = 1_370_000,
  }: { id?: string; tag?: string; paidIn?: number; amount?: number } = {}) => ({
    id,
    amount: BigInt(amount),
    details: { tag, inner: { metadata: { identifier: "usdb-token-id" } } },
    conversionDetails: {
      status: 1,
      conversions: paidIn === undefined ? [] : [{ from: { amount: BigInt(paidIn) } }],
    },
  })
  const foundDelivery = (payment = delivered({ paidIn: PAID_IN })) => ({
    status: "found",
    payment,
    failed: [],
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockMarkReceivedHistory.mockResolvedValue(MARK)
    mockFetchLimits.mockResolvedValue({ minFromAmount: null, minToAmount: null })
  })

  it("marks where the wallet's received payments stand before the conversion goes out", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found" })
    const sdk = throwingSdk()

    await (await quoteFor(sdk))!.execute()

    const [markedAt] = mockMarkReceivedHistory.mock.invocationCallOrder
    const [sentAt] = sdk.sendPayment.mock.invocationCallOrder
    expect(markedAt).toBeLessThan(sentAt)
  })

  it("converts nothing when the wallet's received payments cannot be read", async () => {
    mockMarkReceivedHistory.mockRejectedValue(new Error("storage failed"))
    const sdk = throwingSdk()

    const result = await (await quoteFor(sdk))!.execute()

    expect(result.errors?.[0].code).toBe(ConvertErrorCode.HistoryUnavailable)
    expect(sdk.sendPayment).not.toHaveBeenCalled()
    expect(mockRecordError).toHaveBeenCalled()
  })

  it("looks for what the conversion delivered after the mark", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found" })
    const sdk = throwingSdk()

    await (await quoteFor(sdk))!.execute()

    expect(mockFindLostConversion).toHaveBeenCalledWith({
      sdk,
      lost: {
        startedAtMs: expect.any(Number),
        lastAttemptAtMs: expect.any(Number),
        ...MARK,
        expectedDeliveries: [{ tokenIdentifier: "usdb-token-id", amount: 1_370_000 }],
      },
    })
  })

  it("expects bitcoin, with no token, from a lost conversion to bitcoin", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found", failed: [] })
    const sdk = throwingSdk()
    sdk.getInfo.mockResolvedValue({
      tokenBalances: {
        "usdb-token-id": {
          balance: 1_000_000_000n,
          tokenMetadata: { identifier: "usdb-token-id", decimals: 6 },
        },
      },
    })

    await (await createGetConversionQuote(sdk as never)({
      fromAmount: toUsdMoneyAmount(137),
      toAmount: toBtcMoneyAmount(5000),
      direction: ConvertDirection.UsdToBtc,
    }))!.execute()

    expect(mockFindLostConversion.mock.calls[0][0].lost.expectedDeliveries).toEqual([
      { tokenIdentifier: undefined, amount: 1_370_000 },
    ])
  })

  it("reports the conversion as done when the wallet holds what it delivered", async () => {
    mockFindLostConversion.mockResolvedValue(foundDelivery())

    const result = await (await quoteFor(throwingSdk()))!.execute()

    expect(result.status).toBe("success")
  })

  it("does not take what an earlier conversion delivered for this one's outcome", async () => {
    mockFindLostConversion.mockResolvedValue(foundDelivery(delivered({ paidIn: 9000 })))

    const result = await (await quoteFor(throwingSdk()))!.execute()

    expect(result.errors?.[0].code).toBe(ConvertErrorCode.OutcomeUnknown)
  })

  it("passes over that earlier delivery when it looks for this one again", async () => {
    const earlierDelivery = delivered({ id: "rcv-earlier", paidIn: 9000 })
    mockFindLostConversion
      .mockResolvedValueOnce(foundDelivery(earlierDelivery))
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    await (await quoteFor(sdk))!.execute(attemptRef)

    expect(mockFindLostConversion.mock.calls[1][0].lost.knownPaymentIds).toEqual([
      ...MARK.knownPaymentIds,
      "rcv-earlier",
    ])
  })

  it("does not look for a conversion the SDK refused on the way in", async () => {
    const sdk = throwingSdk()
    sdk.sendPayment.mockRejectedValue({ tag: "InsufficientFunds", inner: ["no funds"] })

    const result = await (await quoteFor(sdk))!.execute()

    expect(result.status).toBe("failed")
    expect(result.errors?.[0].code).toBeUndefined()
    expect(mockFindLostConversion).not.toHaveBeenCalled()
  })

  it("refuses a later conversion while the wallet's history cannot be read", async () => {
    mockFindLostConversion
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce({ status: "unreadable", error: new Error("offline") })
    const sdk = throwingSdk()
    const attemptRef = {}

    const first = await (await quoteFor(sdk))!.execute(attemptRef)
    afterTheDeliveryWindow()
    const retry = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(first.errors?.[0].code).toBe(ConvertErrorCode.OutcomeUnknown)
    expect(retry.errors?.[0].code).toBe(ConvertErrorCode.OutcomeUnknown)
    expect(sdk.sendPayment).toHaveBeenCalledTimes(1)
  })

  it("keeps refusing until the wallet's history can be read", async () => {
    mockFindLostConversion
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce({ status: "unreadable", error: new Error("offline") })
      .mockResolvedValueOnce({ status: "unreadable", error: new Error("offline") })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    afterTheDeliveryWindow()
    await (await quoteFor(sdk))!.execute(attemptRef)
    const third = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(third.errors?.[0].code).toBe(ConvertErrorCode.OutcomeUnknown)
    expect(sdk.sendPayment).toHaveBeenCalledTimes(1)
  })

  /** The pool's swap can outlast the SDK's wait for it and the look after it. */
  it("refuses a later conversion while the lost one may still deliver, though not found", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found", failed: [] })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    const retry = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(retry.errors?.[0].code).toBe(ConvertErrorCode.OutcomeUnknown)
    expect(sdk.sendPayment).toHaveBeenCalledTimes(1)
  })

  it("counts that window from the lost conversion's latest attempt", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found", failed: [] })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    afterTheDeliveryWindow()
    await (await quoteFor(sdk))!.execute(attemptRef)
    const third = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(third.errors?.[0].code).toBe(ConvertErrorCode.OutcomeUnknown)
    expect(sdk.sendPayment).toHaveBeenCalledTimes(2)
  })

  it("still looks for its other attempt once one attempt's delivery is found", async () => {
    const quotedOut = (amountIn: number, amountOut: number) => ({
      paymentMethod: {},
      conversionEstimate: {
        fee: BigInt(0),
        amountIn: BigInt(amountIn),
        amountOut: BigInt(amountOut),
        amountAdjustment: undefined,
      },
    })
    mockFindLostConversion
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce(foundDelivery())
      .mockResolvedValue({ status: "not-found", failed: [] })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    afterTheDeliveryWindow()
    sdk.prepareSendPayment.mockResolvedValue(quotedOut(7300, 2_000_000))
    await (await quoteFor(sdk))!.execute(attemptRef)
    sdk.prepareSendPayment.mockResolvedValue(quotedOut(PAID_IN, 1_370_000))
    const found = await (await quoteFor(sdk))!.execute(attemptRef)
    await (await quoteFor(sdk))!.execute(attemptRef)

    const lastLook = mockFindLostConversion.mock.calls.at(-1)?.[0].lost
    expect(found.status).toBe("success")
    expect(lastLook.expectedDeliveries).toEqual([
      { tokenIdentifier: "usdb-token-id", amount: 2_000_000 },
    ])
    expect(lastLook.knownPaymentIds).toContain("rcv-usdb")
    expect(sdk.sendPayment).toHaveBeenCalledTimes(2)
  })

  it("keeps the payments the new mark knew along with the earlier mark's", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found", failed: [] })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    afterTheDeliveryWindow()
    mockMarkReceivedHistory.mockResolvedValue({
      walletClockSec: 1,
      knownPaymentIds: ["rcv-between"],
    })
    await (await quoteFor(sdk))!.execute(attemptRef)

    expect(mockFindLostConversion.mock.calls.at(-1)?.[0].lost).toMatchObject({
      walletClockSec: MARK.walletClockSec,
      knownPaymentIds: ["rcv-before", "rcv-between"],
    })
  })

  it("lets a later conversion through once the history shows the lost one never delivered", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found", failed: [] })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    afterTheDeliveryWindow()
    sdk.sendPayment.mockResolvedValue({ payment: { id: "c2", status: 0 } })
    const retry = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(retry.status).toBe("success")
    expect(sdk.sendPayment).toHaveBeenCalledTimes(2)
  })

  it("settles the lost conversion once the one let through past it goes out", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found", failed: [] })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    afterTheDeliveryWindow()
    sdk.sendPayment.mockResolvedValue({ payment: { id: "c2", status: 0 } })
    await (await quoteFor(sdk))!.execute(attemptRef)
    await (await quoteFor(sdk))!.execute(attemptRef)

    expect(mockFindLostConversion).toHaveBeenCalledTimes(2)
    expect(sdk.sendPayment).toHaveBeenCalledTimes(3)
  })

  it("keeps the lost conversion when the one let through past it is refused on the way in", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found", failed: [] })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    afterTheDeliveryWindow()
    sdk.sendPayment.mockRejectedValueOnce({
      tag: "InsufficientFunds",
      inner: ["no funds"],
    })
    await (await quoteFor(sdk))!.execute(attemptRef)
    await (await quoteFor(sdk))!.execute(attemptRef)

    const firstLost = mockFindLostConversion.mock.calls[0][0].lost
    expect(mockFindLostConversion.mock.calls[2][0].lost).toEqual(firstLost)
  })

  /** Either may have delivered by the time the second is looked for, so both are, from
   *  the earlier mark, and both stay looked for. */
  it("looks for the two together when the one let through is lost as well", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found", failed: [] })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    afterTheDeliveryWindow()
    mockMarkReceivedHistory.mockResolvedValue({ walletClockSec: 1, knownPaymentIds: [] })
    const second = await (await quoteFor(sdk))!.execute(attemptRef)
    await (await quoteFor(sdk))!.execute(attemptRef)

    const { startedAtMs, walletClockSec, knownPaymentIds } =
      mockFindLostConversion.mock.calls[0][0].lost
    const fromFirstMark = { startedAtMs, walletClockSec, knownPaymentIds }
    expect(second.errors?.[0].code).toBe(ConvertErrorCode.OutcomeUnknown)
    expect(mockFindLostConversion.mock.calls[2][0].lost).toMatchObject(fromFirstMark)
    expect(mockFindLostConversion.mock.calls[3][0].lost).toMatchObject(fromFirstMark)
    expect(mockFindLostConversion.mock.calls[3][0].lost.expectedDeliveries).toEqual([
      { tokenIdentifier: "usdb-token-id", amount: 1_370_000 },
      { tokenIdentifier: "usdb-token-id", amount: 1_370_000 },
    ])
  })

  it("looks for the lost conversion again, from its own mark, before a retry goes out", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found" })
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    afterTheDeliveryWindow()
    mockMarkReceivedHistory.mockResolvedValue({ walletClockSec: 1, knownPaymentIds: [] })
    await (await quoteFor(sdk))!.execute(attemptRef)

    expect(mockFindLostConversion).toHaveBeenCalledTimes(3)
    expect(mockFindLostConversion.mock.calls[1][0].lost).toEqual(
      mockFindLostConversion.mock.calls[0][0].lost,
    )
  })

  it("reports a retry as the lost conversion once it turns up, converting nothing more", async () => {
    mockFindLostConversion
      .mockResolvedValueOnce({ status: "not-found" })
      .mockResolvedValueOnce(foundDelivery())
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    const retry = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(retry.status).toBe("success")
    expect(sdk.sendPayment).toHaveBeenCalledTimes(1)
  })

  it("takes a delivery whose legs the wallet has not filled in yet for the retry's", async () => {
    mockFindLostConversion
      .mockResolvedValueOnce({ status: "not-found" })
      .mockResolvedValueOnce(foundDelivery(delivered()))
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    const retry = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(retry.status).toBe("success")
  })

  it("reports an earlier conversion when one without legs delivered another amount", async () => {
    mockFindLostConversion
      .mockResolvedValueOnce({ status: "not-found" })
      .mockResolvedValueOnce(foundDelivery(delivered({ amount: 2_000_000 })))
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    const retry = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(retry.errors?.[0].code).toBe(ConvertErrorCode.EarlierConversionFound)
    expect(sdk.sendPayment).toHaveBeenCalledTimes(1)
  })

  it("takes a new quote paying in a little more or less for the same conversion", async () => {
    mockFindLostConversion
      .mockResolvedValueOnce({ status: "not-found" })
      .mockResolvedValueOnce(foundDelivery(delivered({ paidIn: PAID_IN + 50 })))
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    const retry = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(retry.status).toBe("success")
  })

  it.each([
    ["for another amount", delivered({ paidIn: PAID_IN + 51 })],
    ["the other way", delivered({ tag: "Spark", paidIn: PAID_IN })],
    [
      "with nothing to tell its way",
      { ...delivered({ paidIn: PAID_IN }), details: undefined },
    ],
    ["as neither dollars nor bitcoin", delivered({ tag: "Lightning", paidIn: PAID_IN })],
  ])(
    "reports an earlier conversion found %s as that, converting nothing",
    async (_, payment) => {
      mockFindLostConversion
        .mockResolvedValueOnce({ status: "not-found" })
        .mockResolvedValueOnce(foundDelivery(payment as ReturnType<typeof delivered>))
      const sdk = throwingSdk()
      const attemptRef = {}

      await (await quoteFor(sdk))!.execute(attemptRef)
      const retry = await (await quoteFor(sdk))!.execute(attemptRef)

      expect(retry.errors?.[0].code).toBe(ConvertErrorCode.EarlierConversionFound)
      expect(sdk.sendPayment).toHaveBeenCalledTimes(1)
    },
  )

  it("converts normally after an earlier conversion was reported", async () => {
    mockFindLostConversion
      .mockResolvedValueOnce({ status: "not-found" })
      .mockResolvedValueOnce(foundDelivery(delivered({ paidIn: 9000 })))
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    await (await quoteFor(sdk))!.execute(attemptRef)
    sdk.sendPayment.mockResolvedValue({ payment: { id: "c2", status: 0 } })
    const next = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(next.status).toBe("success")
    expect(sdk.sendPayment).toHaveBeenCalledTimes(2)
  })

  it("converts again normally once the lost conversion was found", async () => {
    mockFindLostConversion
      .mockResolvedValueOnce({ status: "not-found" })
      .mockResolvedValueOnce(foundDelivery())
    const sdk = throwingSdk()
    const attemptRef = {}

    await (await quoteFor(sdk))!.execute(attemptRef)
    await (await quoteFor(sdk))!.execute(attemptRef)
    sdk.sendPayment.mockResolvedValue({ payment: { id: "c2", status: 0 } })
    const next = await (await quoteFor(sdk))!.execute(attemptRef)

    expect(next.status).toBe("success")
    expect(sdk.sendPayment).toHaveBeenCalledTimes(2)
  })

  it("does not carry the lost conversion to one with its own attempt ref", async () => {
    mockFindLostConversion.mockResolvedValue({ status: "not-found" })
    const sdk = throwingSdk()

    await (await quoteFor(sdk))!.execute({})
    await (await quoteFor(sdk))!.execute({})

    expect(mockFindLostConversion).toHaveBeenCalledTimes(2)
    expect(mockFindLostConversion.mock.calls[1][0].lost.startedAtMs).not.toBeUndefined()
    expect(sdk.sendPayment).toHaveBeenCalledTimes(2)
  })

  /**
   * The wallet as the SDK (0.27.1) records a conversion to itself: the invoice the quote
   * was made against is never paid, and what the swap delivered comes in as a token
   * payment, a leg of a self-transfer conversion, after everything received before.
   */
  it("finds a lost conversion in a wallet that records it as the SDK does", async () => {
    const actual = jest.requireActual("@app/self-custodial/payment-details/lost-send")
    mockMarkReceivedHistory.mockImplementation(actual.markReceivedHistory)
    mockFindLostConversion.mockImplementation(actual.findLostConversion)
    const receivedBefore = {
      id: "rcv-before",
      timestamp: BigInt(MARK.walletClockSec),
      amount: BigInt(2100),
      status: 0,
      details: { tag: "Spark", inner: { invoiceDetails: undefined } },
    }
    const delivered = {
      id: "rcv-usdb",
      timestamp: BigInt(MARK.walletClockSec + 3),
      amount: BigInt(1_370_000),
      status: 0,
      details: {
        tag: "Token",
        inner: {
          invoiceDetails: undefined,
          conversionInfo: {
            tag: "Amm",
            inner: { status: 1, purpose: { tag: "SelfTransfer" } },
          },
        },
      },
      conversionDetails: { status: 1, conversions: [] },
    }
    const sdk = throwingSdk()
    sdk.listPayments
      .mockResolvedValueOnce({ payments: [receivedBefore] })
      .mockResolvedValue({ payments: [delivered, receivedBefore] })

    const result = await (await quoteFor(sdk))!.execute()

    expect(result.status).toBe("success")
    expect(sdk.sendPayment).toHaveBeenCalledTimes(1)
  })

  /** The SDK labels a delivery as its conversion's once its own call to the pool answers;
   *  when that answer is the one lost, the delivery comes in as a plain token payment. */
  it("finds a lost conversion the wallet has not labeled as one yet", async () => {
    const actual = jest.requireActual("@app/self-custodial/payment-details/lost-send")
    mockMarkReceivedHistory.mockImplementation(actual.markReceivedHistory)
    mockFindLostConversion.mockImplementation(actual.findLostConversion)
    const unlabeled = {
      id: "rcv-usdb",
      /** Delivered now, by the server's clock: nothing was received before it. */
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
      amount: BigInt(1_370_000),
      status: 1,
      details: {
        tag: "Token",
        inner: { invoiceDetails: undefined, metadata: { identifier: "usdb-token-id" } },
      },
    }
    const sdk = throwingSdk()
    sdk.listPayments
      .mockResolvedValueOnce({ payments: [] })
      .mockResolvedValue({ payments: [unlabeled] })

    const result = await (await quoteFor(sdk))!.execute()

    expect(result.status).toBe("success")
    expect(sdk.sendPayment).toHaveBeenCalledTimes(1)
  })
})
