/* eslint-disable camelcase */
import { it } from "@jest/globals"
import {
  listDeposits,
  claimDeposit,
  refundDeposit,
  getRecommendedFees,
} from "@app/self-custodial/bridge/deposits"

const mockListUnclaimedDeposits = jest.fn()
const mockClaimDeposit = jest.fn()
const mockRefundDeposit = jest.fn()
const mockRecommendedFees = jest.fn()
const mockListPayments = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const mockSdk = {
  listUnclaimedDeposits: mockListUnclaimedDeposits,
  listPayments: mockListPayments,
  claimDeposit: mockClaimDeposit,
  refundDeposit: mockRefundDeposit,
  recommendedFees: mockRecommendedFees,
} as never

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  ClaimDeferredReason_Tags: {
    MaxFeeExceeded: "MaxFeeExceeded",
    NoEarlyClaimAvailable: "NoEarlyClaimAvailable",
    ProviderDeclined: "ProviderDeclined",
  },
  ClaimDepositOutcome_Tags: {
    Settled: "Settled",
    Submitted: "Submitted",
    Deferred: "Deferred",
  },
  ClaimDepositRequest: { create: (p: Record<string, unknown>) => p },
  DepositClaimError_Tags: {
    MaxDepositClaimFeeExceeded: "MaxDepositClaimFeeExceeded",
    MissingUtxo: "MissingUtxo",
    DepositTooSmall: "DepositTooSmall",
    Generic: "Generic",
  },
  Fee: {
    Rate: jest.fn().mockImplementation((inner: unknown) => ({ tag: "Rate", inner })),
  },
  InstantClaimStatus_Tags: {
    Declined: "Declined",
    Submitted: "Submitted",
    Claimed: "Claimed",
  },
  ListUnclaimedDepositsRequest: { create: (p: Record<string, unknown>) => p },
  MaxFee: { create: (p: Record<string, unknown>) => p },
  MaxOnchainFee: {
    Fixed: jest.fn().mockImplementation((inner: unknown) => ({ tag: "Fixed", inner })),
  },
  PaymentDetails_Tags: { Deposit: "Deposit", Spark: "Spark" },
  PaymentStatus: { Completed: 0, Pending: 1, Failed: 2 },
  PaymentType: { Send: 0, Receive: 1 },
  RefundDepositRequest: { create: (p: Record<string, unknown>) => p },
}))

describe("listDeposits", () => {
  it("maps deposits from SDK", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [
        {
          txid: "abc123",
          vout: 0,
          amountSats: BigInt(5000),
          isMature: true,
          refundTxId: undefined,
          claimError: undefined,
        },
      ],
    })

    const result = await listDeposits(mockSdk)

    expect(result).toHaveLength(1)
    expect(result[0].txid).toBe("abc123")
    expect(result[0].amountSats).toBe(5000)
    expect(result[0].isMature).toBe(true)
    expect(result[0].claimError).toBeNull()
    expect(result[0].hasRefund).toBe(false)
  })

  it("maps fee_exceeded claim error with requiredFeeSats", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [
        {
          txid: "def456",
          vout: 1,
          amountSats: BigInt(500),
          isMature: true,
          refundTxId: undefined,
          claimError: {
            tag: "MaxDepositClaimFeeExceeded",
            inner: { requiredFeeSats: BigInt(300) },
          },
        },
      ],
    })

    const result = await listDeposits(mockSdk)

    expect(result[0].claimError?.reason).toBe("fee_exceeded")
    expect(result[0].claimError?.requiredFeeSats).toBe(300)
  })

  it("maps missing_utxo claim error", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [
        {
          txid: "ghi789",
          vout: 0,
          amountSats: BigInt(1000),
          isMature: true,
          refundTxId: undefined,
          claimError: { tag: "MissingUtxo" },
        },
      ],
    })

    const result = await listDeposits(mockSdk)

    expect(result[0].claimError?.reason).toBe("missing_utxo")
  })

  it("maps a deposit too small to claim after fees to below_dust", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [
        {
          txid: "jkl012",
          vout: 0,
          amountSats: BigInt(400),
          isMature: true,
          refundTxId: undefined,
          claimError: { tag: "DepositTooSmall", inner: { tx: "jkl012", vout: 0 } },
        },
      ],
    })

    const result = await listDeposits(mockSdk)

    expect(result[0].claimError).toEqual({ reason: "below_dust" })
  })

  it("surfaces dust-limit messages as Generic with the raw SDK message (I1: no fragile string-match)", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [
        {
          txid: "jkl012",
          vout: 0,
          amountSats: BigInt(400),
          isMature: true,
          refundTxId: undefined,
          claimError: {
            tag: "Generic",
            inner: { message: "Credit amount after fees is below dust limit: 105" },
          },
        },
      ],
    })

    const result = await listDeposits(mockSdk)

    expect(result[0].claimError?.reason).toBe("generic")
    expect(result[0].claimError?.message).toContain("dust limit")
  })

  it("maps hasRefund when refundTxId exists", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [
        {
          txid: "mno345",
          vout: 0,
          amountSats: BigInt(2000),
          isMature: true,
          refundTxId: "refund-tx-id",
          claimError: undefined,
        },
      ],
    })

    const result = await listDeposits(mockSdk)

    expect(result[0].hasRefund).toBe(true)
  })
})

