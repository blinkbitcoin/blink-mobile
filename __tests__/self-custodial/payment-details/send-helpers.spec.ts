/* eslint-disable camelcase */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — GetFee<T> type expects GQL fee probe params that self-custodial doesn't use
import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"

import {
  createGetFee,
  createGetFeeOnchain,
  createSendMutation,
  createSendMutationOnchain,
} from "@app/self-custodial/payment-details/send-helpers"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

const mockPrepareSendPayment = jest.fn()
const mockSendPayment = jest.fn()

jest.mock("@breeztech/breez-sdk-spark-react-native", () => {
  const tags = {
    SparkError: "SparkError",
    InsufficientFunds: "InsufficientFunds",
    InvalidUuid: "InvalidUuid",
    InvalidInput: "InvalidInput",
    NetworkError: "NetworkError",
    StorageError: "StorageError",
    ChainServiceError: "ChainServiceError",
    MaxDepositClaimFeeExceeded: "MaxDepositClaimFeeExceeded",
    MissingUtxo: "MissingUtxo",
    LnurlError: "LnurlError",
    Signer: "Signer",
    Generic: "Generic",
  }
  return {
    BitcoinNetwork: { Bitcoin: 0, Regtest: 4 },
    InputType_Tags: { SparkAddress: "SparkAddress" },
    Network: { Mainnet: 0, Regtest: 1 },
    SendPaymentMethod_Tags: {
      BitcoinAddress: "BitcoinAddress",
      Bolt11Invoice: "Bolt11Invoice",
    },
    OnchainConfirmationSpeed: { Fast: 0, Medium: 1, Slow: 2 },
    Seed: { Mnemonic: jest.fn().mockImplementation((args: unknown) => args) },
    StableBalanceActiveLabel: {
      Set: jest.fn().mockImplementation((args: unknown) => ({ tag: "Set", inner: args })),
    },
    SendPaymentOptions: {
      BitcoinAddress: jest.fn().mockImplementation((args: unknown) => args),
      Bolt11Invoice: jest.fn().mockImplementation((args: unknown) => args),
    },
    connect: jest.fn(),
    defaultConfig: jest.fn().mockReturnValue({}),
    initLogging: jest.fn(),
    PrepareSendPaymentRequest: {
      create: jest.fn((args: Record<string, unknown>) => args),
    },
    SendPaymentRequest: {
      create: jest.fn((args: Record<string, unknown>) => args),
    },
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

jest.mock("@app/screens/send-bitcoin-screen/fee-tier-selector", () => ({
  FeeTierOption: { Fast: "fast", Medium: "medium", Slow: "slow" },
}))

const mockSdk = {
  prepareSendPayment: (...args: unknown[]) => mockPrepareSendPayment(...args),
  sendPayment: (...args: unknown[]) => mockSendPayment(...args),
} as never

const sdkError = (tag: string, inner?: readonly [string]) => ({ tag, inner })

describe("createGetFee", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns the Spark transfer fee in sats when both routes are available", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: {
        tag: "Bolt11Invoice",
        inner: {
          lightningFeeSats: BigInt(10),
          sparkTransferFeeSats: BigInt(5),
        },
      },
    })

    const getFee = createGetFee({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
    })
    const result = await getFee()

    expect(result.amount?.amount).toBe(5)
    expect(result.amount?.currency).toBe(WalletCurrency.Btc)
  })

  it("falls back to the Lightning fee when there is no Spark route", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: {
        tag: "Bolt11Invoice",
        inner: {
          lightningFeeSats: BigInt(10),
          sparkTransferFeeSats: undefined,
        },
      },
    })

    const getFee = createGetFee({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
    })
    const result = await getFee()

    expect(result.amount?.amount).toBe(10)
  })

  it("reports zero fee for Spark-address sends (no user-visible fee)", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: { tag: "SparkAddress", inner: {} },
    })

    const getFee = createGetFee({
      sdk: mockSdk,
      paymentRequest: "sp1...",
      amount: undefined,
    })
    const result = await getFee()

    expect(result.amount?.amount).toBe(0)
  })

  it("returns undefined amount when prepare fails", async () => {
    mockPrepareSendPayment.mockRejectedValue(new Error("fail"))

    const getFee = createGetFee({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
    })
    const result = await getFee()

    expect(result.amount).toBeUndefined()
  })

  it("forwards amount and tokenIdentifier on the prepare call", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: { tag: "Bolt11Invoice", inner: {} },
    })

    const getFee = createGetFee({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: BigInt(1000),
      tokenIdentifier: "usdb-token-id",
    })
    await getFee()

    expect(mockPrepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: BigInt(1000),
        tokenIdentifier: "usdb-token-id",
      }),
    )
  })

  it("forwards conversionOptions on the prepare call (USDB→BTC Lightning)", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: { tag: "Bolt11Invoice", inner: {} },
    })
    const conversionOptions = {
      conversionType: { tag: "ToBitcoin", inner: { fromTokenIdentifier: "usdb" } },
      maxSlippageBps: undefined,
      completionTimeoutSecs: undefined,
    } as never

    const getFee = createGetFee({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
      conversionOptions,
    })
    await getFee()

    expect(mockPrepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ conversionOptions }),
    )
  })
})

