import {
  createClaimDeposit,
  createListPendingDeposits,
  parseDepositId,
} from "@app/self-custodial/adapters/deposit"

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

  it("reports a deposit the network no longer holds", async () => {
    mockListDeposits.mockResolvedValue([
      {
        txid: "mno",
        vout: 0,
        amountSats: 1000,
        isMature: true,
        claimError: { reason: "missing_utxo" },
        hasRefund: false,
      },
    ])

    const result = await createListPendingDeposits(mockSdk)()

    expect(result.deposits[0].status).toBe("error")
    expect(result.deposits[0].errorReason).toBe("missing_utxo")
  })

  it("reports a deposit too small to be worth claiming", async () => {
    mockListDeposits.mockResolvedValue([
      {
        txid: "pqr",
        vout: 0,
        amountSats: 100,
        isMature: true,
        claimError: { reason: "below_dust" },
        hasRefund: false,
      },
    ])

    const result = await createListPendingDeposits(mockSdk)()

    expect(result.deposits[0].errorReason).toBe("below_dust")
  })

  it("falls back to a generic reason for a claim error it does not name", async () => {
    mockListDeposits.mockResolvedValue([
      {
        txid: "stu",
        vout: 0,
        amountSats: 4000,
        isMature: true,
        claimError: { reason: "generic", message: "something else" },
        hasRefund: false,
      },
    ])

    const result = await createListPendingDeposits(mockSdk)()

    expect(result.deposits[0].errorReason).toBe("generic")
    expect(result.deposits[0].errorMessage).toBe("something else")
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

  it("describes a rejection that is not an Error at all", async () => {
    mockListDeposits.mockRejectedValue("bridge unavailable")

    const result = await createListPendingDeposits(mockSdk)()

    expect(result.errors?.[0].message).toBe("List deposits failed: bridge unavailable")
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

  const unclaimed = (txid: string, vout: number) => ({
    txid,
    vout,
    amountSats: 5000,
    isMature: true,
    claimError: null,
    hasRefund: false,
  })

  it("reports success when the throw came after the deposit was already claimed", async () => {
    // The SDK raises from the step after the funds settle. Reading the unclaimed list back
    // is what tells a settled deposit apart from one that truly failed.
    mockClaimDeposit.mockRejectedValue(new Error("sdkError.SparkError"))
    mockListDeposits.mockResolvedValue([unclaimed("other", 0)])

    const adapter = createClaimDeposit(mockSdk)
    const result = await adapter.claimDeposit({ depositId: "abc:0" })

    expect(result.status).toBe("success")
    expect(result.errors).toBeUndefined()
  })

  it("returns failed while the deposit is still waiting to be claimed", async () => {
    mockClaimDeposit.mockRejectedValue(new Error("claim failed"))
    mockListDeposits.mockResolvedValue([unclaimed("abc", 0)])

    const adapter = createClaimDeposit(mockSdk)
    const result = await adapter.claimDeposit({ depositId: "abc:0" })

    expect(result.status).toBe("failed")
    expect(result.errors?.[0].message).toBe("sc_generic")
  })

  it("keeps a deposit of the same txid but another vout apart", async () => {
    mockClaimDeposit.mockRejectedValue(new Error("claim failed"))
    mockListDeposits.mockResolvedValue([unclaimed("abc", 1)])

    const adapter = createClaimDeposit(mockSdk)
    const result = await adapter.claimDeposit({ depositId: "abc:0" })

    expect(result.status).toBe("success")
  })

  it("reports failure when the read-back itself fails, rather than guessing", async () => {
    // An unknown outcome must not be announced as money arrived: a claim that already
    // succeeded costs the reader nothing to retry, a phantom success costs them trust.
    mockClaimDeposit.mockRejectedValue(new Error("claim failed"))
    mockListDeposits.mockRejectedValue(new Error("listing unavailable"))

    const adapter = createClaimDeposit(mockSdk)
    const result = await adapter.claimDeposit({ depositId: "abc:0" })

    expect(result.status).toBe("failed")
    expect(result.errors?.[0].message).toBe("sc_generic")
  })

  it("classifies the error rather than passing the SDK's own wording on", async () => {
    mockClaimDeposit.mockRejectedValue(new Error("sdkError.SparkError"))
    mockListDeposits.mockResolvedValue([unclaimed("abc", 0)])

    const adapter = createClaimDeposit(mockSdk)
    const result = await adapter.claimDeposit({ depositId: "abc:0" })

    expect(result.errors?.[0].message).not.toContain("sdkError")
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

  it("describes a refund rejection that is not an Error at all", async () => {
    mockRefundDeposit.mockRejectedValue("bridge unavailable")

    const adapter = createClaimDeposit(mockSdk)
    const result = await adapter.refundDeposit({
      depositId: "abc:0",
      destinationAddress: "bc1q...",
      feeRateSatPerVb: 3,
    })

    expect(result.errors?.[0].message).toBe("Refund failed: bridge unavailable")
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

  describe("malformed depositId guards", () => {
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

describe("parseDepositId", () => {
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

  it("returns null for a vout past what a number can hold exactly", () => {
    expect(parseDepositId("abc:9007199254740993")).toBeNull()
  })
})
