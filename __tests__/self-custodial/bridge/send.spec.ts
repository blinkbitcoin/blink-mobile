/* eslint-disable camelcase */
import { WalletCurrency } from "@app/graphql/generated"

import {
  executeLnurl,
  executeSend,
  extractLightningFee,
  extractLnurlFee,
  extractOnchainFees,
  prepareLnurl,
  prepareSend,
  resolveSendTokenIdentifier,
  toSdkSendAmount,
} from "@app/self-custodial/bridge/send"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  FeePolicy: { FeesExcluded: 0, FeesIncluded: 1 },
  LnurlPayRequest: { create: (p: Record<string, unknown>) => p },
  OnchainConfirmationSpeed: { Fast: 0, Medium: 1, Slow: 2 },
  PrepareLnurlPayRequest: { create: (p: Record<string, unknown>) => p },
  PrepareSendPaymentRequest: { create: (p: Record<string, unknown>) => p },
  SendPaymentMethod_Tags: {
    BitcoinAddress: "BitcoinAddress",
    Bolt11Invoice: "Bolt11Invoice",
  },
  SendPaymentOptions: {
    BitcoinAddress: jest
      .fn()
      .mockImplementation((inner: unknown) => ({ tag: "BitcoinAddress", inner })),
    Bolt11Invoice: jest
      .fn()
      .mockImplementation((inner: unknown) => ({ tag: "Bolt11Invoice", inner })),
  },
  SendPaymentRequest: { create: (p: Record<string, unknown>) => p },
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: {},
  requireSparkTokenIdentifier: () => "usdb-token-id",
  SparkToken: { Label: "USDB", Ticker: "USDB", DefaultDecimals: 6 },
}))

describe("extractOnchainFees", () => {
  it("returns fee totals for BitcoinAddress payment", () => {
    const prepared = {
      paymentMethod: {
        tag: "BitcoinAddress",
        inner: {
          feeQuote: {
            speedFast: { userFeeSat: BigInt(100), l1BroadcastFeeSat: BigInt(200) },
            speedMedium: { userFeeSat: BigInt(100), l1BroadcastFeeSat: BigInt(150) },
            speedSlow: { userFeeSat: BigInt(100), l1BroadcastFeeSat: BigInt(80) },
          },
        },
      },
    }

    const result = extractOnchainFees(prepared as never)

    expect(result).toEqual({ fast: 300, medium: 250, slow: 180 })
  })

  it("returns null for non-BitcoinAddress payment", () => {
    const prepared = {
      paymentMethod: { tag: "Bolt11Invoice", inner: {} },
    }

    expect(extractOnchainFees(prepared as never)).toBeNull()
  })
})

describe("extractLightningFee", () => {
  it("returns the Spark transfer fee when both routes are present (Spark is cheaper)", () => {
    const prepared = {
      paymentMethod: {
        tag: "Bolt11Invoice",
        inner: {
          lightningFeeSats: BigInt(10),
          sparkTransferFeeSats: BigInt(5),
        },
      },
    }

    expect(extractLightningFee(prepared as never)).toBe(5)
  })

  it("falls back to the lightning fee when there is no Spark route", () => {
    const prepared = {
      paymentMethod: {
        tag: "Bolt11Invoice",
        inner: {
          lightningFeeSats: BigInt(10),
          sparkTransferFeeSats: undefined,
        },
      },
    }

    expect(extractLightningFee(prepared as never)).toBe(10)
  })

  it("returns null when neither route has a fee", () => {
    const prepared = {
      paymentMethod: {
        tag: "Bolt11Invoice",
        inner: { lightningFeeSats: undefined, sparkTransferFeeSats: undefined },
      },
    }

    expect(extractLightningFee(prepared as never)).toBeNull()
  })

  it("returns null for non-Bolt11Invoice payment", () => {
    const prepared = {
      paymentMethod: { tag: "BitcoinAddress", inner: {} },
    }

    expect(extractLightningFee(prepared as never)).toBeNull()
  })
})