describe("createGetFeeOnchain", () => {
  const onchainPrepared = {
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
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns the Medium tier total for medium tier requests", async () => {
    mockPrepareSendPayment.mockResolvedValue(onchainPrepared)

    const getFee = createGetFeeOnchain(
      { sdk: mockSdk, paymentRequest: "bc1q...", amount: BigInt(50000) },
      "medium",
    )
    const result = await getFee()

    expect(result.amount?.amount).toBe(400)
    expect(result.amount?.currency).toBe(WalletCurrency.Btc)
  })

  it("returns the Fast tier total for fast tier requests", async () => {
    mockPrepareSendPayment.mockResolvedValue(onchainPrepared)

    const getFee = createGetFeeOnchain(
      { sdk: mockSdk, paymentRequest: "bc1q...", amount: BigInt(50000) },
      "fast",
    )
    const result = await getFee()

    expect(result.amount?.amount).toBe(800)
  })

  it("returns undefined amount when prepare fails", async () => {
    mockPrepareSendPayment.mockRejectedValue(new Error("fail"))

    const getFee = createGetFeeOnchain(
      { sdk: mockSdk, paymentRequest: "bc1q...", amount: BigInt(50000) },
      "fast",
    )
    const result = await getFee()

    expect(result.amount).toBeUndefined()
  })
})

describe("createSendMutation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns success on a successful send", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: { tag: "Bolt11Invoice", inner: {} },
    })
    mockSendPayment.mockResolvedValue(undefined)

    const send = createSendMutation({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
    })
    const result = await send()

    expect(result.status).toBe(PaymentSendResult.Success)
  })

  it("classifies a thrown SdkError(InsufficientFunds) into the InsufficientFunds code", async () => {
    mockPrepareSendPayment.mockRejectedValue(sdkError("InsufficientFunds"))

    const send = createSendMutation({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
    })
    const result = await send()

    expect(result.status).toBe(PaymentSendResult.Failure)
    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.InsufficientFunds)
  })

  it("classifies a wrapped Generic('insufficient funds') as InsufficientFunds", async () => {
    mockPrepareSendPayment.mockRejectedValue(
      sdkError("Generic", [
        "Wallet: Service error: token output service error: insufficient funds",
      ]),
    )

    const send = createSendMutation({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
    })
    const result = await send()

    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.InsufficientFunds)
  })

  it("classifies a non-SdkError thrown value as Generic", async () => {
    mockPrepareSendPayment.mockRejectedValue(new Error("boom"))

    const send = createSendMutation({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
    })
    const result = await send()

    expect(result.status).toBe(PaymentSendResult.Failure)
    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.Generic)
  })

  it("forwards tokenIdentifier on the prepare call", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: { tag: "Bolt11Invoice", inner: {} },
    })
    mockSendPayment.mockResolvedValue(undefined)

    const send = createSendMutation({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: BigInt(1500),
      tokenIdentifier: "usdb-token-id",
    })
    await send()

    expect(mockPrepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: "usdb-token-id" }),
    )
  })

  it("forwards conversionOptions on the prepare call (USDB→BTC Lightning)", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: { tag: "Bolt11Invoice", inner: {} },
    })
    mockSendPayment.mockResolvedValue(undefined)
    const conversionOptions = {
      conversionType: { tag: "ToBitcoin", inner: { fromTokenIdentifier: "usdb" } },
      maxSlippageBps: undefined,
      completionTimeoutSecs: undefined,
    } as never

    const send = createSendMutation({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
      conversionOptions,
    })
    await send()

    expect(mockPrepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ conversionOptions }),
    )
  })
})

describe("createSendMutationOnchain", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("forwards the medium tier confirmation speed to executeSend", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      paymentMethod: { tag: "BitcoinAddress", inner: {} },
    })
    mockSendPayment.mockResolvedValue(undefined)

    const send = createSendMutationOnchain(
      { sdk: mockSdk, paymentRequest: "bc1q...", amount: BigInt(50000) },
      "medium",
    )
    const result = await send()

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(mockSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ confirmationSpeed: 1 }),
      }),
    )
  })

  it("classifies thrown SdkError errors via classifySdkError", async () => {
    mockPrepareSendPayment.mockRejectedValue(sdkError("NetworkError"))

    const send = createSendMutationOnchain(
      { sdk: mockSdk, paymentRequest: "bc1q...", amount: BigInt(50000) },
      "fast",
    )
    const result = await send()

    expect(result.status).toBe(PaymentSendResult.Failure)
    expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.NetworkError)
  })
})
