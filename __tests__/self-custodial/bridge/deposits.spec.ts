/* eslint-disable camelcase */
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

const mockSdk = {
  listUnclaimedDeposits: mockListUnclaimedDeposits,
  claimDeposit: mockClaimDeposit,
  refundDeposit: mockRefundDeposit,
  recommendedFees: mockRecommendedFees,
} as never

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  ClaimDepositRequest: { create: (p: Record<string, unknown>) => p },
  DepositClaimError_Tags: {
    MaxDepositClaimFeeExceeded: "MaxDepositClaimFeeExceeded",
    MissingUtxo: "MissingUtxo",
    Generic: "Generic",
  },
  Fee: {
    Rate: jest.fn().mockImplementation((inner: unknown) => ({ tag: "Rate", inner })),
  },
  ListUnclaimedDepositsRequest: { create: (p: Record<string, unknown>) => p },
  MaxFee: {
    Fixed: jest.fn().mockImplementation((inner: unknown) => ({ tag: "Fixed", inner })),
  },
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

  it("maps below_dust from generic error message", async () => {
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

    expect(result[0].claimError?.reason).toBe("below_dust")
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

describe("claimDeposit", () => {
  it("calls SDK claimDeposit without maxFee", async () => {
    mockClaimDeposit.mockResolvedValue(undefined)

    await claimDeposit({ sdk: mockSdk, txid: "abc", vout: 0 })

    expect(mockClaimDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ txid: "abc", vout: 0, maxFee: undefined }),
    )
  })

  it("calls SDK claimDeposit with MaxFee.Fixed when maxFeeSats provided", async () => {
    mockClaimDeposit.mockResolvedValue(undefined)

    await claimDeposit({ sdk: mockSdk, txid: "abc", vout: 0, maxFeeSats: 500 })

    expect(mockClaimDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        txid: "abc",
        vout: 0,
        maxFee: expect.objectContaining({ tag: "Fixed" }),
      }),
    )
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
