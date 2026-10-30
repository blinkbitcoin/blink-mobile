import { renderHook } from "@testing-library/react-hooks"
import { encode, sign } from "bolt11"
import { Network as SparkNetwork } from "@breeztech/breez-sdk-spark-react-native"

import { Network, PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { isSendDestination } from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { resolveDestination } from "@app/screens/send-bitcoin-screen/payment-destination/resolve-destination"
import { type ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import {
  DisplayCurrency,
  type MoneyAmount,
  type WalletOrDisplayCurrency,
} from "@app/types/amounts"

jest.mock("@app/self-custodial/config", () => ({
  ...jest.requireActual("@app/self-custodial/config"),
  requireSparkTokenIdentifier: () => "usdb-token-id",
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCurrencyListQuery: () => ({
    data: { currencyList: [{ id: "USD", symbol: "$", fractionDigits: 2 }] },
  }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  ...jest.requireActual("@app/hooks/use-price-conversion"),
  usePriceConversion: () => ({
    displayCurrency: "USD",
    toDisplayMoneyAmount: (amount: number) => ({
      amount,
      currency: DisplayCurrency,
      currencyCode: "USD",
    }),
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  ...jest.requireActual("@app/i18n/i18n-react"),
  useI18nContext: () => ({
    LL: { common: { currencySyncIssue: () => "Currency sync issue" } },
  }),
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
const CENTS_PER_SAT = 1
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

const shownOnScreen = (moneyAmount: MoneyAmount<WalletOrDisplayCurrency>): string => {
  const { result } = renderHook(() => useDisplayCurrency())
  return result.current.formatMoneyAmount({ moneyAmount })
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

const sdkRefusal = (reason: string) =>
  Object.assign(new Error(reason), { tag: "InvalidInput", inner: [reason] })

const FIXED_AMOUNTS = [
  {
    millisatoshis: 1_267_644,
    debitedSats: 1268,
    shown: "1,268 SAT",
    shape: "a remainder",
  },
  {
    millisatoshis: 1_499,
    debitedSats: 2,
    shown: "2 SAT",
    shape: "under half a satoshi over",
  },
  {
    millisatoshis: 1_001,
    debitedSats: 2,
    shown: "2 SAT",
    shape: "one millisatoshi over",
  },
  { millisatoshis: 999, debitedSats: 1, shown: "1 SAT", shape: "one millisatoshi under" },
  { millisatoshis: 500, debitedSats: 1, shown: "1 SAT", shape: "half a satoshi" },
  { millisatoshis: 1, debitedSats: 1, shown: "1 SAT", shape: "a single millisatoshi" },
  {
    millisatoshis: 1_268_000,
    debitedSats: 1268,
    shown: "1,268 SAT",
    shape: "whole sats",
  },
]

describe("paying a fixed-amount BOLT11 invoice from a self-custodial wallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrepareSendPayment.mockResolvedValue(lightningQuote)
    mockSendPayment.mockResolvedValue(undefined)
  })

  FIXED_AMOUNTS.forEach(({ millisatoshis, debitedSats, shown, shape }) => {
    describe(`an invoice for ${millisatoshis} msat (${shape})`, () => {
      it("resolves to the whole sats the SDK debits, rounded up and not editable", async () => {
        const invoice = fixedInvoice(millisatoshis)

        const detail = await paymentDetailFor(invoice, WalletCurrency.Btc)

        expect(detail.destination).toBe(invoice)
        expect(detail.canSetAmount).toBe(false)
        expect(detail.destinationSpecifiedAmount?.amount).toBe(debitedSats)
        expect(detail.settlementAmount.amount).toBe(debitedSats)
      })

      it("shows on screen exactly the sats the SDK debits", async () => {
        const detail = await paymentDetailFor(
          fixedInvoice(millisatoshis),
          WalletCurrency.Btc,
        )

        expect(shownOnScreen(detail.settlementAmount)).toBe(shown)
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
    it("converts to bitcoin but still leaves the amount to the invoice", async () => {
      const invoice = fixedInvoice(1_267_644)
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

    it("settles in cents from the rounded-up sats, not from the raw millisatoshis", async () => {
      const detail = await paymentDetailFor(fixedInvoice(1_499), WalletCurrency.Usd)

      expect(detail.destinationSpecifiedAmount?.amount).toBe(2)
      expect(detail.settlementAmount).toEqual({
        amount: 2,
        currency: WalletCurrency.Usd,
        currencyCode: WalletCurrency.Usd,
      })
    })
  })

  describe("when the SDK refuses the invoice's amount", () => {
    const refusal = sdkRefusal(
      "Requested amount (1269 sats) does not match invoice amount (1268 sats)",
    )

    beforeEach(() => {
      mockPrepareSendPayment.mockRejectedValue(refusal)
    })

    it("gives the confirmation screen the invalid-input code instead of a fee", async () => {
      const detail = await paymentDetailFor(fixedInvoice(1_267_644), WalletCurrency.Btc)
      if (!detail.canGetFee) throw new Error("expected a fee quote to be available")

      const result = await detail.getFee({} as never)

      expect(result.amount).toBeUndefined()
      expect(result.errors).toEqual([
        {
          __typename: "GraphQLApplicationError",
          message: SelfCustodialErrorCode.InvalidInput,
        },
      ])
    })

    it("records the refusal as a non-fatal so a regression shows up in crash reports", async () => {
      const detail = await paymentDetailFor(fixedInvoice(1_267_644), WalletCurrency.Btc)
      if (!detail.canGetFee) throw new Error("expected a fee quote to be available")

      await detail.getFee({} as never)

      expect(mockRecordError).toHaveBeenCalledWith(refusal)
    })

    it("never reaches the send", async () => {
      const detail = await paymentDetailFor(fixedInvoice(1_267_644), WalletCurrency.Btc)
      if (!detail.canSendPayment) throw new Error("expected the payment to be sendable")

      const result = await detail.sendPaymentMutation({} as never)

      expect(result.status).toBe(PaymentSendResult.Failure)
      expect(result.errors?.[0]?.message).toBe(SelfCustodialErrorCode.InvalidInput)
      expect(mockSendPayment).not.toHaveBeenCalled()
    })
  })
})
