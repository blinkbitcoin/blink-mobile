/* eslint-disable camelcase */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — SendPaymentMutation expects the custodial GQL mutate fns, unused here
import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"

import { createSelfCustodialSparkPaymentDetails } from "@app/self-custodial/payment-details/spark"
import {
  lostAttemptsTo,
  scopeLostAttemptsTo,
  STORED_ATTEMPTS_READ_TIMEOUT_MS,
  type RequestedAs,
} from "@app/self-custodial/payment-details/lost-attempts"
import {
  createSendMutation,
  createSendMutationOnchain,
  runSelfCustodialSend,
} from "@app/self-custodial/payment-details/send-helpers"
import { identifyPreparedSend } from "@app/self-custodial/bridge/send"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import { reportError } from "@app/utils/error-logging"
import * as measurement from "@app/self-custodial/measurement"

const mockPrepareSendPayment = jest.fn()
const mockSendPayment = jest.fn()
const mockFindLostSend = jest.fn()
const mockFindPaymentUnderKey = jest.fn()

jest.mock("@app/self-custodial/payment-details/lost-send", () => ({
  ...jest.requireActual("@app/self-custodial/payment-details/lost-send"),
  findLostSend: (...args: unknown[]) => mockFindLostSend(...args),
  findPaymentUnderKey: (...args: unknown[]) => mockFindPaymentUnderKey(...args),
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

const mockListPayments = jest.fn()

const mockSdk = {
  prepareSendPayment: (...args: unknown[]) => mockPrepareSendPayment(...args),
  sendPayment: (...args: unknown[]) => mockSendPayment(...args),
  listPayments: (...args: unknown[]) => mockListPayments(...args),
} as never

const KEY = "11111111-1111-4111-8111-111111111111"
const TELEMETRY = { rail: "bolt11", sendingWallet: WalletCurrency.Btc } as const
const NEXT_KEY = "22222222-2222-4222-8222-222222222222"

const sdkError = (tag: string) => ({ tag, inner: undefined })
const COMPLETED = 0
const FAILED = 2
/** What the SDK answers a send it made with: the payment, pending or completed. */
const sent = (status = COMPLETED) => ({ payment: { id: "p1", status } })
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

/** Storage holding nothing from an earlier launch, and keeping nothing for the next. */
const noStoredAttempts = {
  load: async () => new Map(),
  save: async () => undefined,
  remove: async () => undefined,
}
let connectedWallets = 0
beforeEach(() => {
  jest.clearAllMocks()
  /** Lost attempts are kept for the connected wallet for as long as the app runs, which
   *  here is the whole file: every test connects a wallet of its own, holding none. */
  scopeLostAttemptsTo(`wallet-${(connectedWallets += 1)}`, noStoredAttempts)
})

describe("a bitcoin send carries the attempt's idempotency key", () => {
  it("sends a Lightning payment under the key the send hook minted", async () => {
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment.mockResolvedValue(sent())
    const ref = {}

    const result = await attempt(
      createSendMutation(btcLightning, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(sentKeys()).toEqual([KEY])
  })

  it("retries a send that threw under the same key, so the SDK refuses a duplicate", async () => {
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValueOnce(sent())
    mockFindLostSend.mockResolvedValue({ status: "not-found", failed: [] })
    const ref = {}
    const send = createSendMutation(btcLightning, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    const first = await attempt(send, ref)
    const second = await attempt(send, ref, NEXT_KEY)

    expect(first.status).toBe(PaymentSendResult.Failure)
    expect(second.status).toBe(PaymentSendResult.Success)
    expect(sentKeys()).toEqual([KEY, KEY])
  })

  it("sends a Spark payment under the key", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockResolvedValue(sent())
    const ref = {}

    await attempt(
      createSendMutation(btcSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(sentKeys()).toEqual([KEY])
  })

  it("sends an on-chain payment under the key, with its confirmation speed", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: { tag: "BitcoinAddress", inner: {} },
    })
    mockSendPayment.mockResolvedValue(sent())
    const ref = {}

    await attempt(
      createSendMutationOnchain(btcSpark, "fast", {
        telemetry: TELEMETRY,
        idempotencyKeyRef: ref,
      }),
      ref,
    )

    expect(mockSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: KEY,
        options: expect.objectContaining({ confirmationSpeed: 0 }),
      }),
    )
  })

  it("never puts a key on a send with a token leg, which the SDK would reject", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockResolvedValue(sent())
    const ref = {}

    await attempt(
      createSendMutation(usdSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

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
    mockSendPayment.mockResolvedValue(sent())
    const ref = {}

    await attempt(
      createSendMutation(usdLightning, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(sentKeys()).toEqual([undefined])
  })

  it("reports a send that threw as sent when the wallet holds its payment", async () => {
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({
      status: "found",
      payment: { id: "p1" },
      failed: [],
    })
    const ref = {}

    const result = await attempt(
      createSendMutation(usdLightning, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

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
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce({ status: "found", payment: { id: "p1" }, failed: [] })
    const ref = {}
    const send = createSendMutation(usdLightning, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    const first = await attempt(send, ref)
    const second = await attempt(send, ref)

    expect(first.status).toBe(PaymentSendResult.Failure)
    expect(second.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("sends nothing while the lost attempt's history cannot be read", async () => {
    mockSendPayment.mockRejectedValueOnce(lostResponse())
    mockFindLostSend
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce({ status: "unreadable", error: new Error("offline") })
    const ref = {}
    const send = createSendMutation(usdLightning, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    await attempt(send, ref)
    const second = await attempt(send, ref)

    expect(second.status).toBe(PaymentSendResult.Failure)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
    expect(lostAttemptsTo("lnbc1...").lostSend?.paymentHashes).toEqual(["hash-1"])
  })

  it("still looks for the lost attempt after a new amount starts the key over", async () => {
    mockSendPayment.mockRejectedValueOnce(lostResponse())
    mockFindLostSend
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce({ status: "found", payment: { id: "p1" }, failed: [] })
    const ref = {}
    await attempt(
      createSendMutation(usdLightning, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    /** A new amount or wallet: the same destination under a new key ref. */
    const rebuilt = {}
    const result = await attempt(
      createSendMutation(usdLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: rebuilt,
      }),
      rebuilt,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("does not look for a send the SDK refused before dispatching it", async () => {
    mockSendPayment.mockRejectedValue(sdkError("InsufficientFunds"))
    const ref = {}

    const result = await attempt(
      createSendMutation(usdLightning, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.InsufficientFunds)
    expect(mockFindLostSend).not.toHaveBeenCalled()
  })
})

describe("a dollar send to a Spark invoice is looked for by the invoice", () => {
  it("matches the token payment of the same invoice", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkInvoice("spark1inv", "usdb-token-id"))
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({ status: "not-found", failed: [] })
    const ref = {}

    await attempt(
      createSendMutation(usdSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

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
    expect(lostAttemptsTo("sp1abc").lostSend?.sparkInvoices).toEqual(["spark1inv"])
  })
})

describe("a send that cannot be looked for is never sent twice", () => {
  it("tells the sender a dollar Spark-address send that threw may have gone out", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockRejectedValue(lostResponse())
    const ref = {}
    const send = createSendMutation(usdSpark, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

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
    await attempt(
      createSendMutation(usdSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    /** A new amount or wallet: the same destination under a new key ref. */
    const rebuilt = {}
    const result = await attempt(
      createSendMutation(btcSpark, { telemetry: TELEMETRY, idempotencyKeyRef: rebuilt }),
      rebuilt,
      NEXT_KEY,
    )

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("lets it through again when the SDK refused it before dispatch", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment
      .mockRejectedValueOnce(sdkError("InsufficientFunds"))
      .mockResolvedValueOnce(sent())
    const ref = {}
    const send = createSendMutation(usdSpark, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    await attempt(send, ref)
    const second = await attempt(send, ref)

    expect(second.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(2)
  })

  it("retries a bitcoin Spark-address send only under the key it went out with", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValueOnce(sent())
    const ref = {}
    const send = createSendMutation(btcSpark, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    const first = await attempt(send, ref)
    const second = await attempt(send, ref)

    expect(first.errors?.[0].message).toBe(SelfCustodialErrorCode.NetworkError)
    expect(second.status).toBe(PaymentSendResult.Success)
    expect(sentKeys()).toEqual([KEY, KEY])
    expect(lostAttemptsTo("sp1abc").unresolvedSend).toBeUndefined()
  })

  describe("a bitcoin send under a new key, once one under another key was lost", () => {
    /** Lost under KEY, then sent again under NEXT_KEY: a new amount, a new wallet, or the
     *  details screen opened anew. */
    const sendUnderNewKey = async () => {
      mockPrepareSendPayment.mockResolvedValue(sparkAddress())
      mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValue(sent())
      const ref = {}
      await attempt(
        createSendMutation(btcSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
        ref,
      )

      const rebuilt = {}
      return attempt(
        createSendMutation(btcSpark, {
          telemetry: TELEMETRY,
          idempotencyKeyRef: rebuilt,
        }),
        rebuilt,
        NEXT_KEY,
      )
    }

    /** Exact, whatever the phone's clock says: no window can leave the payment out. */
    it("asks the wallet for the lost attempt by its key, the id the SDK records it under", async () => {
      mockFindPaymentUnderKey.mockResolvedValue({ status: "not-found", failed: [] })

      await sendUnderNewKey()

      expect(mockFindPaymentUnderKey).toHaveBeenCalledWith(
        expect.objectContaining({ key: KEY }),
      )
      expect(mockFindLostSend).not.toHaveBeenCalled()
    })

    it("reports the lost attempt's payment as the send when the wallet holds it", async () => {
      mockFindPaymentUnderKey.mockResolvedValue({
        status: "found",
        payment: { id: KEY },
        failed: [],
      })

      const result = await sendUnderNewKey()

      expect(result.status).toBe(PaymentSendResult.Success)
      expect(mockSendPayment).toHaveBeenCalledTimes(1)
      expect(lostAttemptsTo("sp1abc")).toEqual({})
    })

    it("sends once the wallet shows the lost attempt never went out", async () => {
      mockFindPaymentUnderKey.mockResolvedValue({ status: "not-found", failed: [] })

      const result = await sendUnderNewKey()

      expect(result.status).toBe(PaymentSendResult.Success)
      expect(sentKeys()).toEqual([KEY, NEXT_KEY])
      expect(lostAttemptsTo("sp1abc")).toEqual({})
    })

    it("refuses it while the wallet's history cannot be read", async () => {
      mockFindPaymentUnderKey.mockResolvedValue({
        status: "unreadable",
        error: new Error("off"),
      })

      const result = await sendUnderNewKey()

      expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
      expect(mockSendPayment).toHaveBeenCalledTimes(1)
      expect(lostAttemptsTo("sp1abc").unresolvedSend?.idempotencyKey).toBe(KEY)
    })
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

  it("starts the key over on a new amount", () => {
    const detail = createDetail()
    detail.idempotencyKeyRef.current = KEY

    const rebuilt = detail.setAmount(sats(2000))

    expect(rebuilt.idempotencyKeyRef).not.toBe(detail.idempotencyKeyRef)
    expect(rebuilt.idempotencyKeyRef.current).toBeUndefined()
  })
})

describe("a retry under the key every lost attempt went out with", () => {
  it("is sent without a look, since the SDK refuses it as a duplicate anyway", async () => {
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValueOnce(sent())
    const ref = {}
    const send = createSendMutation(btcLightning, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    await attempt(send, ref)
    const retry = await attempt(send, ref)

    expect(retry.status).toBe(PaymentSendResult.Success)
    expect(mockFindLostSend).not.toHaveBeenCalled()
    expect(sentKeys()).toEqual([KEY, KEY])
  })

  it("is still looked for under a new key, a new amount's", async () => {
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment.mockRejectedValueOnce(lostResponse())
    mockFindLostSend.mockResolvedValue({
      status: "found",
      payment: { id: "p1" },
      failed: [],
    })
    const ref = {}
    await attempt(
      createSendMutation(btcLightning, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    const rebuilt = {}
    const result = await attempt(
      createSendMutation(btcLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: rebuilt,
      }),
      rebuilt,
      NEXT_KEY,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(mockFindLostSend).toHaveBeenCalledTimes(1)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("is looked for once the attempts went out under different keys", async () => {
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({ status: "not-found", failed: [] })
    const first = {}
    await attempt(
      createSendMutation(btcLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: first,
      }),
      first,
    )
    const second = {}
    await attempt(
      createSendMutation(btcLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: second,
      }),
      second,
      NEXT_KEY,
    )
    expect(lostAttemptsTo("lnbc1...").lostSend?.idempotencyKey).toBeUndefined()

    mockFindLostSend.mockClear()
    await attempt(
      createSendMutation(btcLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: second,
      }),
      second,
    )

    expect(mockFindLostSend).toHaveBeenCalledTimes(1)
  })
})

describe("lost attempts outlive the payment detail", () => {
  const usdSparkDetail = () =>
    createSelfCustodialSparkPaymentDetails({
      sdk: mockSdk,
      address: "sp1abc",
      unitOfAccountAmount: {
        amount: 1000,
        currency: WalletCurrency.Btc,
        currencyCode: "BTC",
      },
      convertMoneyAmount: (amount) => amount,
      sendingWalletDescriptor: { id: "usd", currency: WalletCurrency.Usd },
    })

  /** The details screen builds a new detail every time it is opened: backing out after
   *  a lost send and entering the same address again must not send it a second time. */
  it("refuses a send to the same address from a newly built detail", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValue(sent())

    const first = usdSparkDetail()
    await attempt(first.sendPaymentMutation, first.idempotencyKeyRef)
    const reopened = usdSparkDetail()
    const result = await attempt(reopened.sendPaymentMutation, reopened.idempotencyKeyRef)

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("leaves a send to another address alone", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValue(sent())
    const ref = {}
    await attempt(
      createSendMutation(usdSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    const elsewhere = { ...usdSpark, paymentRequest: "sp1other" }
    const other = {}
    const result = await attempt(
      createSendMutation(elsewhere, { telemetry: TELEMETRY, idempotencyKeyRef: other }),
      other,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
  })
})

describe("a send the SDK adds a conversion to on its own", () => {
  /** Stable balance active and too few sats: the SDK converts on the way, so the send
   *  goes out without the key, however it was asked for. */
  const withConversion = <P extends object>(prepared: P) => ({
    ...prepared,
    conversionEstimate: { amountIn: 1n },
  })

  it("is treated as the keyless send it is, and never sent twice to an address", async () => {
    mockPrepareSendPayment.mockResolvedValue(withConversion(sparkAddress()))
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValue(sent())
    const ref = {}
    const send = createSendMutation(btcSpark, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    const first = await attempt(send, ref)
    const retry = await attempt(send, ref)

    expect(first.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(retry.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(sentKeys()).toEqual([undefined])
  })

  it("is looked for at once when it throws, as a dollar send is", async () => {
    mockPrepareSendPayment.mockResolvedValue(withConversion(bolt11("hash-1")))
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({
      status: "found",
      payment: { id: "p1" },
      failed: [],
    })
    const ref = {}

    const result = await attempt(
      createSendMutation(btcLightning, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(sentKeys()).toEqual([undefined])
  })

  it("is looked for before a same-key retry, whose key would be dropped", async () => {
    mockPrepareSendPayment.mockResolvedValueOnce(bolt11("hash-1"))
    mockSendPayment.mockRejectedValueOnce(lostResponse())
    const ref = {}
    const send = createSendMutation(btcLightning, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })
    await attempt(send, ref)

    mockPrepareSendPayment.mockResolvedValue(withConversion(bolt11("hash-1")))
    mockFindLostSend.mockResolvedValue({
      status: "found",
      payment: { id: "p1" },
      failed: [],
    })
    const retry = await attempt(send, ref)

    expect(retry.status).toBe(PaymentSendResult.Success)
    expect(mockFindLostSend).toHaveBeenCalledTimes(1)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })
})

describe("a payment the SDK hands back as failed", () => {
  it("is reported as failed, not as sent", async () => {
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment.mockResolvedValue(sent(FAILED))
    const ref = {}

    const result = await attempt(
      createSendMutation(btcLightning, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(result.status).toBe(PaymentSendResult.Failure)
  })

  /** A retry under the key of an attempt whose payment failed gets that payment back:
   *  failed is final, so the next attempt is a new payment under a new key. */
  it("starts the key over, so the next attempt is a new payment", async () => {
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment
      .mockRejectedValueOnce(lostResponse())
      .mockResolvedValueOnce(sent(FAILED))
      .mockResolvedValueOnce(sent())
    const ref = {}
    const send = createSendMutation(btcLightning, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    await attempt(send, ref)
    const failedRetry = await attempt(send, ref)
    const next = await attempt(send, ref, NEXT_KEY)

    expect(failedRetry.status).toBe(PaymentSendResult.Failure)
    expect(lostAttemptsTo("lnbc1...")).toEqual({})
    expect(next.status).toBe(PaymentSendResult.Success)
    expect(sentKeys()).toEqual([KEY, KEY, NEXT_KEY])
  })
})

describe("the lost attempts of one invoice", () => {
  it("hold its payment hash once, however many attempts were lost", async () => {
    mockPrepareSendPayment.mockResolvedValue(
      bolt11("hash-1", { conversionEstimate: { amountIn: 1n } }),
    )
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({ status: "not-found", failed: [] })
    const ref = {}
    const send = createSendMutation(usdLightning, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    for (let i = 0; i < 3; i += 1) await attempt(send, ref)

    expect(lostAttemptsTo("lnbc1...").lostSend?.paymentHashes).toEqual(["hash-1"])
  })
})

describe("sends to one destination", () => {
  const deferred = () => {
    let resolve: (value: unknown) => void = () => undefined
    let reject: (err: unknown) => void = () => undefined
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
  const settleTicks = () => new Promise(setImmediate)
  const withConversion = (prepared: object) => ({
    ...prepared,
    conversionEstimate: { amountIn: 1n },
  })

  it("go one at a time: the second is not quoted while the first is in flight", async () => {
    const inFlight = deferred()
    mockPrepareSendPayment.mockResolvedValue(withConversion(bolt11("hash-a")))
    mockSendPayment
      .mockImplementationOnce(() => inFlight.promise)
      .mockResolvedValue(sent())
    const first = {}
    const second = {}

    const sends = [
      attempt(
        createSendMutation(usdLightning, {
          telemetry: TELEMETRY,
          idempotencyKeyRef: first,
        }),
        first,
      ),
      attempt(
        createSendMutation(usdLightning, {
          telemetry: TELEMETRY,
          idempotencyKeyRef: second,
        }),
        second,
        NEXT_KEY,
      ),
    ]
    await settleTicks()
    expect(mockPrepareSendPayment).toHaveBeenCalledTimes(1)

    inFlight.resolve(sent())
    await Promise.all(sends)
    expect(mockPrepareSendPayment).toHaveBeenCalledTimes(2)
    expect(mockSendPayment).toHaveBeenCalledTimes(2)
  })

  /** The second sees what the first left behind, and looks for it before it sends: had
   *  they overlapped, each could have taken the other's payment for its own. */
  it("look for the payment a send in flight lost before they go out", async () => {
    const inFlight = deferred()
    mockPrepareSendPayment.mockResolvedValueOnce(withConversion(bolt11("hash-a")))
    mockSendPayment.mockImplementationOnce(() => inFlight.promise)
    mockFindLostSend
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce({ status: "found", payment: { id: "paid-a" }, failed: [] })
    const first = {}
    const second = {}

    const sends = [
      attempt(
        createSendMutation(usdLightning, {
          telemetry: TELEMETRY,
          idempotencyKeyRef: first,
        }),
        first,
      ),
      attempt(
        createSendMutation(usdLightning, {
          telemetry: TELEMETRY,
          idempotencyKeyRef: second,
        }),
        second,
        NEXT_KEY,
      ),
    ]
    await settleTicks()
    inFlight.reject(lostResponse())
    const [firstResult, secondResult] = await Promise.all(sends)

    expect(firstResult.status).toBe(PaymentSendResult.Failure)
    expect(secondResult.status).toBe(PaymentSendResult.Success)
    expect(
      lookupMatches(1, {
        details: { tag: "Lightning", inner: { htlcDetails: { paymentHash: "hash-a" } } },
      }),
    ).toBe(true)
    expect(mockPrepareSendPayment).toHaveBeenCalledTimes(1)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
    expect(lostAttemptsTo("lnbc1...")).toEqual({})
  })

  /** A dollar send whose outcome is lost leaves the address refused; a bitcoin send
   *  that was waiting behind it is refused too, rather than replacing that refusal with
   *  one of its own. */
  it("refuse the send waiting behind one whose outcome is lost", async () => {
    const inFlight = deferred()
    mockPrepareSendPayment
      .mockResolvedValueOnce(sparkAddress("usdb-token-id"))
      .mockResolvedValue(sparkAddress())
    mockSendPayment.mockImplementationOnce(() => inFlight.promise)
    const dollars = {}
    const bitcoin = {}

    const sends = [
      attempt(
        createSendMutation(usdSpark, {
          telemetry: TELEMETRY,
          idempotencyKeyRef: dollars,
        }),
        dollars,
      ),
      attempt(
        createSendMutation(btcSpark, {
          telemetry: TELEMETRY,
          idempotencyKeyRef: bitcoin,
        }),
        bitcoin,
        NEXT_KEY,
      ),
    ]
    await settleTicks()
    inFlight.reject(lostResponse())
    const [dollarResult, bitcoinResult] = await Promise.all(sends)

    expect(dollarResult.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(bitcoinResult.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
    expect(lostAttemptsTo("sp1abc").unresolvedSend?.idempotencyKey).toBeUndefined()
  })

  it("leave a send to another destination alone", async () => {
    const inFlight = deferred()
    mockPrepareSendPayment.mockResolvedValue(withConversion(bolt11("hash-a")))
    mockSendPayment
      .mockImplementationOnce(() => inFlight.promise)
      .mockResolvedValue(sent())
    const first = {}
    const elsewhere = { ...usdLightning, paymentRequest: "lnbc2..." }
    const other = {}

    const waiting = attempt(
      createSendMutation(usdLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: first,
      }),
      first,
    )
    const result = await attempt(
      createSendMutation(elsewhere, { telemetry: TELEMETRY, idempotencyKeyRef: other }),
      other,
      NEXT_KEY,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    inFlight.resolve(sent())
    await waiting
  })
})

describe("a send that finishes after a switch of wallet", () => {
  it("leaves its lost attempt with its own wallet, not the next one", async () => {
    let throwLate: (err: unknown) => void = () => undefined
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            throwLate = reject
          }),
      )
      .mockResolvedValue(sent())
    scopeLostAttemptsTo("wallet-a", noStoredAttempts)
    const first = {}
    const late = attempt(
      createSendMutation(usdSpark, { telemetry: TELEMETRY, idempotencyKeyRef: first }),
      first,
    )
    await new Promise(setImmediate)

    scopeLostAttemptsTo("wallet-b", noStoredAttempts)
    throwLate(lostResponse())
    await late
    const second = {}
    const result = await attempt(
      createSendMutation(usdSpark, { telemetry: TELEMETRY, idempotencyKeyRef: second }),
      second,
      NEXT_KEY,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(2)
  })
})

describe("a same-key retry whose quote fails", () => {
  /** The lost attempt went out and spent the funds, so the fresh quote is refused: the
   *  retry looks for that attempt rather than reporting the quote's failure. */
  const retryAfterSpentFunds = async () => {
    mockPrepareSendPayment
      .mockResolvedValueOnce(bolt11("hash-1"))
      .mockRejectedValueOnce(sdkError("InsufficientFunds"))
    mockSendPayment.mockRejectedValueOnce(lostResponse())
    const ref = {}
    const send = createSendMutation(btcLightning, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })
    await attempt(send, ref)
    return attempt(send, ref)
  }

  it("reports the lost attempt's payment when the wallet holds it", async () => {
    mockFindLostSend.mockResolvedValue({
      status: "found",
      payment: { id: "p1" },
      failed: [],
    })

    const retry = await retryAfterSpentFunds()

    expect(retry.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
    expect(lostAttemptsTo("lnbc1...")).toEqual({})
  })

  it("reports the quote's failure when the wallet shows nothing", async () => {
    mockFindLostSend.mockResolvedValue({ status: "not-found", failed: [] })

    const retry = await retryAfterSpentFunds()

    expect(retry.errors?.[0].message).toBe(SelfCustodialErrorCode.InsufficientFunds)
    expect(mockFindLostSend).toHaveBeenCalledTimes(1)
    expect(lostAttemptsTo("lnbc1...").lostSend?.paymentHashes).toEqual(["hash-1"])
  })

  it("reports the quote's failure when an unresolved attempt's history cannot be read, keeping it", async () => {
    mockPrepareSendPayment
      .mockResolvedValueOnce(sparkAddress())
      .mockRejectedValueOnce(sdkError("InsufficientFunds"))
    mockSendPayment.mockRejectedValueOnce(lostResponse())
    mockFindPaymentUnderKey.mockResolvedValueOnce({
      status: "unreadable",
      error: new Error("offline"),
    })
    const ref = {}
    const send = createSendMutation(btcSpark, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    await attempt(send, ref)
    const retry = await attempt(send, ref)

    expect(retry.errors?.[0].message).toBe(SelfCustodialErrorCode.InsufficientFunds)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
    expect(lostAttemptsTo("sp1abc").unresolvedSend?.idempotencyKey).toBe(KEY)
  })

  /** Nothing goes out either way: the quote's failure is what the sender can act on. */
  it("reports the quote's failure when the wallet's history cannot be read, keeping the attempt", async () => {
    mockFindLostSend.mockResolvedValue({
      status: "unreadable",
      error: new Error("offline"),
    })

    const retry = await retryAfterSpentFunds()

    expect(retry.errors?.[0].message).toBe(SelfCustodialErrorCode.InsufficientFunds)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
    expect(lostAttemptsTo("lnbc1...").lostSend?.paymentHashes).toEqual(["hash-1"])
  })
})

describe("a bitcoin Spark-address send that throws again under the same key", () => {
  it("stays unresolved under that key, retried without a look", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockRejectedValue(lostResponse())
    const ref = {}
    const send = createSendMutation(btcSpark, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    await attempt(send, ref)
    await attempt(send, ref)

    expect(sentKeys()).toEqual([KEY, KEY])
    expect(mockFindPaymentUnderKey).not.toHaveBeenCalled()
    expect(lostAttemptsTo("sp1abc").unresolvedSend).toEqual({
      idempotencyKey: KEY,
      recordedAtMs: expect.any(Number),
    })
  })
})

describe("the same send asked for twice before the first is done", () => {
  /** A double tap the screen did not stop in time: the repeat carries the same key, and
   *  joins the send still in flight instead of going out again. The first coming back
   *  failed starts the shared key over, and the repeat answers with that same failure. */
  it("joins the send in flight and answers with its outcome", async () => {
    let failFirst: (value: unknown) => void = () => undefined
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          failFirst = resolve
        }),
    )
    const ref = { current: KEY }
    const send = createSendMutation(btcLightning, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    const first = send()
    const repeat = send()
    await new Promise(setImmediate)
    failFirst(sent(FAILED))
    const [firstResult, repeatResult] = await Promise.all([first, repeat])

    expect(sentKeys()).toEqual([KEY])
    expect(firstResult.status).toBe(PaymentSendResult.Failure)
    expect(repeatResult).toBe(firstResult)
    expect(ref.current).toBeUndefined()
  })

  it("pays a dollar send once when it is asked for twice, though it carries no key", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockResolvedValue(sent())
    const ref = { current: KEY }
    const send = createSendMutation(usdSpark, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    const [first, repeat] = await Promise.all([send(), send()])

    expect(mockSendPayment).toHaveBeenCalledTimes(1)
    expect(first.status).toBe(PaymentSendResult.Success)
    expect(repeat).toBe(first)
  })

  it("queues a send under another key behind the one in flight, and sends it too", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockResolvedValue(sent())
    const firstRef = { current: KEY }
    const secondRef = { current: NEXT_KEY }

    await Promise.all([
      createSendMutation(btcSpark, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: firstRef,
      })(),
      createSendMutation(btcSpark, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: secondRef,
      })(),
    ])

    expect(sentKeys()).toEqual([KEY, NEXT_KEY])
  })

  it("sends again once the first is done: only a send still in flight is joined", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockResolvedValue(sent())
    const ref = { current: KEY }
    const send = createSendMutation(usdSpark, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    await send()
    await send()

    expect(mockSendPayment).toHaveBeenCalledTimes(2)
  })
})

describe("the lost attempts of a send, against a phone clock that is off", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  const usdLost = async () => {
    mockPrepareSendPayment.mockResolvedValue(
      bolt11("hash-1", { conversionEstimate: { amountIn: 1n } }),
    )
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({ status: "not-found", failed: [] })
    const ref = {}
    await attempt(
      createSendMutation(usdLightning, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )
  }

  /** The wallet's newest send, stamped by the server's clock, goes with the attempt: the
   *  look reaches back from it however far ahead the phone's clock is. */
  it("keeps the wallet's own clock, read as the attempt is lost", async () => {
    mockListPayments.mockResolvedValue({ payments: [{ id: "p0", timestamp: 1_000n }] })

    await usdLost()

    expect(mockListPayments).toHaveBeenCalledWith(
      expect.objectContaining({ typeFilter: [0], limit: 1, sortAscending: false }),
    )
    expect(mockFindLostSend.mock.calls[0][0].walletClockSec).toBe(1_000)
    expect(lostAttemptsTo("lnbc1...").lostSend?.walletClockSec).toBe(1_000)
  })

  it("reaches back to the start of the history when the wallet holds no send", async () => {
    mockListPayments.mockResolvedValue({ payments: [] })

    await usdLost()

    expect(lostAttemptsTo("lnbc1...").lostSend?.walletClockSec).toBe(0)
  })

  it("reaches back to the start of the history when the wallet cannot be read", async () => {
    mockListPayments.mockRejectedValue(new Error("storage"))

    await usdLost()

    expect(lostAttemptsTo("lnbc1...").lostSend?.walletClockSec).toBe(0)
  })

  /** Not a send left pending for good, with nothing recorded: the attempt is kept, to be
   *  looked for over the whole history. */
  it("reaches back to the start of the history when the wallet's clock does not answer", async () => {
    jest.useFakeTimers()
    mockListPayments.mockReturnValueOnce(
      new Promise(() => {
        /** never answers */
      }),
    )

    const lost = usdLost()
    await jest.advanceTimersByTimeAsync(15_000)
    await lost

    expect(mockFindLostSend.mock.calls[0][0].walletClockSec).toBe(0)
    expect(lostAttemptsTo("lnbc1...").lostSend?.walletClockSec).toBe(0)
  })

  it("keeps the earliest clock across attempts", async () => {
    mockListPayments
      .mockResolvedValueOnce({ payments: [{ id: "p0", timestamp: 1_000n }] })
      .mockResolvedValueOnce({ payments: [{ id: "p0", timestamp: 5_000n }] })

    await usdLost()
    await usdLost()

    expect(lostAttemptsTo("lnbc1...").lostSend?.walletClockSec).toBe(1_000)
  })
})

/** Each case below sets every answer it relies on: none is left over from another. */
const resetSendMocks = () =>
  [
    mockPrepareSendPayment,
    mockSendPayment,
    mockFindLostSend,
    mockFindPaymentUnderKey,
    mockListPayments,
  ].forEach((mock) => mock.mockReset())

/** A payment in the wallet's history, found by the invoice hash `hash` when given. */
const heldPayment = (id: string, amount: bigint, hash?: string) => ({
  id,
  status: COMPLETED,
  amount,
  details: hash
    ? { tag: "Lightning", inner: { htlcDetails: { paymentHash: hash } } }
    : { tag: "Spark", inner: {} },
})

/** What a sender asked a send for: entered as `entered`, leaving the wallet as
 *  `settlement` (the same, unless given). */
const asked = (entered: string, settlement = entered): RequestedAs => ({
  entered,
  settlement,
})

describe("a lost attempt found by a send asked for another amount", () => {
  beforeEach(resetSendMocks)

  /** Lost under KEY, asked for `first`; then confirmed under NEXT_KEY, asked for `second`. */
  const sendAgain = async (
    first: RequestedAs | undefined,
    second: RequestedAs,
    paidSats = BigInt(1000),
  ) => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValue(sent())
    mockFindPaymentUnderKey.mockResolvedValue({
      status: "found",
      payment: heldPayment(KEY, paidSats),
      failed: [],
    })
    const ref = {}
    await attempt(
      createSendMutation(btcSpark, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: ref,
        requestedAs: first,
      }),
      ref,
    )

    const rebuilt = {}
    const send = createSendMutation(btcSpark, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: rebuilt,
      requestedAs: second,
    })
    return { result: await attempt(send, rebuilt, NEXT_KEY), send, rebuilt }
  }

  it("is reported as the earlier payment it is, and nothing is sent", async () => {
    const { result } = await sendAgain(asked("BTC:1000"), asked("BTC:5000"))

    expect(result.status).toBe(PaymentSendResult.Failure)
    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.EarlierPaymentFound)
    expect(result.extraInfo?.earlierPaymentId).toBe(KEY)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("sends the new amount once the sender confirms again", async () => {
    const { send, rebuilt } = await sendAgain(asked("BTC:1000"), asked("BTC:5000"))
    const confirmedAgain = await attempt(send, rebuilt)

    expect(confirmedAgain.status).toBe(PaymentSendResult.Success)
    expect(sentKeys()).toEqual([KEY, NEXT_KEY])
    expect(lostAttemptsTo("sp1abc")).toEqual({})
  })

  it("is reported as the send itself when it was asked for the same amount", async () => {
    const { result } = await sendAgain(asked("BTC:1000"), asked("BTC:1000"))

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  /** The same $5 entered again later, at a price that moved: other sats, one payment. */
  it("is reported as the send itself when the same fiat amount came out other sats", async () => {
    const { result } = await sendAgain(
      asked("USD:500", "BTC:6600"),
      asked("USD:500", "BTC:6700"),
      BigInt(6700),
    )

    expect(result.status).toBe(PaymentSendResult.Success)
  })

  /** $3.50 entered first, then the same 5000 sats entered in bitcoin: one payment. */
  it("is reported as the send itself when the same payment was entered in another unit", async () => {
    const { result } = await sendAgain(
      asked("USD:350", "BTC:5000"),
      asked("BTC:5000", "BTC:5000"),
      BigInt(5000),
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("is told apart however small the change the sender made on purpose", async () => {
    const { result } = await sendAgain(asked("BTC:100000"), asked("BTC:100100"))

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.EarlierPaymentFound)
  })

  it("is taken for the send when the earlier attempt's request is not known", async () => {
    const { result } = await sendAgain(undefined, asked("BTC:5000"))

    expect(result.status).toBe(PaymentSendResult.Success)
  })

  it("is not compared when the destination fixes the amount", async () => {
    mockPrepareSendPayment.mockResolvedValue(
      bolt11("hash-1", { conversionEstimate: { amountIn: 1n } }),
    )
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce({
        status: "found",
        payment: heldPayment("p-earlier", BigInt(777), "hash-1"),
        failed: [],
      })
    const ref = {}
    const usdFixedInvoice = createSendMutation(usdLightning, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: ref,
    })

    await attempt(usdFixedInvoice, ref)
    const retry = await attempt(usdFixedInvoice, ref)

    expect(retry.status).toBe(PaymentSendResult.Success)
  })

  /** Two dollar attempts lost, asked for 100 and 200, each by its own invoice. */
  const usdQuote = (hash: string) =>
    bolt11(hash, { conversionEstimate: { amountIn: 1n } })
  const lostUsdAttempt = (entered: string, hash: string) => {
    mockPrepareSendPayment.mockResolvedValueOnce(usdQuote(hash))
    const ref = {}
    return attempt(
      createSendMutation(usdLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: ref,
        requestedAs: asked(entered),
      }),
      ref,
    )
  }

  it("is told apart when a retry's lookup finds the earlier attempt's payment", async () => {
    mockSendPayment.mockRejectedValueOnce(lostResponse())
    mockFindLostSend
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
      .mockResolvedValueOnce({
        status: "found",
        payment: heldPayment("p-earlier", BigInt(1000), "hash-a"),
        failed: [],
      })
    await lostUsdAttempt("USD:1000", "hash-a")

    const rebuilt = {}
    mockPrepareSendPayment.mockResolvedValueOnce(usdQuote("hash-b"))
    const result = await attempt(
      createSendMutation(usdLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: rebuilt,
        requestedAs: asked("USD:2000"),
      }),
      rebuilt,
      NEXT_KEY,
    )

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.EarlierPaymentFound)
    expect(result.extraInfo?.earlierPaymentId).toBe("p-earlier")
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("settles only the attempt that paid, keeping every other one to look for", async () => {
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({ status: "not-found", failed: [] })
    await lostUsdAttempt("USD:100", "hash-a")
    await lostUsdAttempt("USD:200", "hash-b")
    expect(lostAttemptsTo("lnbc1...").lostSend?.paymentHashes).toEqual([
      "hash-a",
      "hash-b",
    ])

    mockFindLostSend.mockResolvedValue({
      status: "found",
      payment: heldPayment("p-a", BigInt(100), "hash-a"),
      failed: [],
    })
    mockPrepareSendPayment.mockResolvedValueOnce(usdQuote("hash-c"))
    const ref = {}
    const result = await attempt(
      createSendMutation(usdLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: ref,
        requestedAs: asked("USD:200"),
      }),
      ref,
      NEXT_KEY,
    )

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.EarlierPaymentFound)
    expect(lostAttemptsTo("lnbc1...").lostSend?.paymentHashes).toEqual(["hash-b"])
    expect(lostAttemptsTo("lnbc1...").lostSend?.requestedAs).toEqual({
      "hash:hash-b": asked("USD:200"),
    })
  })

  it("keeps every attempt asked for another amount when it finds this send's payment", async () => {
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({ status: "not-found", failed: [] })
    await lostUsdAttempt("USD:100", "hash-a")
    await lostUsdAttempt("USD:200", "hash-b")

    mockFindLostSend.mockResolvedValue({
      status: "found",
      payment: heldPayment("p-b", BigInt(200), "hash-b"),
      failed: [],
    })
    mockPrepareSendPayment.mockResolvedValueOnce(usdQuote("hash-c"))
    const ref = {}
    const result = await attempt(
      createSendMutation(usdLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: ref,
        requestedAs: asked("USD:200"),
      }),
      ref,
      NEXT_KEY,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(lostAttemptsTo("lnbc1...").lostSend?.paymentHashes).toEqual(["hash-a"])
    expect(lostAttemptsTo("lnbc1...").lostSend?.requestedAs).toEqual({
      "hash:hash-a": asked("USD:100"),
    })
  })

  it("settles a lost Spark invoice attempt with the payment found for this send", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkInvoice("spark1inv", "usdb-token-id"))
    mockSendPayment.mockRejectedValue(lostResponse())
    const usdInvoiceSend = () => {
      const ref = {}
      return attempt(
        createSendMutation(usdSpark, {
          telemetry: TELEMETRY,
          idempotencyKeyRef: ref,
          requestedAs: asked("USD:500"),
        }),
        ref,
      )
    }
    mockFindLostSend.mockResolvedValueOnce({ status: "not-found", failed: [] })
    await usdInvoiceSend()

    mockFindLostSend.mockResolvedValueOnce({
      status: "found",
      payment: {
        id: "p-inv",
        status: COMPLETED,
        amount: BigInt(500),
        details: { tag: "Token", inner: { invoiceDetails: { invoice: "spark1inv" } } },
      },
      failed: [],
    })
    const retry = await usdInvoiceSend()

    expect(retry.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
    expect(lostAttemptsTo("sp1abc")).toEqual({})
  })

  it("tells the sender a send that threw may have gone through, when its lookup finds an earlier attempt's payment", async () => {
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValueOnce({ status: "not-found", failed: [] })
    await lostUsdAttempt("USD:1000", "hash-a")

    mockFindLostSend.mockResolvedValueOnce({ status: "not-found", failed: [] })
    mockFindLostSend.mockResolvedValueOnce({
      status: "found",
      payment: heldPayment("p-a", BigInt(1000), "hash-a"),
      failed: [],
    })
    mockPrepareSendPayment.mockResolvedValueOnce(usdQuote("hash-b"))
    const ref = {}
    const result = await attempt(
      createSendMutation(usdLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: ref,
        requestedAs: asked("USD:2000"),
      }),
      ref,
      NEXT_KEY,
    )

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(result.extraInfo).toEqual({ checkHistory: true, sendAnyway: undefined })
    expect(lostAttemptsTo("lnbc1...").lostSend?.paymentHashes).toEqual(["hash-b"])
  })

  it("reports the send when the send that threw finds another attempt's payment for the same amount, and keeps this one to look for", async () => {
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValueOnce({ status: "not-found", failed: [] })
    await lostUsdAttempt("USD:1000", "hash-a")

    mockFindLostSend.mockResolvedValueOnce({ status: "not-found", failed: [] })
    mockFindLostSend.mockResolvedValueOnce({
      status: "found",
      payment: heldPayment("p-a", BigInt(1000), "hash-a"),
      failed: [],
    })
    mockPrepareSendPayment.mockResolvedValueOnce(usdQuote("hash-b"))
    const ref = {}
    const result = await attempt(
      createSendMutation(usdLightning, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: ref,
        requestedAs: asked("USD:1000"),
      }),
      ref,
      NEXT_KEY,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(lostAttemptsTo("lnbc1...").lostSend?.paymentHashes).toEqual(["hash-b"])
  })

  it("reports the send itself when the send that threw finds its own payment", async () => {
    mockPrepareSendPayment.mockResolvedValue(usdQuote("hash-a"))
    mockSendPayment.mockRejectedValue(lostResponse())
    mockFindLostSend.mockResolvedValue({
      status: "found",
      payment: heldPayment("p-a", BigInt(1000), "hash-a"),
      failed: [],
    })

    const result = await lostUsdAttempt("USD:1000", "hash-a")

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(lostAttemptsTo("lnbc1...")).toEqual({})
  })
})

describe("a send asked for before the wallet's stored attempts were read back", () => {
  beforeEach(resetSendMocks)
  afterEach(() => {
    jest.useRealTimers()
  })

  /** Nothing is known lost: the sender is asked to try again in a moment, not told a
   *  payment may have gone through. */
  it("is refused, sending nothing, while that read has not answered", async () => {
    jest.useFakeTimers()
    scopeLostAttemptsTo(`wallet-slow-read-${(connectedWallets += 1)}`, {
      load: () =>
        new Promise(() => {
          /** never answers */
        }),
      save: async () => undefined,
      remove: async () => undefined,
    })
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockResolvedValue(sent())
    const ref = {}

    const pending = attempt(
      createSendMutation(btcSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )
    await jest.advanceTimersByTimeAsync(STORED_ATTEMPTS_READ_TIMEOUT_MS)
    const result = await pending

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.Generic)
    expect(mockSendPayment).not.toHaveBeenCalled()
  })

  /** A read that failed is no proof nothing was lost: storage may hold this very send,
   *  paid already. */
  it("is refused, sending nothing, when that read failed and fails again", async () => {
    const load = jest.fn().mockRejectedValue(new Error("io"))
    scopeLostAttemptsTo(`wallet-failed-read-${(connectedWallets += 1)}`, {
      load,
      save: async () => undefined,
      remove: async () => undefined,
    })
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockResolvedValue(sent())
    const ref = {}

    const result = await attempt(
      createSendMutation(btcSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.Generic)
    expect(mockSendPayment).not.toHaveBeenCalled()
    expect(load).toHaveBeenCalledTimes(4)
  })

  it("reads them again when that read failed, and goes on with what it reads back", async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error("io"))
      .mockRejectedValueOnce(new Error("io"))
      .mockResolvedValue(
        new Map([["sp1abc", { unresolvedSend: { idempotencyKey: undefined } }]]),
      )
    scopeLostAttemptsTo(`wallet-failed-read-${(connectedWallets += 1)}`, {
      load,
      save: async () => undefined,
      remove: async () => undefined,
    })
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockResolvedValue(sent())
    const ref = {}

    const result = await attempt(
      createSendMutation(btcSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(mockSendPayment).not.toHaveBeenCalled()
    expect(load).toHaveBeenCalledTimes(3)
  })
})

describe("sending anyway after an outcome that could not be checked", () => {
  beforeEach(resetSendMocks)

  const usdSparkSend = () => {
    const ref = {}
    return attempt(
      createSendMutation(usdSpark, {
        telemetry: TELEMETRY,
        idempotencyKeyRef: ref,
        requestedAs: asked("USD:500"),
      }),
      ref,
    )
  }

  /** Not on the attempt that just threw: the history cannot show it yet. */
  it("is not offered on the attempt that just threw", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockRejectedValue(lostResponse())

    const result = await usdSparkSend()

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(result.extraInfo).toEqual({ checkHistory: true, sendAnyway: undefined })
    expect(lostAttemptsTo("sp1abc").unresolvedSend?.requestedAs).toEqual(asked("USD:500"))
  })

  it("is offered on the next try, and sends once the sender chose to", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValue(sent())

    await usdSparkSend()
    const refused = await usdSparkSend()
    refused.extraInfo?.sendAnyway?.()
    const again = await usdSparkSend()

    expect(refused.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(refused.extraInfo?.sendAnyway).toEqual(expect.any(Function))
    expect(again.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledTimes(2)
    expect(lostAttemptsTo("sp1abc")).toEqual({})
  })

  it("keeps the attempt until the send in its place goes out", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockRejectedValueOnce(lostResponse())

    await usdSparkSend()
    const refused = await usdSparkSend()
    refused.extraInfo?.sendAnyway?.()

    expect(lostAttemptsTo("sp1abc").unresolvedSend?.requestedAs).toEqual(asked("USD:500"))
  })

  it("asks again when the send in its place cannot be quoted", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockRejectedValueOnce(lostResponse())

    await usdSparkSend()
    const refused = await usdSparkSend()
    refused.extraInfo?.sendAnyway?.()
    mockPrepareSendPayment.mockRejectedValueOnce(sdkError("NetworkError"))
    await usdSparkSend()
    const next = await usdSparkSend()

    expect(next.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(next.extraInfo?.sendAnyway).toEqual(expect.any(Function))
    expect(mockSendPayment).toHaveBeenCalledTimes(1)
  })

  it("asks again when the SDK refuses the send in its place on the way in", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment
      .mockRejectedValueOnce(lostResponse())
      .mockRejectedValueOnce(sdkError("InsufficientFunds"))

    await usdSparkSend()
    const refused = await usdSparkSend()
    refused.extraInfo?.sendAnyway?.()
    const replacement = await usdSparkSend()
    const next = await usdSparkSend()

    expect(replacement.errors?.[0].message).toBe(SelfCustodialErrorCode.InsufficientFunds)
    expect(next.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(mockSendPayment).toHaveBeenCalledTimes(2)
  })

  it("releases only the attempt it was offered for, not one recorded since", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockRejectedValue(lostResponse())

    await usdSparkSend()
    const refused = await usdSparkSend()
    refused.extraInfo?.sendAnyway?.()
    await usdSparkSend()
    refused.extraInfo?.sendAnyway?.()
    const next = await usdSparkSend()

    expect(next.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(mockSendPayment).toHaveBeenCalledTimes(2)
  })

  it("does not offer it while a keyed attempt's history cannot be read, and asks again next time", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress())
    mockSendPayment.mockRejectedValueOnce(lostResponse()).mockResolvedValue(sent())
    mockFindPaymentUnderKey
      .mockResolvedValueOnce({ status: "unreadable", error: new Error("io") })
      .mockResolvedValueOnce({ status: "not-found", failed: [] })
    const ref = {}
    await attempt(
      createSendMutation(btcSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    const rebuilt = {}
    const send = createSendMutation(btcSpark, {
      telemetry: TELEMETRY,
      idempotencyKeyRef: rebuilt,
    })
    const refused = await attempt(send, rebuilt, NEXT_KEY)
    const again = await attempt(send, rebuilt)

    expect(refused.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(refused.extraInfo).toEqual({ checkHistory: true, sendAnyway: undefined })
    expect(mockFindPaymentUnderKey).toHaveBeenCalledTimes(2)
    expect(again.status).toBe(PaymentSendResult.Success)
    expect(sentKeys()).toEqual([KEY, NEXT_KEY])
  })
})

describe("what is done with the SDK's answer, once the send went out", () => {
  beforeEach(resetSendMocks)

  it("reports a send whose answer came without a payment as sent, not as lost", async () => {
    mockPrepareSendPayment.mockResolvedValue(bolt11("hash-1"))
    mockSendPayment.mockResolvedValue({})
    const ref = {}

    const result = await attempt(
      createSendMutation(btcLightning, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(lostAttemptsTo("lnbc1...")).toEqual({})
  })

  it("reports a send as sent when reporting it throws, and never keeps it as lost", async () => {
    const outcome = await runSelfCustodialSend({
      sdk: mockSdk,
      idempotencyKeyRef: { current: KEY },
      destination: "lnurl-destination",
      telemetry: {
        params: { rail: "lnurl_pay", sending_wallet: WalletCurrency.Btc },
        settlement: { settled: [], failed: { event: "sc_payment_send_failed" } },
      },
      prepare: async () => bolt11("hash-5"),
      identify: identifyPreparedSend,
      execute: async () => ({}),
      sentOutcome: (result) => ({
        status: PaymentSendResult.Success,
        transaction: { createdAt: Number(result.payment.timestamp) },
      }),
      foundOutcome: () => ({ status: PaymentSendResult.Success }),
      failure: () => ({ status: PaymentSendResult.Failure }),
    })

    expect(outcome).toEqual({ status: PaymentSendResult.Success })
    expect(reportError).toHaveBeenCalledWith(
      "Self-custodial sent outcome",
      expect.any(TypeError),
    )
    expect(lostAttemptsTo("lnurl-destination")).toEqual({})
  })

  it("reports a send as sent when the bookkeeping after it throws", async () => {
    const bookkeeping = jest
      .spyOn(measurement, "measureSettlement")
      .mockImplementationOnce(() => {
        throw new Error("telemetry down")
      })
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockResolvedValue(sent())
    const ref = {}

    const result = await attempt(
      createSendMutation(usdSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(reportError).toHaveBeenCalledWith(
      "Self-custodial send bookkeeping",
      expect.any(Error),
    )
    expect(lostAttemptsTo("sp1abc")).toEqual({})
    bookkeeping.mockRestore()
  })

  it("still treats an SDK call that throws on the spot as a send that may have gone out", async () => {
    mockPrepareSendPayment.mockResolvedValue(sparkAddress("usdb-token-id"))
    mockSendPayment.mockImplementation(() => {
      throw lostResponse()
    })
    const ref = {}

    const result = await attempt(
      createSendMutation(usdSpark, { telemetry: TELEMETRY, idempotencyKeyRef: ref }),
      ref,
    )

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.OutcomeUnknown)
    expect(lostAttemptsTo("sp1abc").unresolvedSend).toBeDefined()
  })
})