describe("executeSend", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("sends a Bolt11Invoice with preferSpark=true when a Spark route is available", async () => {
    const sendPayment = jest.fn().mockResolvedValue(undefined)
    const sdk = { sendPayment } as never
    const prepared = {
      paymentMethod: {
        tag: "Bolt11Invoice",
        inner: {
          lightningFeeSats: BigInt(10),
          sparkTransferFeeSats: BigInt(5),
        },
      },
    }

    await executeSend(sdk, prepared as never)

    expect(sendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          tag: "Bolt11Invoice",
          inner: expect.objectContaining({ preferSpark: true }),
        }),
      }),
    )
  })

  it("sends a Bolt11Invoice with preferSpark=false when only the Lightning route is available", async () => {
    const sendPayment = jest.fn().mockResolvedValue(undefined)
    const sdk = { sendPayment } as never
    const prepared = {
      paymentMethod: {
        tag: "Bolt11Invoice",
        inner: {
          lightningFeeSats: BigInt(10),
          sparkTransferFeeSats: undefined,
        },
      },
    }

    await executeSend(sdk, prepared as never)

    expect(sendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          tag: "Bolt11Invoice",
          inner: expect.objectContaining({ preferSpark: false }),
        }),
      }),
    )
  })

  it("forwards confirmationSpeed as a BitcoinAddress option for onchain sends", async () => {
    const sendPayment = jest.fn().mockResolvedValue(undefined)
    const sdk = { sendPayment } as never
    const prepared = {
      paymentMethod: { tag: "BitcoinAddress", inner: {} },
    }

    await executeSend(sdk, prepared as never, 0 /* Fast */)

    expect(sendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          tag: "BitcoinAddress",
          inner: expect.objectContaining({ confirmationSpeed: 0 }),
        }),
      }),
    )
  })

  it("omits options for BitcoinAddress when no confirmation speed is given", async () => {
    const sendPayment = jest.fn().mockResolvedValue(undefined)
    const sdk = { sendPayment } as never
    const prepared = {
      paymentMethod: { tag: "BitcoinAddress", inner: {} },
    }

    await executeSend(sdk, prepared as never)

    expect(sendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ options: undefined }),
    )
  })
})

describe("prepareSend", () => {
  it("forwards tokenIdentifier when provided", async () => {
    const prepareSendPayment = jest.fn().mockResolvedValue({})
    const sdk = { prepareSendPayment } as never

    await prepareSend(sdk, {
      paymentRequest: "lnbc1abc",
      amount: BigInt(1000),
      tokenIdentifier: "usdb-token-id",
    })

    expect(prepareSendPayment).toHaveBeenCalledWith({
      paymentRequest: "lnbc1abc",
      amount: BigInt(1000),
      tokenIdentifier: "usdb-token-id",
    })
  })

  it("omits tokenIdentifier when not provided so SDK treats it as BTC send", async () => {
    const prepareSendPayment = jest.fn().mockResolvedValue({})
    const sdk = { prepareSendPayment } as never

    await prepareSend(sdk, { paymentRequest: "lnbc1abc", amount: BigInt(1000) })

    expect(prepareSendPayment).toHaveBeenCalledWith({
      paymentRequest: "lnbc1abc",
      amount: BigInt(1000),
      tokenIdentifier: undefined,
      conversionOptions: undefined,
    })
  })

  it("forwards conversionOptions when provided (USDB→BTC Lightning send)", async () => {
    const prepareSendPayment = jest.fn().mockResolvedValue({})
    const sdk = { prepareSendPayment } as never
    const conversionOptions = {
      conversionType: { tag: "ToBitcoin", inner: ["usdb-token-id"] },
      maxSlippageBps: undefined,
      completionTimeoutSecs: undefined,
    } as never

    await prepareSend(sdk, {
      paymentRequest: "lnbc1abc",
      amount: BigInt(1000),
      conversionOptions,
    })

    expect(prepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ conversionOptions }),
    )
  })
})

describe("toSdkSendAmount", () => {
  it("passes through BTC amounts as sats", () => {
    expect(toSdkSendAmount(5000, WalletCurrency.Btc)).toBe(BigInt(5000))
  })

  it("scales USD cents to USDB base units using SparkToken.DefaultDecimals (6)", () => {
    // $0.70 = 70 cents → 70 * 10^4 = 700_000 base units
    expect(toSdkSendAmount(70, WalletCurrency.Usd)).toBe(BigInt(700000))
  })

  it("handles $1 = 100 cents → 1_000_000 base units", () => {
    expect(toSdkSendAmount(100, WalletCurrency.Usd)).toBe(BigInt(1000000))
  })

  it("honours the tokenDecimals override when provided", () => {
    // 70 cents with 4-decimal token → 70 * 10^2 = 7_000 base units
    expect(toSdkSendAmount(70, WalletCurrency.Usd, 4)).toBe(BigInt(7000))
  })

  it("rounds fractional-cent inputs to the nearest integer base unit", () => {
    // 0.5 cents × 10^4 = 5_000 (already integer)
    expect(toSdkSendAmount(0.5, WalletCurrency.Usd)).toBe(BigInt(5000))
  })

  it("returns 0 for zero BTC amount", () => {
    expect(toSdkSendAmount(0, WalletCurrency.Btc)).toBe(BigInt(0))
  })

  it("returns 0 for zero USD amount", () => {
    expect(toSdkSendAmount(0, WalletCurrency.Usd)).toBe(BigInt(0))
  })
})

