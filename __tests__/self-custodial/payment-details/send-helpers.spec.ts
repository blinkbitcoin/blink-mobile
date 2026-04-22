/* eslint-disable camelcase */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — GetFee<T> type expects GQL fee probe params that SC doesn't use
import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"

import {
  createGetFee,
  createGetFeeOnchain,
  createSendMutation,
} from "@app/self-custodial/payment-details/send-helpers"

const mockPrepareSendPayment = jest.fn()
const mockSendPayment = jest.fn()

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
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
}))

jest.mock("@app/screens/send-bitcoin-screen/fee-tier-selector", () => ({
  FeeTierOption: { Fast: "fast", Medium: "medium", Slow: "slow" },
}))

const mockSdk = {
  prepareSendPayment: (...args: unknown[]) => mockPrepareSendPayment(...args),
  sendPayment: (...args: unknown[]) => mockSendPayment(...args),
} as never

describe("createGetFee", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 0 fee for Lightning", async () => {
    mockPrepareSendPayment.mockResolvedValue({
      amount: BigInt(100),
      paymentMethod: { tag: "Lightning" },
    })

    const getFee = createGetFee(
      { sdk: mockSdk, paymentRequest: "lnbc1...", amount: undefined },
      WalletCurrency.Btc,
    )
    const result = await getFee()

    expect(result.amount).toBeDefined()
    expect(result.amount?.amount).toBe(0)
  })

  it("returns on-chain fee from fee quote using createGetFeeOnchain", async () => {
    mockPrepareSendPayment.mockResolvedValue({
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

    const getFee = createGetFeeOnchain(
      { sdk: mockSdk, paymentRequest: "bc1q...", amount: BigInt(50000) },
      WalletCurrency.Btc,
      "medium",
    )
    const result = await getFee()

    expect(result.amount).toBeDefined()
    expect(result.amount?.amount).toBe(400)
  })

  it("returns fast tier fee from fee quote", async () => {
    mockPrepareSendPayment.mockResolvedValue({
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

    const getFee = createGetFeeOnchain(
      { sdk: mockSdk, paymentRequest: "bc1q...", amount: BigInt(50000) },
      WalletCurrency.Btc,
      "fast",
    )
    const result = await getFee()

    expect(result.amount?.amount).toBe(800)
  })

  it("returns undefined amount on error", async () => {
    mockPrepareSendPayment.mockRejectedValue(new Error("fail"))

    const getFee = createGetFee(
      { sdk: mockSdk, paymentRequest: "lnbc1...", amount: undefined },
      WalletCurrency.Btc,
    )
    const result = await getFee()

    expect(result.amount).toBeUndefined()
  })

  it("passes amount to prepare request when provided", async () => {
    mockPrepareSendPayment.mockResolvedValue({ amount: BigInt(50) })

    const getFee = createGetFee(
      { sdk: mockSdk, paymentRequest: "lnbc1...", amount: BigInt(1000) },
      WalletCurrency.Btc,
    )
    await getFee()

    expect(mockPrepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: BigInt(1000) }),
    )
  })
})

describe("createSendMutation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns success on successful send", async () => {
    const prepared = { amount: BigInt(100) }
    mockPrepareSendPayment.mockResolvedValue(prepared)
    mockSendPayment.mockResolvedValue(undefined)

    const send = createSendMutation({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
    })
    const result = await send()

    expect(result.status).toBe(PaymentSendResult.Success)
  })

  it("returns failure with error message on Error", async () => {
    mockPrepareSendPayment.mockRejectedValue(new Error("insufficient funds"))

    const send = createSendMutation({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
    })
    const result = await send()

    expect(result.status).toBe(PaymentSendResult.Failure)
    expect(result.errors?.[0].message).toBe("insufficient funds")
  })

  it("returns failure with string error on non-Error", async () => {
    mockPrepareSendPayment.mockRejectedValue("string error")

    const send = createSendMutation({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: undefined,
    })
    const result = await send()

    expect(result.status).toBe(PaymentSendResult.Failure)
    expect(result.errors?.[0].message).toBe("Send failed: string error")
  })

  it("forwards tokenIdentifier from prepare params to the SDK prepare call", async () => {
    mockPrepareSendPayment.mockResolvedValue({ amount: BigInt(100) })
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

  it("passes tokenIdentifier=undefined when omitted so the SDK treats it as a BTC send", async () => {
    mockPrepareSendPayment.mockResolvedValue({ amount: BigInt(100) })
    mockSendPayment.mockResolvedValue(undefined)

    const send = createSendMutation({
      sdk: mockSdk,
      paymentRequest: "lnbc1...",
      amount: BigInt(1500),
    })
    await send()

    expect(mockPrepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: undefined }),
    )
  })
})
