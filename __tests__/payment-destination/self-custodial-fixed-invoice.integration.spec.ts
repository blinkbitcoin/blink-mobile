/* eslint-disable camelcase */
import { encode, sign } from "bolt11"
import { Network as SparkNetwork } from "@breeztech/breez-sdk-spark-react-native"

import { Network, PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import { isSendDestination } from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { resolveDestination } from "@app/screens/send-bitcoin-screen/payment-destination/resolve-destination"
import { type ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  AmountAdjustmentReason: {
    FlooredToMinLimit: "FlooredToMinLimit",
    IncreasedToAvoidDust: "IncreasedToAvoidDust",
  },
  BitcoinNetwork: { Bitcoin: 0, Regtest: 4 },
  ConversionType: {
    FromBitcoin: jest.fn().mockImplementation(() => ({ tag: "FromBitcoin" })),
    ToBitcoin: jest
      .fn()
      .mockImplementation((inner: unknown) => ({ tag: "ToBitcoin", inner })),
  },
  InputType_Tags: { SparkAddress: "SparkAddress" },
  Network: { Mainnet: 0, Regtest: 1 },
  OnchainConfirmationSpeed: { Fast: 0, Medium: 1, Slow: 2 },
  PaymentRequest: {
    Input: jest.fn().mockImplementation((inner: unknown) => ({ tag: "Input", inner })),
  },
  PrepareSendPaymentRequest: { create: (p: Record<string, unknown>) => p },
  SdkError: { instanceOf: () => false },
  SdkError_Tags: {},
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
  ...jest.requireActual("@app/self-custodial/config"),
  requireSparkTokenIdentifier: () => "usdb-token-id",
}))

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  log: jest.fn(),
}))

const mockPrepareSendPayment = jest.fn()
const mockSendPayment = jest.fn()

const sdk = {
  parse: jest.fn(),
  prepareSendPayment: (...args: unknown[]) => mockPrepareSendPayment(...args),
  sendPayment: (...args: unknown[]) => mockSendPayment(...args),
} as never

const SYNTHETIC_NODE_PRIVATE_KEY = "11".repeat(32)
const SYNTHETIC_PAYMENT_HASH = "ab".repeat(32)
const CENTS_PER_SAT = 0.1
const LIGHTNING_FEE_SATS = 7

const fixedInvoice = (millisatoshis: number): string => {
  const unsigned = encode({
    millisatoshis: String(millisatoshis),
    timestamp: Math.floor(Date.now() / 1000),
    tags: [
      { tagName: "payment_hash", data: SYNTHETIC_PAYMENT_HASH },
      { tagName: "description", data: "synthetic test invoice" },
    ],
  })
  const { paymentRequest } = sign(unsigned, SYNTHETIC_NODE_PRIVATE_KEY)
  if (!paymentRequest) throw new Error("bolt11 did not sign the synthetic invoice")
  return paymentRequest
}

const convertMoneyAmount = ((moneyAmount, toCurrency) => {
  if (moneyAmount.currency === toCurrency) return moneyAmount
  const rate = toCurrency === WalletCurrency.Usd ? CENTS_PER_SAT : 1 / CENTS_PER_SAT
  return {
    amount: Math.round(moneyAmount.amount * rate),
    currency: toCurrency,
    currencyCode: toCurrency,
  }
}) as ConvertMoneyAmount

const resolveInvoice = (invoice: string) =>
  resolveDestination(
    {
      rawInput: invoice,
      myWalletIds: ["synthetic-wallet"],
      bitcoinNetwork: Network.Mainnet,
      lnurlDomains: [],
      accountDefaultWalletQuery: jest.fn() as never,
    },
    { sdk, network: SparkNetwork.Mainnet },
    "blink.sv",
  )

const paymentDetailFor = async (invoice: string, currency: WalletCurrency) => {
  const destination = await resolveInvoice(invoice)
  if (!isSendDestination(destination)) throw new Error("invoice did not resolve")
  return destination.createPaymentDetail({
    convertMoneyAmount,
    sendingWalletDescriptor: { id: `synthetic-${currency}-wallet`, currency },
  })
}

const lightningQuote = {
  paymentMethod: {
    tag: "Bolt11Invoice",
    inner: {
      sparkTransferFeeSats: undefined,
      lightningFeeSats: BigInt(LIGHTNING_FEE_SATS),
    },
  },
}

const preparedWithoutAmount = (invoice: string) => ({
  paymentRequest: { tag: "Input", inner: { input: invoice } },
  amount: undefined,
  tokenIdentifier: undefined,
  conversionOptions: undefined,
})

const FIXED_AMOUNTS = [
  { millisatoshis: 1_267_644, sats: 1267.644, shape: "a millisatoshi remainder" },
  { millisatoshis: 1_001, sats: 1.001, shape: "one millisatoshi over a satoshi" },
  { millisatoshis: 999, sats: 0.999, shape: "one millisatoshi under a satoshi" },
  { millisatoshis: 500, sats: 0.5, shape: "half a satoshi" },
  { millisatoshis: 1, sats: 0.001, shape: "a single millisatoshi" },
  { millisatoshis: 1_268_000, sats: 1268, shape: "whole satoshis" },
]

