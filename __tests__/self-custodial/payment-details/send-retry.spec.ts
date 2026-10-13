/* eslint-disable camelcase */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — SendPaymentMutation expects the custodial GQL mutate fns, unused here
import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"

import { createSelfCustodialSparkPaymentDetails } from "@app/self-custodial/payment-details/spark"
import {
  carryLostAttempts,
  createSendMutation,
  createSendMutationOnchain,
} from "@app/self-custodial/payment-details/send-helpers"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

const mockPrepareSendPayment = jest.fn()
const mockSendPayment = jest.fn()
const mockFindLostSend = jest.fn()

jest.mock("@app/self-custodial/payment-details/lost-send", () => ({
  ...jest.requireActual("@app/self-custodial/payment-details/lost-send"),
  findLostSend: (...args: unknown[]) => mockFindLostSend(...args),
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => {
  const tags = {
    SparkError: "SparkError",
    InsufficientFunds: "InsufficientFunds",
    InvalidInput: "InvalidInput",
    NetworkError: "NetworkError",
    Generic: "Generic",
  }
  const detailsOf = (tag: string) => ({
    instanceOf: (details: { tag?: string } | undefined) => details?.tag === tag,
  })
  return {
    AmountAdjustmentReason: {
      FlooredToMinLimit: "FlooredToMinLimit",
      IncreasedToAvoidDust: "IncreasedToAvoidDust",
    },
    BitcoinNetwork: { Bitcoin: 0, Regtest: 4 },
    InputType_Tags: { SparkAddress: "SparkAddress" },
    Network: { Mainnet: 0, Regtest: 1 },
    PaymentType: { Send: 0, Receive: 1 },
    SyncWalletRequest: { create: (request: unknown) => request },
    Seed: { Mnemonic: jest.fn().mockImplementation((args: unknown) => args) },
    StableBalanceActiveLabel: {
      Set: jest.fn().mockImplementation((args: unknown) => ({ tag: "Set", inner: args })),
    },
    connect: jest.fn(),
    defaultConfig: jest.fn().mockReturnValue({}),
    initLogging: jest.fn(),
    OnchainConfirmationSpeed: { Fast: 0, Medium: 1, Slow: 2 },
    PaymentDetails: {
      Lightning: detailsOf("Lightning"),
      Spark: detailsOf("Spark"),
      Token: detailsOf("Token"),
    },
    PaymentRequest: {
      Input: jest.fn().mockImplementation((inner: unknown) => ({ tag: "Input", inner })),
    },
    PaymentStatus: { Completed: 0, Pending: 1, Failed: 2 },
    PrepareSendPaymentRequest: { create: (args: unknown) => args },
    SendPaymentMethod_Tags: {
      BitcoinAddress: "BitcoinAddress",
      Bolt11Invoice: "Bolt11Invoice",
      SparkAddress: "SparkAddress",
      SparkInvoice: "SparkInvoice",
    },
    SendPaymentOptions: {
      BitcoinAddress: jest.fn().mockImplementation((args: unknown) => args),
      Bolt11Invoice: jest.fn().mockImplementation((args: unknown) => args),
    },
    SendPaymentRequest: { create: (args: unknown) => args },
    SdkError: {
      instanceOf: (obj: unknown) =>
        typeof obj === "object" &&
        obj !== null &&
        "tag" in obj &&
        Object.values(tags).includes((obj as { tag: string }).tag),
    },
    SdkError_Tags: tags,
  }
})

jest.mock("@app/self-custodial/config", () => ({
  requireSparkTokenIdentifier: () => "usdb-token-id",
  SparkToken: { DefaultDecimals: 6 },
}))

jest.mock("@app/screens/send-bitcoin-screen/fee-tier-selector", () => ({
  FeeTierOption: { Fast: "fast", Medium: "medium", Slow: "slow" },
}))

jest.mock("@app/utils/error-logging", () => ({ reportError: jest.fn() }))

const mockSdk = {
  prepareSendPayment: (...args: unknown[]) => mockPrepareSendPayment(...args),
  sendPayment: (...args: unknown[]) => mockSendPayment(...args),
} as never

const KEY = "11111111-1111-4111-8111-111111111111"
const NEXT_KEY = "22222222-2222-4222-8222-222222222222"

const sdkError = (tag: string) => ({ tag, inner: undefined })
/** A throw that leaves the outcome unknown: the transfer may have gone out. */
const lostResponse = () => sdkError("NetworkError")

const bolt11 = (paymentHash: string, extra = {}) => ({
  paymentMethod: {
    tag: "Bolt11Invoice",
    inner: { invoiceDetails: { paymentHash }, sparkTransferFeeSats: undefined },
  },
  tokenIdentifier: undefined,
  conversionEstimate: undefined,
  ...extra,
})
const sparkAddress = (tokenIdentifier?: string) => ({
  paymentMethod: { tag: "SparkAddress", inner: { address: "sp1abc", tokenIdentifier } },
  tokenIdentifier,
  conversionEstimate: undefined,
})
const sparkInvoice = (invoice: string, tokenIdentifier?: string) => ({
  paymentMethod: {
    tag: "SparkInvoice",
    inner: { sparkInvoiceDetails: { invoice }, tokenIdentifier },
  },
  tokenIdentifier,
  conversionEstimate: undefined,
})

const usdConversion = {
  conversionType: { tag: "ToBitcoin" },
  maxSlippageBps: undefined,
  completionTimeoutSecs: undefined,
}

const btcLightning = { sdk: mockSdk, paymentRequest: "lnbc1...", amount: undefined }
const usdLightning = { ...btcLightning, conversionOptions: usdConversion }
const btcSpark = { sdk: mockSdk, paymentRequest: "sp1abc", amount: BigInt(1000) }
const usdSpark = { ...btcSpark, tokenIdentifier: "usdb-token-id" }

/** What the send hook does before every attempt: mint the key into the ref, or reuse it. */
const attempt = (send: () => Promise<unknown>, ref: { current?: string }, key = KEY) => {
  ref.current = ref.current ?? key
  return send() as Promise<{ status: string; errors?: Array<{ message: string }> }>
}

const sentKeys = () =>
  mockSendPayment.mock.calls.map(
    ([request]) => request.idempotencyKey as string | undefined,
  )

const lookupMatches = (callIndex: number, payment: unknown): boolean =>
  mockFindLostSend.mock.calls[callIndex][0].matches(payment)

beforeEach(() => {
  jest.clearAllMocks()
})

describe("a bitcoin send carries the attempt's idempotency key", () => {
  it("sends a Lightning payment under the key the send hook minted", async () => {
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment.mockResolvedValue({})
    const ref = {}

    const result = await attempt(createSendMutation(btcLightning, ref), ref)

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(sentKeys()).toEqual([KEY])
  })

  it("retries a send that threw under the same key, so the SDK refuses a duplicate", async () => {
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValueOnce({})
    mockFindLostSend.mockResolvedValue({ status: "not-found" })
    const ref = {}
    const send = createSendMutation(btcLightning, ref)

    const first = await attempt(send, ref)
    const second = await attempt(send, ref, NEXT_KEY)

    expect(first.status).toBe(PaymentSendResult.Failure)
    expect(second.status).toBe(PaymentSendResult.Success)
    expect(sentKeys()).toEqual([KEY, KEY])
  })

  it("sends a Spark payment under the key", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockResolvedValue({})
    const ref = {}

    await attempt(createSendMutation(btcSpark, ref), ref)

    expect(sentKeys()).toEqual([KEY])
  })

  it("sends an on-chain payment under the key, with its confirmation speed", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: { tag: "BitcoinAddress", inner: {} },
    })
    mockSendPayment.mockResolvedValue({})
    const ref = {}

    await attempt(createSendMutationOnchain(btcSpark, "fast", ref), ref)

    expect(mockSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: KEY,
        options: expect.objectContaining({ confirmationSpeed: 0 }),
      }),
    )
  })

  it("never puts a key on a send with a token leg, which the SDK would reject", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockResolvedValue({})
    const ref = {}

    await attempt(createSendMutation(usdSpark, ref), ref)

    expect(sentKeys()).toEqual([undefined])
  })
})

