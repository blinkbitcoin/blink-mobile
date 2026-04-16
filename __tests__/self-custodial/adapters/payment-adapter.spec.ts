/* eslint-disable camelcase */
import {
  createSendPayment,
  createGetFee,
} from "@app/self-custodial/adapters/payment-adapter"
import {
  createReceiveLightning,
  createReceiveOnchain,
  createConvert,
} from "@app/self-custodial/bridge"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  BitcoinNetwork: { Bitcoin: 0, Regtest: 4 },
  InputType_Tags: { SparkAddress: "SparkAddress" },
  Network: { Mainnet: 0, Regtest: 1 },
  PrepareSendPaymentRequest: {
    create: (args: unknown) => args,
  },
  SendPaymentMethod_Tags: {
    BitcoinAddress: "BitcoinAddress",
    Bolt11Invoice: "Bolt11Invoice",
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
  },
  ListUnclaimedDepositsRequest: {
    create: (args: unknown) => args,
  },
  ClaimDepositRequest: {
    create: (args: unknown) => args,
  },
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: { tokenIdentifier: "test-token-id" },
}))

const createMockSdk = () => ({
  prepareSendPayment: jest.fn(),
  sendPayment: jest.fn(),
  receivePayment: jest.fn(),
  listUnclaimedDeposits: jest.fn(),
  claimDeposit: jest.fn(),
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

  describe("createConvert", () => {
    it("prepares and sends conversion", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockResolvedValue({ amount: BigInt(100) })
      sdk.sendPayment.mockResolvedValue({})

      const convert = createConvert(sdk as never)
      const result = await convert({
        amount: { amount: 1000, currency: "BTC", currencyCode: "BTC" },
        direction: "btc_to_usd",
      })

      expect(result.status).toBe("success")
      expect(sdk.prepareSendPayment).toHaveBeenCalledWith(
        expect.objectContaining({ tokenIdentifier: "test-token-id" }),
      )
    })

    it("returns failed on error", async () => {
      const sdk = createMockSdk()
      sdk.prepareSendPayment.mockRejectedValue(new Error("slippage"))

      const convert = createConvert(sdk as never)
      const result = await convert({
        amount: { amount: 1000, currency: "BTC", currencyCode: "BTC" },
        direction: "btc_to_usd",
      })

      expect(result.status).toBe("failed")
    })
  })
})
