import {
  createClaimDeposit,
  createListPendingDeposits,
} from "@app/self-custodial/adapters/deposit-adapter"

const mockListDeposits = jest.fn()
const mockClaimDeposit = jest.fn()
const mockRefundDeposit = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  listDeposits: (...args: unknown[]) => mockListDeposits(...args),
  claimDeposit: (...args: unknown[]) => mockClaimDeposit(...args),
  refundDeposit: (...args: unknown[]) => mockRefundDeposit(...args),
}))

const mockSdk = {} as never

describe("createListPendingDeposits", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns mapped deposits", async () => {
    mockListDeposits.mockResolvedValue([
      {
        txid: "abc",
        vout: 0,
        amountSats: 5000,
        isMature: true,
        claimError: null,
        hasRefund: false,
      },
    ])

    const list = createListPendingDeposits(mockSdk)
    const result = await list()

    expect(result.deposits).toHaveLength(1)
    expect(result.deposits[0].id).toBe("abc:0")
    expect(result.deposits[0].status).toBe("claimable")
  })

  it("returns immature status for unconfirmed deposits", async () => {
    mockListDeposits.mockResolvedValue([
      {
        txid: "def",
        vout: 1,
        amountSats: 3000,
        isMature: false,
        claimError: null,
        hasRefund: false,
      },
    ])

    const list = createListPendingDeposits(mockSdk)
    const result = await list()

    expect(result.deposits[0].status).toBe("immature")
  })

  it("returns fee_exceeded status", async () => {
    mockListDeposits.mockResolvedValue([
      {
        txid: "ghi",
        vout: 0,
        amountSats: 1000,
        isMature: true,
        claimError: { reason: "fee_exceeded", requiredFeeSats: 800 },
        hasRefund: false,
      },
    ])

    const list = createListPendingDeposits(mockSdk)
    const result = await list()

    expect(result.deposits[0].status).toBe("fee_exceeded")
    expect(result.deposits[0].errorReason).toBe("fee_exceeded")
    expect(result.deposits[0].requiredFeeSats).toBe(800)
  })

  it("returns refunded status", async () => {
    mockListDeposits.mockResolvedValue([
      {
        txid: "jkl",
        vout: 0,
        amountSats: 2000,
        isMature: true,
        claimError: null,
        hasRefund: true,
      },
    ])

    const list = createListPendingDeposits(mockSdk)
    const result = await list()

    expect(result.deposits[0].status).toBe("refunded")
  })

  it("returns errors on failure", async () => {
    mockListDeposits.mockRejectedValue(new Error("SDK error"))

    const list = createListPendingDeposits(mockSdk)
    const result = await list()

    expect(result.deposits).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
  })
})

describe("createClaimDeposit", () => {
  beforeEach(() => jest.clearAllMocks())

  it("claims deposit successfully", async () => {
    mockClaimDeposit.mockResolvedValue(undefined)

    const adapter = createClaimDeposit(mockSdk)
    const result = await adapter.claimDeposit({ depositId: "abc:0" })

    expect(result.status).toBe("success")
    expect(mockClaimDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ txid: "abc", vout: 0 }),
    )
  })

  it("returns failed on error", async () => {
    mockClaimDeposit.mockRejectedValue(new Error("claim failed"))

    const adapter = createClaimDeposit(mockSdk)
    const result = await adapter.claimDeposit({ depositId: "abc:0" })

    expect(result.status).toBe("failed")
    expect(result.errors?.[0].message).toContain("claim failed")
  })

  it("refunds deposit successfully", async () => {
    mockRefundDeposit.mockResolvedValue(undefined)

    const adapter = createClaimDeposit(mockSdk)
    const result = await adapter.refundDeposit({
      depositId: "abc:0",
      destinationAddress: "bc1q...",
      feeRateSatPerVb: 3,
    })

    expect(result.status).toBe("success")
  })

  it("returns failed on refund error", async () => {
    mockRefundDeposit.mockRejectedValue(new Error("refund failed"))

    const adapter = createClaimDeposit(mockSdk)
    const result = await adapter.refundDeposit({
      depositId: "abc:0",
      destinationAddress: "bc1q...",
      feeRateSatPerVb: 3,
    })

    expect(result.status).toBe("failed")
    expect(result.errors?.[0].message).toContain("refund failed")
  })
})