describe("a dollar Lightning send is looked for instead", () => {
  beforeEach(() => {
    mockPrepareSendPayment.mockResolvedValue(
      bolt11("hash-1", { conversionEstimate: { amountIn: 1n } }),
    )
  })

  it("carries no key", async () => {
    mockSendPayment.mockResolvedValue({})
    const ref = {}

    await attempt(createSendMutation(usdLightning, ref), ref)

    expect(sentKeys()).toEqual([undefined])
  })

  it("reports a send that threw as sent when the wallet holds its payment", async () => {
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({ status: "found", payment: { id: "p1" } })
    const ref = {}

    const result = await attempt(createSendMutation(usdLightning, ref), ref)

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(
      lookupMatches(0, {
        details: { tag: "Lightning", inner: { htlcDetails: { paymentHash: "hash-1" } } },
      }),
    ).toBe(true)
    expect(
      lookupMatches(0, {
        details: { tag: "Lightning", inner: { htlcDetails: { paymentHash: "other" } } },
      }),
    ).toBe(false)
  })

  it("looks for the lost attempt before the retry sends, and does not pay twice", async () => {
    mockSendPayment.mockRejectedValueOnce(lostResponse())
    mockFindLostSend
      .mockResolvedValueOnce({ status: "not-found" })
      .mockResolvedValueOnce({ status: "found", payment: { id: "p1" } })
    const ref = {}
    const send = createSendMutation(usdLightning, ref)

    const first = await attempt(send, ref)
    const second = await attempt(send, ref)

    expect(first.status).toBe(PaymentSendResult.Failure)
    expect(second.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("sends nothing while the lost attempt's history cannot be read", async () => {
    mockSendPayment.mockRejectedValueOnce(lostResponse())
    mockFindLostSend
      .mockResolvedValueOnce({ status: "not-found" })
      .mockResolvedValueOnce({ status: "unreadable", error: new Error("offline") })
    const ref = {}
    const send = createSendMutation(usdLightning, ref)

    await attempt(send, ref)
    const second = await attempt(send, ref)

    expect(second.status).toBe(PaymentSendResult.Failure)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
    expect(ref.lostSend?.paymentHashes).toEqual(["hash-1"])
  })

  it("still looks for the lost attempt after a new amount starts the key over", async () => {
    mockSendPayment.mockRejectedValueOnce(lostResponse())
    mockFindLostSend
      .mockResolvedValueOnce({ status: "not-found" })
      .mockResolvedValueOnce({ status: "found", payment: { id: "p1" } })
    const ref = {}
    await attempt(createSendMutation(usdLightning, ref), ref)

    const rebuilt = carryLostAttempts(ref)
    const result = await attempt(createSendMutation(usdLightning, rebuilt), rebuilt)

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("does not look for a send the SDK refused before dispatching it", async () => {
    mockSendPayment.mockRejectedValue(sdkError("InsufficientFunds"))
    const ref = {}

    const result = await attempt(createSendMutation(usdLightning, ref), ref)

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.InsufficientFunds)
    expect(mockFindLostSend).not.toHaveBeenCalled()
  })
})

describe("a dollar send to a Spark invoice is looked for by the invoice", () => {
  it("matches the token payment of the same invoice", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkInvoice("spark1inv", "usdb-token-id"))
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({ status: "not-found" })
    const ref = {}

    await attempt(createSendMutation(usdSpark, ref), ref)

    expect(
      lookupMatches(0, {
        details: { tag: "Token", inner: { invoiceDetails: { invoice: "spark1inv" } } },
      }),
    ).toBe(true)
    expect(
      lookupMatches(0, {
        details: { tag: "Token", inner: { invoiceDetails: { invoice: "spark1other" } } },
      }),
    ).toBe(false)
    expect(ref.lostSend?.sparkInvoices).toEqual(["spark1inv"])
  })
})

describe("a send that cannot be looked for is never sent twice", () => {
  it("tells the sender a dollar Spark-address send that threw may have gone out", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockRejectedValue(lostResponse())
    const ref = {}
    const send = createSendMutation(usdSpark, ref)

    const first = await attempt(send, ref)
    const second = await attempt(send, ref)

    expect(first.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(second.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
    expect(mockPrepareSendPayment).toHaveBeenCalledTimes(1)
  })

  it("keeps refusing it after a new amount or wallet", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockRejectedValue(lostResponse())
    const ref = {}
    await attempt(createSendMutation(usdSpark, ref), ref)

    const rebuilt = carryLostAttempts(ref)
    const result = await attempt(createSendMutation(btcSpark, rebuilt), rebuilt, NEXT_KEY)

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("lets it through again when the SDK refused it before dispatch", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment
      .mockRejectedValueOnce(sdkError("InsufficientFunds"))
      .mockResolvedValueOnce({})
    const ref = {}
    const send = createSendMutation(usdSpark, ref)

    await attempt(send, ref)
    const second = await attempt(send, ref)

    expect(second.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(2)
  })

  it("retries a bitcoin Spark-address send only under the key it went out with", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValueOnce({})
    const ref = {}
    const send = createSendMutation(btcSpark, ref)

    const first = await attempt(send, ref)
    const second = await attempt(send, ref)

    expect(first.errors?.[0].message).toBe(SelfCustodialErrorCode.NetworkError)
    expect(second.status).toBe(PaymentSendResult.Success)
    expect(sentKeys()).toEqual([KEY, KEY])
    expect(ref.unresolvedSend).toBeUndefined()
  })

  it("refuses the bitcoin send once a new amount starts the key over", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockRejectedValue(lostResponse())
    const ref = {}
    await attempt(createSendMutation(btcSpark, ref), ref)

    const rebuilt = carryLostAttempts(ref)
    const result = await attempt(createSendMutation(btcSpark, rebuilt), rebuilt, NEXT_KEY)

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })
})

describe("the payment detail keeps one attempt ref per payment", () => {
  const sats = (amount: number) => ({
    amount,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  })
  const createDetail = () =>
    createSelfCustodialSparkPaymentDetails({
      sdk: mockSdk,
      address: "sp1abc",
      unitOfAccountAmount: sats(1000),
      convertMoneyAmount: (amount) => amount,
      sendingWalletDescriptor: { id: "btc", currency: WalletCurrency.Btc },
    })

  it("exposes the ref, so the send hook mints the key into it", () => {
    const detail = createDetail()

    expect(detail.idempotencyKeyRef).toEqual({})
  })

  it("keeps the same ref, key included, across a new memo", () => {
    const detail = createDetail()
    detail.idempotencyKeyRef.current = KEY

    const rebuilt = detail.setMemo("rent")

    expect(rebuilt.idempotencyKeyRef).toBe(detail.idempotencyKeyRef)
  })

  it("starts the key over on a new amount, carrying what a lost attempt left", () => {
    const detail = createDetail()
    detail.idempotencyKeyRef.current = KEY
    detail.idempotencyKeyRef.unresolvedSend = { idempotencyKey: KEY }

    const rebuilt = detail.setAmount(sats(2000))

    expect(rebuilt.idempotencyKeyRef.current).toBeUndefined()
    expect(rebuilt.idempotencyKeyRef.unresolvedSend).toEqual({ idempotencyKey: KEY })
  })
})
