import { formatDepositFeeTiers } from "@app/utils/deposit-fees"

describe("formatDepositFeeTiers", () => {
  const deposit = {
    minBankFee: "2500",
    minBankFeeThreshold: "1000000",
    tiers: [
      { maxAmount: "1000000", amount: "2500" },
      { maxAmount: null, amount: "5000" },
    ],
  }

  it("formats each tier with its own bounds", () => {
    expect(formatDepositFeeTiers(deposit)).toEqual([
      { amount: "2,500", minAmount: null, maxAmount: "1M" },
      { amount: "5,000", minAmount: "1M", maxAmount: null },
    ])
  })

  it("gives a middle tier both bounds so it can be labelled as a range", () => {
    expect(
      formatDepositFeeTiers({
        ...deposit,
        tiers: [
          { maxAmount: "1000000", amount: "2500" },
          { maxAmount: "5000000", amount: "4000" },
          { maxAmount: null, amount: "5000" },
        ],
      }),
    ).toEqual([
      { amount: "2,500", minAmount: null, maxAmount: "1M" },
      { amount: "4,000", minAmount: "1M", maxAmount: "5M" },
      { amount: "5,000", minAmount: "5M", maxAmount: null },
    ])
  })

  it("sorts tiers ascending with the unbounded tier last", () => {
    expect(
      formatDepositFeeTiers({
        ...deposit,
        tiers: [
          { maxAmount: null, amount: "5000" },
          { maxAmount: "5000000", amount: "4000" },
          { maxAmount: "1000000", amount: "2500" },
        ],
      }).map((tier) => tier.amount),
    ).toEqual(["2,500", "4,000", "5,000"])
  })

  it("keeps a legitimate zero amount instead of falling back", () => {
    expect(
      formatDepositFeeTiers({
        ...deposit,
        tiers: [{ maxAmount: null, amount: "0" }],
      }),
    ).toEqual([{ amount: "0", minAmount: null, maxAmount: null }])
  })

  it("drops a tier whose amount is not numeric", () => {
    expect(
      formatDepositFeeTiers({
        ...deposit,
        tiers: [
          { maxAmount: "1000000", amount: "2500" },
          { maxAmount: null, amount: "oops" },
        ],
      }),
    ).toEqual([{ amount: "2,500", minAmount: null, maxAmount: "1M" }])
  })

  it("treats a blank amount as missing rather than as zero", () => {
    expect(
      formatDepositFeeTiers({
        ...deposit,
        tiers: [{ maxAmount: null, amount: "  " }],
      }),
    ).toEqual([
      { amount: "2,500", minAmount: null, maxAmount: "1M" },
      { amount: "5,000", minAmount: "1M", maxAmount: null },
    ])
  })

  describe("when tiers are unusable", () => {
    it("falls back to the legacy minBankFee shape", () => {
      expect(formatDepositFeeTiers({ ...deposit, tiers: [] })).toEqual([
        { amount: "2,500", minAmount: null, maxAmount: "1M" },
        { amount: "5,000", minAmount: "1M", maxAmount: null },
      ])
    })

    it("falls back to the default minimum fee when minBankFee is not numeric", () => {
      expect(
        formatDepositFeeTiers({ ...deposit, minBankFee: "oops", tiers: [] })[0].amount,
      ).toBe("2,500")
    })

    it("falls back to the default threshold when minBankFeeThreshold is not numeric", () => {
      expect(
        formatDepositFeeTiers({
          ...deposit,
          minBankFeeThreshold: "oops",
          tiers: [],
        })[0].maxAmount,
      ).toBe("1M")
    })
  })
})
