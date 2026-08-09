import type { BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { createReceiveOnchain } from "@app/self-custodial/bridge/receive"

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
})
