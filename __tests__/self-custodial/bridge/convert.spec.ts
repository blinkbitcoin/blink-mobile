jest.mock("react-native-config", () => ({
  SPARK_TOKEN_IDENTIFIER: "test-token-id",
  BREEZ_API_KEY: "test-api-key",
  BREEZ_NETWORK: "regtest",
}))

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test/documents",
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
  PrepareSendPaymentRequest: {
    create: jest.fn((args: Record<string, unknown>) => args),
  },
  SendPaymentRequest: {
    create: jest.fn((args: Record<string, unknown>) => args),
  },
}))

import { WalletCurrency } from "@app/graphql/generated"
import { ConvertDirection, PaymentResultStatus } from "@app/types/payment.types"

import { createConvert } from "@app/self-custodial/bridge/convert"

const buildSdk = () => ({
  prepareSendPayment: jest.fn(),
  sendPayment: jest.fn(),
})

const buildAmount = (currency: WalletCurrency, amount = 1000) => ({
  amount,
  currency,
  currencyCode: currency === WalletCurrency.Btc ? "BTC" : "USD",
})

describe("createConvert", () => {
  it("returns Success when prepareSendPayment + sendPayment both resolve (BTC → USD)", async () => {
    const sdk = buildSdk()
    sdk.prepareSendPayment.mockResolvedValue({ id: "prepared" })
    sdk.sendPayment.mockResolvedValue(undefined)

    const convert = createConvert(sdk as never)
    const result = await convert({
      amount: buildAmount(WalletCurrency.Btc),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe(PaymentResultStatus.Success)
  })

  it("forwards the configured tokenIdentifier on BTC → USD conversions", async () => {
    const sdk = buildSdk()
    sdk.prepareSendPayment.mockResolvedValue({ id: "prepared" })
    sdk.sendPayment.mockResolvedValue(undefined)

    const convert = createConvert(sdk as never)
    await convert({
      amount: buildAmount(WalletCurrency.Btc),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(sdk.prepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: "test-token-id" }),
    )
  })

  it("omits tokenIdentifier on USD → BTC conversions", async () => {
    const sdk = buildSdk()
    sdk.prepareSendPayment.mockResolvedValue({ id: "prepared" })
    sdk.sendPayment.mockResolvedValue(undefined)

    const convert = createConvert(sdk as never)
    await convert({
      amount: buildAmount(WalletCurrency.Usd),
      direction: ConvertDirection.UsdToBtc,
    })

    expect(sdk.prepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ tokenIdentifier: undefined }),
    )
  })

  it("returns Failed with the SDK error message when prepare rejects", async () => {
    const sdk = buildSdk()
    sdk.prepareSendPayment.mockRejectedValue(new Error("prepare boom"))

    const convert = createConvert(sdk as never)
    const result = await convert({
      amount: buildAmount(WalletCurrency.Btc),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe(PaymentResultStatus.Failed)
    expect(result.errors?.[0].message).toBe("prepare boom")
    expect(sdk.sendPayment).not.toHaveBeenCalled()
  })

  it("returns Failed when sendPayment rejects after a successful prepare", async () => {
    const sdk = buildSdk()
    sdk.prepareSendPayment.mockResolvedValue({ id: "prepared" })
    sdk.sendPayment.mockRejectedValue(new Error("send boom"))

    const convert = createConvert(sdk as never)
    const result = await convert({
      amount: buildAmount(WalletCurrency.Btc),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe(PaymentResultStatus.Failed)
    expect(result.errors?.[0].message).toBe("send boom")
  })

  it("wraps non-Error throws into a Conversion-failed message", async () => {
    const sdk = buildSdk()
    sdk.prepareSendPayment.mockRejectedValue("string thrown")

    const convert = createConvert(sdk as never)
    const result = await convert({
      amount: buildAmount(WalletCurrency.Btc),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(result.status).toBe(PaymentResultStatus.Failed)
    expect(result.errors?.[0].message).toContain("Conversion failed")
    expect(result.errors?.[0].message).toContain("string thrown")
  })

  it("forwards the requested amount as a BigInt", async () => {
    const sdk = buildSdk()
    sdk.prepareSendPayment.mockResolvedValue({})
    sdk.sendPayment.mockResolvedValue(undefined)

    const convert = createConvert(sdk as never)
    await convert({
      amount: buildAmount(WalletCurrency.Btc, 12345),
      direction: ConvertDirection.BtcToUsd,
    })

    expect(sdk.prepareSendPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: BigInt(12345) }),
    )
  })
})
