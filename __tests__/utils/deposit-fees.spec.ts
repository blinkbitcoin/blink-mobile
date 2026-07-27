import { formatDepositFees } from "@app/utils/deposit-fees"

describe("formatDepositFees", () => {
  const deposit = {
    minBankFee: "2500",
    minBankFeeThreshold: "1000000",
    tiers: [
      { maxAmount: "1000000", amount: "2500" },
      { maxAmount: null, amount: "5000" },
    ],
  }

  it("formats the minimum fee, compact threshold and over-threshold tier fee", () => {
    expect(formatDepositFees(deposit)).toEqual({
      fee: "2,500",
      threshold: "1M",
      overFee: "5,000",
    })
  })

  it("reads the over-threshold fee from the unbounded tier wherever it sits", () => {
    expect(
      formatDepositFees({
        ...deposit,
        tiers: [
          { maxAmount: null, amount: "7500" },
          { maxAmount: "1000000", amount: "2500" },
        ],
      }).overFee,
    ).toBe("7,500")
  })

  it("keeps a legitimate zero tier amount as a zero fee instead of the fallback", () => {
    expect(
      formatDepositFees({
        ...deposit,
        tiers: [{ maxAmount: null, amount: "0" }],
      }).overFee,
    ).toBe("0")
  })

  it("falls back to the default over-threshold fee when there is no unbounded tier", () => {
    expect(
      formatDepositFees({
        ...deposit,
        tiers: [{ maxAmount: "1000000", amount: "2500" }],
      }).overFee,
    ).toBe("5,000")
  })

  it("falls back to the default over-threshold fee when tiers are missing", () => {
    expect(formatDepositFees({ ...deposit, tiers: undefined }).overFee).toBe("5,000")
  })

  it("falls back to the default over-threshold fee when the tier amount is not numeric", () => {
    expect(
      formatDepositFees({
        ...deposit,
        tiers: [{ maxAmount: null, amount: "oops" }],
      }).overFee,
    ).toBe("5,000")
  })

  it("falls back to the default minimum fee when minBankFee is not numeric", () => {
    expect(formatDepositFees({ ...deposit, minBankFee: "oops" }).fee).toBe("2,500")
  })

  it("falls back to the default threshold when minBankFeeThreshold is not numeric", () => {
    expect(formatDepositFees({ ...deposit, minBankFeeThreshold: "oops" }).threshold).toBe(
      "1M",
    )
  })
})
