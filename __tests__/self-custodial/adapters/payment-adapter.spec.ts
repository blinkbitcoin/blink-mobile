/* eslint-disable camelcase */
import {
  createSendPayment,
  createGetFee,
} from "@app/self-custodial/adapters/payment-adapter"
import { createReceiveLightning, createReceiveOnchain } from "@app/self-custodial/bridge"

const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: mockRecordError, log: jest.fn() }),
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  BitcoinNetwork: { Bitcoin: 0, Regtest: 4 },
  InputType_Tags: { SparkAddress: "SparkAddress" },
  Network: { Mainnet: 0, Regtest: 1 },
  OnchainConfirmationSpeed: { Fast: 0, Medium: 1, Slow: 2 },
  SdkError: { instanceOf: () => false },
  SdkError_Tags: {
    InsufficientFunds: "InsufficientFunds",
    InvalidInput: "InvalidInput",
    NetworkError: "NetworkError",
    Generic: "Generic",
  },
  PrepareSendPaymentRequest: {
    create: (args: unknown) => args,
  },
  SendPaymentMethod_Tags: {
    BitcoinAddress: "BitcoinAddress",
    Bolt11Invoice: "Bolt11Invoice",
  },
  SendPaymentOptions: {
    BitcoinAddress: jest.fn((args: unknown) => args),
  },
  SendPaymentRequest: {
    create: (args: unknown) => args,
  },
  ReceivePaymentRequest: {
    create: (args: unknown) => args,
  },
  ReceivePaymentMethod: {
    Bolt11Invoice: jest.fn((args: unknown) => ({ tag: "Bolt11Invoice", inner: args })),
    BitcoinAddress: jest.fn((args: unknown) => ({ tag: "BitcoinAddress", inner: args })),
    SparkInvoice: jest.fn((args: unknown) => ({ tag: "SparkInvoice", inner: args })),
  },
  ConversionType: {
    FromBitcoin: jest.fn(() => ({ tag: "FromBitcoin" })),
    ToBitcoin: jest.fn((args: unknown) => ({ tag: "ToBitcoin", inner: args })),
  },
  AmountAdjustmentReason: {
    FlooredToMinLimit: "FlooredToMinLimit",
    IncreasedToAvoidDust: "IncreasedToAvoidDust",
  },
  ListUnclaimedDepositsRequest: {
    create: (args: unknown) => args,
  },
  ClaimDepositRequest: {
    create: (args: unknown) => args,
  },
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: { maxSlippageBps: 50 },
  requireSparkTokenIdentifier: () => "test-token-id",
  SparkToken: { Label: "USDB", DefaultDecimals: 6 },
}))

jest.mock("@app/self-custodial/bridge/limits", () => {
  const actual = jest.requireActual("@app/self-custodial/bridge/limits")
  return {
    ...actual,
    fetchConversionLimits: jest
      .fn()
      .mockResolvedValue({ minFromAmount: null, minToAmount: null }),
  }
})

const createMockSdk = () => ({
  prepareSendPayment: jest.fn(),
  sendPayment: jest.fn(),
  receivePayment: jest.fn().mockResolvedValue({ paymentRequest: "sp1own" }),
  listUnclaimedDeposits: jest.fn(),
  claimDeposit: jest.fn(),
  getInfo: jest.fn().mockResolvedValue({ tokenBalances: {} }),
})

