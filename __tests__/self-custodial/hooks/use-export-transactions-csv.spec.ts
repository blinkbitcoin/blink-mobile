import { renderHook, act } from "@testing-library/react-native"

import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "@breeztech/breez-sdk-spark-react-native"

import { useExportSelfCustodialTransactionsCsv } from "@app/self-custodial/hooks/use-export-transactions-csv"

const mockShareOpen = jest.fn()

jest.mock("react-native-share", () => ({
  __esModule: true,
  default: { open: (...args: unknown[]) => mockShareOpen(...args) },
}))

jest.mock("@app/self-custodial/config", () => ({
  requireSparkTokenIdentifier: () => "test-token-id",
}))

const mockUseSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
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

const decodeSharedCsv = (): string => {
  const { url } = mockShareOpen.mock.calls[0][0]
  const base64 = url.replace("data:text/csv;base64,", "")
  return Buffer.from(base64, "base64").toString("utf8")
}

describe("useExportSelfCustodialTransactionsCsv", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockShareOpen.mockResolvedValue({ success: true })
  })

  it("exports the full history as a base64 csv data url", async () => {
    const sdk = createSdkStub([completedReceive])
    mockUseSelfCustodialWallet.mockReturnValue({ sdk })
    const { result } = renderHook(() => useExportSelfCustodialTransactionsCsv())

    let hasShared: boolean | undefined
    await act(async () => {
      hasShared = await result.current.exportCsv()
    })

    expect(hasShared).toBe(true)
    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "blink-transactions",
        type: "text/csv",
        failOnCancel: false,
      }),
    )
    const csv = decodeSharedCsv()
    expect(csv).toContain("keep-1")
    expect(csv.startsWith("id,walletId,type,")).toBe(true)
  })

  it("excludes failed payments and unknown-token payments from the export", async () => {
    const sdk = createSdkStub([completedReceive, failedSend, unknownTokenPayment])
    mockUseSelfCustodialWallet.mockReturnValue({ sdk })
    const { result } = renderHook(() => useExportSelfCustodialTransactionsCsv())

    await act(async () => {
      await result.current.exportCsv()
    })

    const csv = decodeSharedCsv()
    expect(csv).toContain("keep-1")
    expect(csv).not.toContain("failed-1")
    expect(csv).not.toContain("unknown-token-1")
  })

  it("resolves false without sharing when there is nothing to export", async () => {
    const sdk = createSdkStub([failedSend])
    mockUseSelfCustodialWallet.mockReturnValue({ sdk })
    const { result } = renderHook(() => useExportSelfCustodialTransactionsCsv())

    let hasShared: boolean | undefined
    await act(async () => {
      hasShared = await result.current.exportCsv()
    })

    expect(hasShared).toBe(false)
    expect(mockShareOpen).not.toHaveBeenCalled()
  })

  it("resolves false without rejecting when the user dismisses the share sheet", async () => {
    mockShareOpen.mockResolvedValue({ success: false, dismissedAction: true })
    const sdk = createSdkStub([completedReceive])
    mockUseSelfCustodialWallet.mockReturnValue({ sdk })
    const { result } = renderHook(() => useExportSelfCustodialTransactionsCsv())

    let hasShared: boolean | undefined
    await act(async () => {
      hasShared = await result.current.exportCsv()
    })

    expect(hasShared).toBe(false)
  })

  it("rejects without sharing when the SDK is not connected", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    const { result } = renderHook(() => useExportSelfCustodialTransactionsCsv())

    await expect(result.current.exportCsv()).rejects.toThrow()
    expect(mockShareOpen).not.toHaveBeenCalled()
  })

  it("exposes a loading flag that is false when idle", () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: createSdkStub([]) })
    const { result } = renderHook(() => useExportSelfCustodialTransactionsCsv())

    expect(result.current.loading).toBe(false)
  })

  it("clears loading once the CSV is built, while the share sheet is still pending", async () => {
    /** A share target can hold the intent open indefinitely (seen with Google Drive on
     *  an unsynced account); the spinner must not wait for it. */
    mockShareOpen.mockReturnValue(new Promise(() => {}))
    const sdk = createSdkStub([completedReceive])
    mockUseSelfCustodialWallet.mockReturnValue({ sdk })
    const { result } = renderHook(() => useExportSelfCustodialTransactionsCsv())

    let exportPromise: Promise<boolean> | undefined
    await act(async () => {
      exportPromise = result.current.exportCsv()
      /** Flush the CSV generation microtasks without awaiting the share result. */
      await new Promise(process.nextTick)
    })

    expect(mockShareOpen).toHaveBeenCalledTimes(1)
    expect(result.current.loading).toBe(false)
    /** The promise itself stays pending: callers that consume the share outcome
     *  (the migration download screen) still get it once the target resolves. */
    exportPromise?.catch(() => {})
  })

  it("clears loading and rejects when CSV generation fails", async () => {
    const sdk = createSdkStub([completedReceive])
    sdk.listPayments.mockRejectedValue(new Error("sdk exploded"))
    mockUseSelfCustodialWallet.mockReturnValue({ sdk })
    const { result } = renderHook(() => useExportSelfCustodialTransactionsCsv())

    await act(async () => {
      await expect(result.current.exportCsv()).rejects.toThrow("sdk exploded")
    })

    expect(result.current.loading).toBe(false)
    expect(mockShareOpen).not.toHaveBeenCalled()
  })

  it("rejects when the share sheet itself fails", async () => {
    mockShareOpen.mockRejectedValue(new Error("share broke"))
    const sdk = createSdkStub([completedReceive])
    mockUseSelfCustodialWallet.mockReturnValue({ sdk })
    const { result } = renderHook(() => useExportSelfCustodialTransactionsCsv())

    await act(async () => {
      await expect(result.current.exportCsv()).rejects.toThrow("share broke")
    })

    expect(result.current.loading).toBe(false)
  })
})
