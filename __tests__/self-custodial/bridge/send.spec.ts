/* eslint-disable camelcase */
import { extractOnchainFees, extractLightningFee } from "@app/self-custodial/bridge/send"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  OnchainConfirmationSpeed: { Fast: 0, Medium: 1, Slow: 2 },
  PrepareSendPaymentRequest: { create: (p: Record<string, unknown>) => p },
  SendPaymentMethod_Tags: {
    BitcoinAddress: "BitcoinAddress",
    Bolt11Invoice: "Bolt11Invoice",
  },
  SendPaymentOptions: {
    BitcoinAddress: jest
      .fn()
      .mockImplementation((inner: unknown) => ({ tag: "BitcoinAddress", inner })),
  },
  SendPaymentRequest: { create: (p: Record<string, unknown>) => p },
}))

describe("extractOnchainFees", () => {
  it("returns fee totals for BitcoinAddress payment", () => {
    const prepared = {
      paymentMethod: {
        tag: "BitcoinAddress",
        inner: {
          feeQuote: {
            speedFast: { userFeeSat: BigInt(100), l1BroadcastFeeSat: BigInt(200) },
            speedMedium: { userFeeSat: BigInt(100), l1BroadcastFeeSat: BigInt(150) },
            speedSlow: { userFeeSat: BigInt(100), l1BroadcastFeeSat: BigInt(80) },
          },
        },
      },
    }

    const result = extractOnchainFees(prepared as never)

    expect(result).toEqual({ fast: 300, medium: 250, slow: 180 })
  })

  it("returns null for non-BitcoinAddress payment", () => {
    const prepared = {
      paymentMethod: { tag: "Bolt11Invoice", inner: {} },
    }

    expect(extractOnchainFees(prepared as never)).toBeNull()
  })
})

describe("extractLightningFee", () => {
  it("returns total lightning fee", () => {
    const prepared = {
      paymentMethod: {
        tag: "Bolt11Invoice",
        inner: {
          lightningFeeSats: BigInt(10),
          sparkTransferFeeSats: BigInt(5),
        },
      },
    }

    expect(extractLightningFee(prepared as never)).toBe(15)
  })

  it("handles undefined sparkTransferFeeSats", () => {
    const prepared = {
      paymentMethod: {
        tag: "Bolt11Invoice",
        inner: {
          lightningFeeSats: BigInt(10),
          sparkTransferFeeSats: undefined,
        },
      },
    }

    expect(extractLightningFee(prepared as never)).toBe(10)
  })

  it("returns null for non-Bolt11Invoice payment", () => {
    const prepared = {
      paymentMethod: { tag: "BitcoinAddress", inner: {} },
    }

    expect(extractLightningFee(prepared as never)).toBeNull()
  })
})