describe("paying a fixed-amount BOLT11 invoice from a self-custodial wallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrepareSendPayment.mockResolvedValue(lightningQuote)
    mockSendPayment.mockResolvedValue(undefined)
  })

  FIXED_AMOUNTS.forEach(({ millisatoshis, sats, shape }) => {
    describe(`an invoice for ${millisatoshis} msat (${shape})`, () => {
      it("resolves to a fixed amount of exactly the invoice's sats, with no rounding", async () => {
        const invoice = fixedInvoice(millisatoshis)

        const detail = await paymentDetailFor(invoice, WalletCurrency.Btc)

        expect(detail.destination).toBe(invoice)
        expect(detail.canSetAmount).toBe(false)
        expect(detail.destinationSpecifiedAmount?.amount).toBe(sats)
        expect(detail.settlementAmount.amount).toBe(sats)
      })

      it("asks the SDK to quote the invoice itself, with no amount of its own", async () => {
        const invoice = fixedInvoice(millisatoshis)
        const detail = await paymentDetailFor(invoice, WalletCurrency.Btc)
        if (!detail.canGetFee) throw new Error("expected a fee quote to be available")

        const result = await detail.getFee({} as never)

        expect(mockPrepareSendPayment).toHaveBeenCalledTimes(1)
        expect(mockPrepareSendPayment.mock.calls[0][0]).toStrictEqual(
          preparedWithoutAmount(invoice),
        )
        expect(result.amount?.amount).toBe(LIGHTNING_FEE_SATS)
        expect(result.errors).toBeUndefined()
      })

      it("sends the invoice itself, with no amount of its own", async () => {
        const invoice = fixedInvoice(millisatoshis)
        const detail = await paymentDetailFor(invoice, WalletCurrency.Btc)
        if (!detail.canSendPayment) throw new Error("expected the payment to be sendable")

        const result = await detail.sendPaymentMutation({} as never)

        expect(result.status).toBe(PaymentSendResult.Success)
        expect(mockPrepareSendPayment.mock.calls[0][0]).toStrictEqual(
          preparedWithoutAmount(invoice),
        )
        expect(mockSendPayment).toHaveBeenCalledWith({
          prepareResponse: lightningQuote,
          options: {
            tag: "Bolt11Invoice",
            inner: { preferSpark: false, completionTimeoutSecs: undefined },
          },
        })
      })
    })
  })

  describe("an invoice with a millisatoshi remainder paid from a USD wallet", () => {
    const invoice = fixedInvoice(1_267_644)

    it("converts to bitcoin but still leaves the amount to the invoice", async () => {
      const detail = await paymentDetailFor(invoice, WalletCurrency.Usd)
      if (!detail.canGetFee) throw new Error("expected a fee quote to be available")

      await detail.getFee({} as never)

      expect(mockPrepareSendPayment.mock.calls[0][0]).toStrictEqual({
        ...preparedWithoutAmount(invoice),
        conversionOptions: {
          conversionType: {
            tag: "ToBitcoin",
            inner: { fromTokenIdentifier: "usdb-token-id" },
          },
          maxSlippageBps: undefined,
          completionTimeoutSecs: undefined,
        },
      })
    })

    it("settles in whole cents while the invoice keeps its millisatoshis", async () => {
      const detail = await paymentDetailFor(invoice, WalletCurrency.Usd)

      expect(detail.settlementAmount).toEqual({
        amount: 127,
        currency: WalletCurrency.Usd,
        currencyCode: WalletCurrency.Usd,
      })
      expect(detail.destinationSpecifiedAmount?.amount).toBe(1267.644)
    })
  })

  describe("when the SDK refuses to quote an invoice with a millisatoshi remainder", () => {
    const invoice = fixedInvoice(1_267_644)

    beforeEach(() => {
      mockPrepareSendPayment.mockRejectedValue(
        new Error("synthetic refusal: prepared amount is below the invoice amount"),
      )
    })

    it("gives the confirmation screen a classified error instead of a fee", async () => {
      const detail = await paymentDetailFor(invoice, WalletCurrency.Btc)
      if (!detail.canGetFee) throw new Error("expected a fee quote to be available")

      const result = await detail.getFee({} as never)

      expect(result.amount).toBeUndefined()
      expect(result.errors).toEqual([
        {
          __typename: "GraphQLApplicationError",
          message: SelfCustodialErrorCode.Generic,
        },
      ])
    })

    it("records the refusal as a non-fatal so a regression shows up in crash reports", async () => {
      const detail = await paymentDetailFor(invoice, WalletCurrency.Btc)
      if (!detail.canGetFee) throw new Error("expected a fee quote to be available")

      await detail.getFee({} as never)

      expect(mockRecordError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "synthetic refusal: prepared amount is below the invoice amount",
        }),
      )
    })

    it("never reaches the send", async () => {
      const detail = await paymentDetailFor(invoice, WalletCurrency.Btc)
      if (!detail.canSendPayment) throw new Error("expected the payment to be sendable")

      const result = await detail.sendPaymentMutation({} as never)

      expect(result.status).toBe(PaymentSendResult.Failure)
      expect(mockSendPayment).not.toHaveBeenCalled()
    })
  })
})
