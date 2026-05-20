import {
  createClaimDeposit,
  createListPendingDeposits,
  parseDepositId,
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

  describe("malformed depositId guards (I10)", () => {
    beforeEach(() => jest.clearAllMocks())

    const malformed = [
      "",
      ":",
      "no-colon",
      ":0",
      "abc:",
      "abc:notnum",
      "abc:-1",
      "abc:1.5",
    ]

    for (const bad of malformed) {
      it(`claimDeposit refuses to call SDK for "${bad}"`, async () => {
        const adapter = createClaimDeposit(mockSdk)
        const result = await adapter.claimDeposit({ depositId: bad })

        expect(result.status).toBe("failed")
        expect(mockClaimDeposit).not.toHaveBeenCalled()
      })

      it(`refundDeposit refuses to call SDK for "${bad}"`, async () => {
        const adapter = createClaimDeposit(mockSdk)
        const result = await adapter.refundDeposit({
          depositId: bad,
          destinationAddress: "bc1q...",
          feeRateSatPerVb: 3,
        })

        expect(result.status).toBe("failed")
        expect(mockRefundDeposit).not.toHaveBeenCalled()
      })
    }
  })

  describe("getClaimFee (I11 — null instead of misleading 0)", () => {
    beforeEach(() => jest.clearAllMocks())

    it("returns null even when the deposit exists, until SDK exposes a real quote", async () => {
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

      const adapter = createClaimDeposit(mockSdk)
      const result = await adapter.getClaimFee({ depositId: "abc:0" })

      expect(result).toBeNull()
    })

    it("returns null for a malformed depositId without hitting the SDK", async () => {
      const adapter = createClaimDeposit(mockSdk)
      const result = await adapter.getClaimFee({ depositId: "garbage" })

      expect(result).toBeNull()
      expect(mockListDeposits).not.toHaveBeenCalled()
    })
  })
})

describe("parseDepositId (I10)", () => {
  it("parses a well-formed txid:vout pair", () => {
    expect(parseDepositId("abc123:0")).toEqual({ txid: "abc123", vout: 0 })
  })

  it("supports vouts > 0", () => {
    expect(parseDepositId("abc123:42")).toEqual({ txid: "abc123", vout: 42 })
  })

  it("returns null for missing colon", () => {
    expect(parseDepositId("abc123")).toBeNull()
  })

  it("returns null for empty txid", () => {
    expect(parseDepositId(":0")).toBeNull()
  })

  it("returns null for empty vout", () => {
    expect(parseDepositId("abc123:")).toBeNull()
  })

  it("returns null for non-numeric vout", () => {
    expect(parseDepositId("abc:notnum")).toBeNull()
  })

  it("returns null for negative vout", () => {
    expect(parseDepositId("abc:-1")).toBeNull()
  })

  it("returns null for fractional vout", () => {
    expect(parseDepositId("abc:1.5")).toBeNull()
  })
})
