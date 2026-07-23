import { formatDepositFees } from "@app/utils/deposit-fees"

describe("formatDepositFees", () => {
  const deposit = {
    minBankFee: "2500",
    minBankFeeThreshold: "1000000",
    ratio: "50",
  }

  it("formats the minimum fee, compact threshold and derived over-threshold fee", () => {
    expect(formatDepositFees(deposit)).toEqual({
      fee: "2,500",
      threshold: "1M",
      overFee: "5,000",
    })
  })

  it("rounds the derived over-threshold fee", () => {
    expect(formatDepositFees({ ...deposit, ratio: "33" }).overFee).toBe("3,300")
  })

  it("keeps a legitimate zero ratio as a zero fee instead of the fallback", () => {
    expect(formatDepositFees({ ...deposit, ratio: "0" }).overFee).toBe("0")
  })

  it("falls back to the default over-threshold fee when the ratio is not numeric", () => {
    expect(formatDepositFees({ ...deposit, ratio: "not-a-number" }).overFee).toBe("5,000")
  })

  it("falls back to the default over-threshold fee when the threshold is not numeric", () => {
    expect(formatDepositFees({ ...deposit, minBankFeeThreshold: "oops" }).overFee).toBe(
      "5,000",
    )
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
