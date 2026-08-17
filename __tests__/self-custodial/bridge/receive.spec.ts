import type { BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import {
  createReceiveLightning,
  createReceiveOnchain,
} from "@app/self-custodial/bridge/receive"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  ReceivePaymentRequest: { create: (p: Record<string, unknown>) => p },
  ReceivePaymentMethod: {
    BitcoinAddress: jest
      .fn()
      .mockImplementation((inner: unknown) => ({ tag: "BitcoinAddress", inner })),
    Bolt11Invoice: jest
      .fn()
      .mockImplementation((inner: unknown) => ({ tag: "Bolt11Invoice", inner })),
  },
}))

const buildSdk = (paymentRequest = "bc1qaddress") => {
  const receivePayment = jest.fn().mockResolvedValue({ paymentRequest })
  return { sdk: { receivePayment } as unknown as BreezSdkInterface, receivePayment }
}

const methodInnerOf = (receivePayment: jest.Mock) =>
  receivePayment.mock.calls[0][0].paymentMethod.inner

describe("createReceiveOnchain", () => {
  it("reuses the existing deposit address when called without params", async () => {
    const { sdk, receivePayment } = buildSdk()

    const result = await createReceiveOnchain(sdk)()

    expect(result).toEqual({ address: "bc1qaddress" })
    expect(methodInnerOf(receivePayment)).toEqual({ newAddress: undefined })
  })

  it("reuses the existing deposit address when rotation is not requested", async () => {
    const { sdk, receivePayment } = buildSdk()

    await createReceiveOnchain(sdk)({ newAddress: false })

    expect(methodInnerOf(receivePayment)).toEqual({ newAddress: false })
  })

  it("asks the SDK to rotate when a fresh address is requested", async () => {
    const { sdk, receivePayment } = buildSdk("bc1qrotated")

    const result = await createReceiveOnchain(sdk)({ newAddress: true })

    expect(result).toEqual({ address: "bc1qrotated" })
    expect(methodInnerOf(receivePayment)).toEqual({ newAddress: true })
  })

  it("returns an error result when the SDK rejects", async () => {
    const receivePayment = jest.fn().mockRejectedValue(new Error("sdk offline"))
    const sdk = { receivePayment } as unknown as BreezSdkInterface

    const result = await createReceiveOnchain(sdk)({ newAddress: true })

    expect(result.address).toBeUndefined()
    expect(result.errors?.[0]?.message).toBe("sdk offline")
  })

  it("describes a non-Error rejection", async () => {
    const receivePayment = jest.fn().mockRejectedValue("plain string blowup")
    const sdk = { receivePayment } as unknown as BreezSdkInterface

    const result = await createReceiveOnchain(sdk)()

    expect(result.errors?.[0]?.message).toBe(
      "Address generation failed: plain string blowup",
    )
  })
})

describe("createReceiveLightning", () => {
  const btcAmount = (amount: number) => ({
    amount,
    currency: WalletCurrency.Btc,
    currencyCode: "BTC" as const,
  })

  it("passes amount, memo and expiry through to the SDK", async () => {
    const { sdk, receivePayment } = buildSdk("lnbc1invoice")

    const result = await createReceiveLightning(sdk)({
      amount: btcAmount(5000),
      memo: "coffee",
      expirySecs: 600,
    })

    expect(result).toEqual({ invoice: "lnbc1invoice" })
    expect(methodInnerOf(receivePayment)).toEqual({
      description: "coffee",
      amountSats: BigInt(5000),
      expirySecs: 600,
      paymentHash: undefined,
    })
  })

  it("sends an empty description and no amount for a bare invoice", async () => {
    const { sdk, receivePayment } = buildSdk()

    await createReceiveLightning(sdk)({})

    expect(methodInnerOf(receivePayment)).toEqual({
      description: "",
      amountSats: undefined,
      expirySecs: undefined,
      paymentHash: undefined,
    })
  })

  it("returns an error result when the SDK rejects", async () => {
    const receivePayment = jest.fn().mockRejectedValue(new Error("no route"))
    const sdk = { receivePayment } as unknown as BreezSdkInterface

    const result = await createReceiveLightning(sdk)({})

    expect(result.invoice).toBeUndefined()
    expect(result.errors?.[0]?.message).toBe("no route")
  })

  it("describes a non-Error rejection", async () => {
    const receivePayment = jest.fn().mockRejectedValue("plain string blowup")
    const sdk = { receivePayment } as unknown as BreezSdkInterface

    const result = await createReceiveLightning(sdk)({})

    expect(result.errors?.[0]?.message).toBe("Receive failed: plain string blowup")
  })
})