describe("listDeposits — early claims (0.26)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    /** clearAllMocks leaves queued mockResolvedValueOnce pages behind. */
    mockListPayments.mockReset()
  })

  const depositWithInstantStatus = (instantClaimStatus: unknown) => ({
    txid: "pqr678",
    vout: 1,
    amountSats: BigInt(3000),
    isMature: false,
    refundTxId: undefined,
    claimError: undefined,
    instantClaimStatus,
  })
  const submitted = { tag: "Submitted", inner: { claimId: "c1" } }
  const depositReceive = (txId: string, vout: number) => ({
    details: { tag: "Deposit", inner: { txId, vout } },
  })

  it("reports a submitted early claim as settling while no receive credits it", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [depositWithInstantStatus(submitted)],
    })
    mockListPayments.mockResolvedValue({
      payments: [
        depositReceive("pqr678", 0),
        depositReceive("other", 1),
        { details: { tag: "Spark", inner: { txId: "pqr678", vout: 1 } } },
      ],
    })

    const [deposit] = await listDeposits(mockSdk)

    expect(deposit.earlyClaim).toBe("settling")
  })

  it("reports a submitted early claim as credited once its receive has completed", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [depositWithInstantStatus(submitted)],
    })
    mockListPayments.mockResolvedValue({ payments: [depositReceive("pqr678", 1)] })

    const [deposit] = await listDeposits(mockSdk)

    expect(deposit.earlyClaim).toBe("credited")
  })

  const unrelatedReceives = (count: number) =>
    Array.from({ length: count }, (_, i) => depositReceive(`older-${i}`, 0))
  const pagesOf = (...pages: unknown[][]) => {
    for (const payments of pages) mockListPayments.mockResolvedValueOnce({ payments })
  }

  it("asks for completed receives, newest first, a page at a time", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [depositWithInstantStatus(submitted)],
    })
    pagesOf([])

    await listDeposits(mockSdk)

    expect(mockListPayments).toHaveBeenCalledWith(
      expect.objectContaining({
        typeFilter: [1],
        statusFilter: [0],
        offset: 0,
        limit: 50,
        sortAscending: false,
      }),
    )
  })

  it("finds a credit beyond the newest 50 receives on a later page", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [depositWithInstantStatus(submitted)],
    })
    pagesOf(unrelatedReceives(50), [depositReceive("pqr678", 1)])

    const [deposit] = await listDeposits(mockSdk)

    expect(deposit.earlyClaim).toBe("credited")
    expect(mockListPayments.mock.calls.map(([req]) => req.offset)).toEqual([0, 50])
  })

  it("keeps paging until every settling deposit is found", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [
        { ...depositWithInstantStatus(submitted), txid: "first" },
        { ...depositWithInstantStatus(submitted), txid: "second" },
      ],
    })
    pagesOf(
      [...unrelatedReceives(49), depositReceive("first", 1)],
      [depositReceive("second", 1)],
    )

    const deposits = await listDeposits(mockSdk)

    expect(deposits.map(({ earlyClaim }) => earlyClaim)).toEqual(["credited", "credited"])
    expect(mockListPayments).toHaveBeenCalledTimes(2)
  })

  it("stops paging once every settling deposit is found", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [depositWithInstantStatus(submitted)],
    })
    pagesOf(
      [...unrelatedReceives(49), depositReceive("pqr678", 1)],
      unrelatedReceives(50),
    )

    const [deposit] = await listDeposits(mockSdk)

    expect(deposit.earlyClaim).toBe("credited")
    expect(mockListPayments).toHaveBeenCalledTimes(1)
  })

  it("stops at a short page, which means history has run out", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [depositWithInstantStatus(submitted)],
    })
    pagesOf(unrelatedReceives(50), unrelatedReceives(3), unrelatedReceives(50))

    const [deposit] = await listDeposits(mockSdk)

    expect(deposit.earlyClaim).toBe("settling")
    expect(mockListPayments).toHaveBeenCalledTimes(2)
  })

  const twoSettling = () =>
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [
        { ...depositWithInstantStatus(submitted), txid: "found" },
        { ...depositWithInstantStatus(submitted), txid: "missing" },
      ],
    })

  it("keeps a credit found on an earlier page when a later page fails", async () => {
    twoSettling()
    pagesOf([...unrelatedReceives(49), depositReceive("found", 1)])
    mockListPayments.mockRejectedValueOnce(new Error("storage"))

    const deposits = await listDeposits(mockSdk)

    expect(deposits.map(({ earlyClaim }) => earlyClaim)).toEqual(["credited", "settling"])
    expect(mockListPayments).toHaveBeenCalledTimes(2)
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it("keeps a credit found before the page cap when the cap stops the scan", async () => {
    twoSettling()
    pagesOf([...unrelatedReceives(49), depositReceive("found", 1)])
    mockListPayments.mockResolvedValue({ payments: unrelatedReceives(50) })

    const deposits = await listDeposits(mockSdk)

    expect(deposits.map(({ earlyClaim }) => earlyClaim)).toEqual(["credited", "settling"])
    expect(mockListPayments).toHaveBeenCalledTimes(500)
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it("gives up after 500 full pages, keeping the deposit settling and reporting it", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [depositWithInstantStatus(submitted)],
    })
    mockListPayments.mockResolvedValue({ payments: unrelatedReceives(50) })

    const [deposit] = await listDeposits(mockSdk)

    expect(deposit.earlyClaim).toBe("settling")
    expect(mockListPayments).toHaveBeenCalledTimes(500)
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it("keeps a submitted early claim settling, and reports it, when history cannot be read", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [depositWithInstantStatus(submitted)],
    })
    mockListPayments.mockRejectedValue(new Error("storage"))

    const [deposit] = await listDeposits(mockSdk)

    expect(deposit.earlyClaim).toBe("settling")
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it("reports a Claimed early claim as credited without reading history", async () => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [depositWithInstantStatus({ tag: "Claimed" })],
    })

    const [deposit] = await listDeposits(mockSdk)

    expect(deposit.earlyClaim).toBe("credited")
    expect(mockListPayments).not.toHaveBeenCalled()
  })

  it.each([
    ["declined", { tag: "Declined", inner: { maxFeeSats: BigInt(0), confirmations: 0 } }],
    ["never tried", undefined],
  ])("reports no early claim when it was %s", async (_, status) => {
    mockListUnclaimedDeposits.mockResolvedValue({
      deposits: [depositWithInstantStatus(status)],
    })

    const [deposit] = await listDeposits(mockSdk)

    expect(deposit.earlyClaim).toBe("none")
    expect(mockListPayments).not.toHaveBeenCalled()
  })
})