describe("resolveSendTokenIdentifier", () => {
  it("returns the configured USDB identifier for USD wallets", () => {
    expect(resolveSendTokenIdentifier(WalletCurrency.Usd)).toBe("usdb-token-id")
  })

  it("returns undefined for BTC wallets so the SDK treats it as a BTC send", () => {
    expect(resolveSendTokenIdentifier(WalletCurrency.Btc)).toBeUndefined()
  })
})

describe("prepareLnurl", () => {
  const payRequest = {
    callback: "https://example.com/cb",
    minSendable: BigInt(1000),
    maxSendable: BigInt(100000000),
    metadataStr: '[["text/plain","hi"]]',
    commentAllowed: 0,
    domain: "example.com",
    url: "https://example.com",
    address: undefined,
    allowsNostr: undefined,
    nostrPubkey: undefined,
  } as never

  it("forwards amount, payRequest, comment to the SDK call", async () => {
    const prepareLnurlPay = jest.fn().mockResolvedValue({})
    const sdk = { prepareLnurlPay } as never

    await prepareLnurl(sdk, {
      amount: BigInt(1500),
      payRequest,
      comment: "hello",
    })

    expect(prepareLnurlPay).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: BigInt(1500),
        payRequest,
        comment: "hello",
      }),
    )
  })

  it("passes tokenIdentifier + conversionOptions + feePolicy for USD wallet sends", async () => {
    const prepareLnurlPay = jest.fn().mockResolvedValue({})
    const sdk = { prepareLnurlPay } as never
    const conversionOptions = {
      conversionType: { tag: "ToBitcoin", inner: { fromTokenIdentifier: "usdb" } },
    } as never

    await prepareLnurl(sdk, {
      amount: BigInt(1000000),
      payRequest,
      tokenIdentifier: "usdb-token-id",
      conversionOptions,
      feePolicy: 1,
    })

    expect(prepareLnurlPay).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenIdentifier: "usdb-token-id",
        conversionOptions,
        feePolicy: 1,
      }),
    )
  })

  it("omits tokenIdentifier and conversionOptions for BTC wallet sends", async () => {
    const prepareLnurlPay = jest.fn().mockResolvedValue({})
    const sdk = { prepareLnurlPay } as never

    await prepareLnurl(sdk, { amount: BigInt(1500), payRequest })

    expect(prepareLnurlPay).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenIdentifier: undefined,
        conversionOptions: undefined,
        feePolicy: undefined,
      }),
    )
  })
})

describe("extractLnurlFee", () => {
  it("returns the prepared response feeSats coerced to a number", () => {
    expect(extractLnurlFee({ feeSats: BigInt(7) } as never)).toBe(7)
  })

  it("returns 0 when feeSats is zero (legitimate USD FeesIncluded path)", () => {
    expect(extractLnurlFee({ feeSats: BigInt(0) } as never)).toBe(0)
  })
})

describe("executeLnurl", () => {
  it("forwards prepareResponse and idempotencyKey to the SDK call", async () => {
    const lnurlPay = jest.fn().mockResolvedValue({})
    const sdk = { lnurlPay } as never
    const prepareResponse = { amountSats: BigInt(100), feeSats: BigInt(1) } as never

    await executeLnurl(sdk, prepareResponse, "idemp-key-1")

    expect(lnurlPay).toHaveBeenCalledWith(
      expect.objectContaining({
        prepareResponse,
        idempotencyKey: "idemp-key-1",
      }),
    )
  })

  it("passes idempotencyKey as undefined when not provided", async () => {
    const lnurlPay = jest.fn().mockResolvedValue({})
    const sdk = { lnurlPay } as never
    const prepareResponse = { amountSats: BigInt(100), feeSats: BigInt(1) } as never

    await executeLnurl(sdk, prepareResponse)

    expect(lnurlPay).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: undefined }),
    )
  })
})
