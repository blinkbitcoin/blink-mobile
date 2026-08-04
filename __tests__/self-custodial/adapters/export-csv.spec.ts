import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "@breeztech/breez-sdk-spark-react-native"

import { createExportTransactionsCsv } from "@app/self-custodial/adapters/export-csv"

const mockShareCsvBase64 = jest.fn()

jest.mock("@app/utils/share-csv", () => ({
  shareCsvBase64: (...args: unknown[]) => mockShareCsvBase64(...args),
}))

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

const sharedCsv = (): string => {
  const base64 = mockShareCsvBase64.mock.calls[0][0]
  return Buffer.from(base64, "base64").toString("utf8")
}

describe("createExportTransactionsCsv", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockShareCsvBase64.mockResolvedValue(true)
  })

  it("builds the CSV from the full history and shares it base64-encoded", async () => {
    const exportCsv = createExportTransactionsCsv(
      createSdkStub([completedReceive]) as never,
    )

    await expect(exportCsv()).resolves.toBe(true)

    const csv = sharedCsv()
    expect(csv.startsWith("id,walletId,type,")).toBe(true)
    expect(csv).toContain("keep-1")
    expect(csv).toContain("pubkey123-btc")
  })

  it("excludes failed and unknown-token payments", async () => {
    const exportCsv = createExportTransactionsCsv(
      createSdkStub([completedReceive, failedSend, unknownTokenPayment]) as never,
    )

    await exportCsv()

    const csv = sharedCsv()
    expect(csv).toContain("keep-1")
    expect(csv).not.toContain("failed-1")
    expect(csv).not.toContain("unknown-token-1")
  })

  it("resolves false without sharing when nothing is exportable", async () => {
    const exportCsv = createExportTransactionsCsv(createSdkStub([failedSend]) as never)

    await expect(exportCsv()).resolves.toBe(false)
    expect(mockShareCsvBase64).not.toHaveBeenCalled()
  })
})
