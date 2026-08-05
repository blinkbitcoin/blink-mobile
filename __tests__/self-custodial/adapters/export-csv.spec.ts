import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "@breeztech/breez-sdk-spark-react-native"

import { createBuildTransactionsCsvBase64 } from "@app/self-custodial/adapters/export-csv"

jest.mock("@app/self-custodial/config", () => ({
  requireSparkTokenIdentifier: () => "test-token-id",
}))

const completedReceive = {
  id: "keep-1",
  paymentType: PaymentType.Receive,
  status: PaymentStatus.Completed,
  method: PaymentMethod.Lightning,
  amount: 1000n,
  fees: 0n,
  timestamp: 1735689600n,
  details: {
    tag: "Lightning",
    inner: {
      description: "kept",
      destinationPubkey: "02pub",
      htlcDetails: { paymentHash: "hash1" },
      lnurlPayInfo: undefined,
    },
  },
  conversionDetails: undefined,
}

const failedSend = {
  ...completedReceive,
  id: "failed-1",
  paymentType: PaymentType.Send,
  status: PaymentStatus.Failed,
}

const unknownTokenPayment = {
  ...completedReceive,
  id: "unknown-token-1",
  method: PaymentMethod.Token,
  details: {
    tag: "Token",
    inner: {
      metadata: { identifier: "someone-elses-token", ticker: "XXX", decimals: 6 },
      txHash: "xxxhash",
      txType: "Transfer",
      invoiceDetails: undefined,
      conversionInfo: undefined,
    },
  },
}

const createSdkStub = (payments: unknown[]) => ({
  getInfo: jest.fn().mockResolvedValue({ identityPubkey: "pubkey123" }),
  listPayments: jest.fn().mockResolvedValue({ payments }),
})

const decodeCsv = (base64: string | null): string =>
  Buffer.from(base64 ?? "", "base64").toString("utf8")

describe("createBuildTransactionsCsvBase64", () => {
  it("builds a base64 CSV from the full history", async () => {
    const buildCsv = createBuildTransactionsCsvBase64(
      createSdkStub([completedReceive]) as never,
    )

    const csv = decodeCsv(await buildCsv())

    expect(csv.startsWith("id,walletId,type,")).toBe(true)
    expect(csv).toContain("keep-1")
    expect(csv).toContain("pubkey123-btc")
  })

  it("excludes failed and unknown-token payments", async () => {
    const buildCsv = createBuildTransactionsCsvBase64(
      createSdkStub([completedReceive, failedSend, unknownTokenPayment]) as never,
    )

    const csv = decodeCsv(await buildCsv())

    expect(csv).toContain("keep-1")
    expect(csv).not.toContain("failed-1")
    expect(csv).not.toContain("unknown-token-1")
  })

  it("resolves null when nothing is exportable", async () => {
    const buildCsv = createBuildTransactionsCsvBase64(
      createSdkStub([failedSend]) as never,
    )

    await expect(buildCsv()).resolves.toBeNull()
  })
})