describe("claimDeposit", () => {
  const settled = { outcome: { tag: "Settled", inner: { payment: {} } } }
  const deferred = (reason: unknown) => ({
    outcome: { tag: "Deferred", inner: { reason } },
  })

  it("calls SDK claimDeposit without maxFee", async () => {
    mockClaimDeposit.mockResolvedValue(settled)

    await claimDeposit({ sdk: mockSdk, txid: "abc", vout: 0 })

    expect(mockClaimDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ txid: "abc", vout: 0, maxFee: undefined }),
    )
  })

  it("caps the claim at exactly maxFeeSats when provided, with no proportional part", async () => {
    mockClaimDeposit.mockResolvedValue(settled)

    await claimDeposit({ sdk: mockSdk, txid: "abc", vout: 0, maxFeeSats: 500 })

    expect(mockClaimDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        txid: "abc",
        vout: 0,
        maxFee: { onchain: { tag: "Fixed", inner: { amount: 500n } } },
      }),
    )
  })

  it("maps a settled claim", async () => {
    mockClaimDeposit.mockResolvedValue(settled)

    await expect(claimDeposit({ sdk: mockSdk, txid: "abc", vout: 0 })).resolves.toEqual({
      status: "settled",
    })
  })

  it("maps an early claim that was submitted", async () => {
    mockClaimDeposit.mockResolvedValue({ outcome: { tag: "Submitted" } })

    await expect(claimDeposit({ sdk: mockSdk, txid: "abc", vout: 0 })).resolves.toEqual({
      status: "submitted",
    })
  })

  it("maps a claim deferred over the fee cap, with the fee it needs", async () => {
    mockClaimDeposit.mockResolvedValue(
      deferred({
        tag: "MaxFeeExceeded",
        inner: {
          requiredFeeSats: BigInt(420),
          maxFeeSats: BigInt(300),
          requiredRateSatPerVbyte: BigInt(5),
        },
      }),
    )

    await expect(claimDeposit({ sdk: mockSdk, txid: "abc", vout: 0 })).resolves.toEqual({
      status: "deferred",
      reason: "fee_exceeded",
      requiredFeeSats: 420,
    })
  })

  it("maps a claim deferred until the deposit confirms", async () => {
    mockClaimDeposit.mockResolvedValue(deferred({ tag: "NoEarlyClaimAvailable" }))

    await expect(claimDeposit({ sdk: mockSdk, txid: "abc", vout: 0 })).resolves.toEqual({
      status: "deferred",
      reason: "awaiting_confirmations",
    })
  })

  it("maps a claim the provider declined, with its message", async () => {
    mockClaimDeposit.mockResolvedValue(
      deferred({ tag: "ProviderDeclined", inner: { message: "quote expired" } }),
    )

    await expect(claimDeposit({ sdk: mockSdk, txid: "abc", vout: 0 })).resolves.toEqual({
      status: "deferred",
      reason: "provider_declined",
      message: "quote expired",
    })
  })
})

describe("refundDeposit", () => {
  it("calls SDK refundDeposit with Fee.Rate", async () => {
    mockRefundDeposit.mockResolvedValue(undefined)

    await refundDeposit({
      sdk: mockSdk,
      txid: "abc",
      vout: 0,
      destinationAddress: "bc1q...",
      feeRateSatPerVb: 3,
    })

    expect(mockRefundDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        txid: "abc",
        vout: 0,
        destinationAddress: "bc1q...",
        fee: expect.objectContaining({ tag: "Rate" }),
      }),
    )
  })
})

describe("getRecommendedFees", () => {
  it("returns network fee rates", async () => {
    mockRecommendedFees.mockResolvedValue({
      fastestFee: BigInt(25),
      halfHourFee: BigInt(10),
      hourFee: BigInt(5),
      economyFee: BigInt(2),
      minimumFee: BigInt(1),
    })

    const result = await getRecommendedFees(mockSdk)

    expect(result.fastest).toBe(25)
    expect(result.halfHour).toBe(10)
    expect(result.hour).toBe(5)
    expect(result.economy).toBe(2)
    expect(result.minimum).toBe(1)
  })
})