describe("self-custodial payment adapters", () => {
  describe("createSendPayment", () => {
    it("prepares and sends payment", async () => {
      const sdk = createMockSdk()
      const prepared = { amount: BigInt(1000) }
      sdk.prepareSendPayment.mockResolvedValue(prepared)
      sdk.sendPayment.mockResolvedValue({})

      const send = createSendPayment(sdk as never)
      const result = await send({ destination: "lnbc1..." })

      expect(sdk.prepareSendPayment).toHaveBeenCalledTimes(1)
      expect(sdk.sendPayment).toHaveBeenCalledTimes(1)
      expect(result.status).toBe("success")
    })

    it("returns failed on error", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockRejectedValue(new Error("network error"))

      const send = createSendPayment(sdk as never)
      const result = await send({ destination: "lnbc1..." })

      expect(result.status).toBe("failed")
      expect(result.errors?.[0].message).toBe("network error")
    })

    it("sends with tokenIdentifier + USDB-scaled amount when currency is USD", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({ amount: BigInt(100) })
      sdk.sendPayment.mockResolvedValue({})

      const send = createSendPayment(sdk as never)
      await send({
        destination: "lnbc1...",
        amount: { amount: 70, currency: "USD", currencyCode: "USD" },
      })

      // $0.70 = 70 cents → 70 * 10^4 = 700_000 USDB base units
      expect(sdk.prepareSendPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenIdentifier: "test-token-id",
          amount: BigInt(700000),
        }),
      )
    })

    it("sends without tokenIdentifier and amount in sats when currency is BTC", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({ amount: BigInt(1000) })
      sdk.sendPayment.mockResolvedValue({})

      const send = createSendPayment(sdk as never)
      await send({
        destination: "lnbc1...",
        amount: { amount: 1000, currency: "BTC", currencyCode: "BTC" },
      })

      expect(sdk.prepareSendPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenIdentifier: undefined,
          amount: BigInt(1000),
        }),
      )
    })

    it("sends without tokenIdentifier when amount is omitted", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({ amount: BigInt(0) })
      sdk.sendPayment.mockResolvedValue({})

      const send = createSendPayment(sdk as never)
      await send({ destination: "lnbc1..." })

      expect(sdk.prepareSendPayment).toHaveBeenCalledWith(
        expect.objectContaining({ tokenIdentifier: undefined }),
      )
    })
  })

  describe("createGetFee", () => {
    it("returns fee quote from prepared response", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({ amount: BigInt(100) })

      const getFee = createGetFee(sdk as never)
      const result = await getFee({ destination: "lnbc1..." })

      expect(result).not.toBeNull()
      expect(result?.paymentType).toBe("lightning")
    })

    it("returns null on error", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockRejectedValue(new Error("invalid"))

      const getFee = createGetFee(sdk as never)
      const result = await getFee({ destination: "lnbc1..." })

      expect(result).toBeNull()
    })

    it("records the rejection to crashlytics so the failure is queryable, not just a breadcrumb (Important #2)", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockRejectedValue(new Error("fee quote boom"))
      mockRecordError.mockClear()

      const getFee = createGetFee(sdk as never)
      await getFee({ destination: "lnbc1..." })

      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError.mock.calls[0][0].message).toContain("fee quote boom")
    })

    it("prepares with tokenIdentifier + USDB-scaled amount when currency is USD", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({ amount: BigInt(100) })

      const getFee = createGetFee(sdk as never)
      await getFee({
        destination: "lnbc1...",
        amount: { amount: 500, currency: "USD", currencyCode: "USD" },
      })

      // $5.00 = 500 cents → 500 * 10^4 = 5_000_000 USDB base units
      expect(sdk.prepareSendPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenIdentifier: "test-token-id",
          amount: BigInt(5000000),
        }),
      )
    })

    it("prepares without tokenIdentifier when amount currency is BTC", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({ amount: BigInt(100) })

      const getFee = createGetFee(sdk as never)
      await getFee({
        destination: "lnbc1...",
        amount: { amount: 1000, currency: "BTC", currencyCode: "BTC" },
      })

      expect(sdk.prepareSendPayment).toHaveBeenCalledWith(
        expect.objectContaining({ tokenIdentifier: undefined }),
      )
    })

    it("returns onchain quote with feeTier, confirmationEtaMinutes and totalDebited (Tier 2: previously unasserted)", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({
        amount: BigInt(50000),
        paymentMethod: {
          tag: "BitcoinAddress",
          inner: {
            feeQuote: {
              speedFast: { userFeeSat: BigInt(500), l1BroadcastFeeSat: BigInt(300) },
              speedMedium: { userFeeSat: BigInt(250), l1BroadcastFeeSat: BigInt(150) },
              speedSlow: { userFeeSat: BigInt(100), l1BroadcastFeeSat: BigInt(60) },
            },
          },
        },
      })

      const getFee = createGetFee(sdk as never)
      const result = await getFee({
        destination: "bc1q...",
        amount: { amount: 50000, currency: "BTC", currencyCode: "BTC" },
      })

      if (result?.paymentType !== "onchain") {
        throw new Error("expected onchain quote")
      }
      // Hardcoded today; documenting current behaviour. When I9 is fixed the
      // returned feeTier/feeAmount must match the requested tier.
      expect(result.feeTier).toBe("fast")
      expect(result.confirmationEtaMinutes).toBe(10)
      expect(result.feeAmount.amount).toBe(800)
      expect(result.recipientAmount.amount).toBe(50000)
      expect(result.totalDebited.amount).toBe(50800)
    })

    it("honours the requested feeTier (medium) instead of always picking fast (regression I9)", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({
        amount: BigInt(50000),
        paymentMethod: {
          tag: "BitcoinAddress",
          inner: {
            feeQuote: {
              speedFast: { userFeeSat: BigInt(500), l1BroadcastFeeSat: BigInt(300) },
              speedMedium: { userFeeSat: BigInt(250), l1BroadcastFeeSat: BigInt(150) },
              speedSlow: { userFeeSat: BigInt(100), l1BroadcastFeeSat: BigInt(60) },
            },
          },
        },
      })

      const getFee = createGetFee(sdk as never)
      const result = await getFee({
        destination: "bc1q...",
        amount: { amount: 50000, currency: "BTC", currencyCode: "BTC" },
        feeTier: "medium",
      })

      if (result?.paymentType !== "onchain") {
        throw new Error("expected onchain quote")
      }
      expect(result.feeTier).toBe("medium")
      expect(result.feeAmount.amount).toBe(400)
      expect(result.confirmationEtaMinutes).toBe(30)
    })

    it("honours the requested feeTier (slow)", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({
        amount: BigInt(50000),
        paymentMethod: {
          tag: "BitcoinAddress",
          inner: {
            feeQuote: {
              speedFast: { userFeeSat: BigInt(500), l1BroadcastFeeSat: BigInt(300) },
              speedMedium: { userFeeSat: BigInt(250), l1BroadcastFeeSat: BigInt(150) },
              speedSlow: { userFeeSat: BigInt(100), l1BroadcastFeeSat: BigInt(60) },
            },
          },
        },
      })

      const getFee = createGetFee(sdk as never)
      const result = await getFee({
        destination: "bc1q...",
        amount: { amount: 50000, currency: "BTC", currencyCode: "BTC" },
        feeTier: "slow",
      })

      if (result?.paymentType !== "onchain") {
        throw new Error("expected onchain quote")
      }
      expect(result.feeTier).toBe("slow")
      expect(result.feeAmount.amount).toBe(160)
      expect(result.confirmationEtaMinutes).toBe(60)
    })

    it("returns Lightning quote with the SDK fee from extractLightningFee (regression for #1)", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({
        amount: BigInt(2000),
        paymentMethod: {
          tag: "Bolt11Invoice",
          inner: {
            lightningFeeSats: BigInt(42),
          },
        },
      })

      const getFee = createGetFee(sdk as never)
      const result = await getFee({
        destination: "lnbc1...",
        amount: { amount: 2000, currency: "BTC", currencyCode: "BTC" },
      })

      expect(result?.paymentType).toBe("lightning")
      // Real SDK quote, not the LIGHTNING_FEE_SATS=0 stub from the legacy helper.
      expect(result?.feeAmount?.amount).toBe(42)
    })
  })

  describe("createReceiveLightning", () => {
    it("returns invoice from SDK", async () => {
      const sdk = createMockSdk()
      sdk.receivePayment.mockResolvedValue({ paymentRequest: "lnbc1invoice..." })

      const receive = createReceiveLightning(sdk as never)
      const result = await receive({ memo: "test" })

      expect(result.invoice).toBe("lnbc1invoice...")
    })

    it("returns error on failure", async () => {
      const sdk = createMockSdk()
      sdk.receivePayment.mockRejectedValue(new Error("SDK error"))

      const receive = createReceiveLightning(sdk as never)
      const result = await receive({})

      expect(result.errors?.[0].message).toBe("SDK error")
    })
  })

  describe("createReceiveOnchain", () => {
    it("returns bitcoin address from SDK", async () => {
      const sdk = createMockSdk()
      sdk.receivePayment.mockResolvedValue({ paymentRequest: "bc1q..." })

      const receive = createReceiveOnchain(sdk as never)
      const result = await receive()

      expect(result.address).toBe("bc1q...")
    })

    it("returns error on failure", async () => {
      const sdk = createMockSdk()
      sdk.receivePayment.mockRejectedValue(new Error("no address"))

      const receive = createReceiveOnchain(sdk as never)
      const result = await receive()

      expect(result.errors?.[0].message).toBe("no address")
    })
  })
})
