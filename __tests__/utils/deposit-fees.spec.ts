import {
  DepositFeeWarning,
  depositFeeForAmount,
  formatDepositFeeTiers,
  getDepositFeeWarning,
} from "@app/utils/deposit-fees"

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

describe("getDepositFeeWarning", () => {
  const deposit = {
    minBankFee: "2500",
    minBankFeeThreshold: "1000000",
    tiers: [
      { maxAmount: "1000000", amount: "2500" },
      { maxAmount: null, amount: "5000" },
    ],
  }
  const F = 2500
  const N = 10
  const MIN = 5000
  const classify = (amountSats: number, overrides = {}) =>
    getDepositFeeWarning({
      amountSats,
      deposit,
      minimumSats: MIN,
      multiplier: N,
      ...overrides,
    })
  const result = (type: string, extra = {}) => ({ type, fee: F, minimum: MIN, ...extra })

  it("says nothing for an empty amount", () => {
    expect(classify(0)).toBeNull()
  })

  describe("with the backend default floor above the fee", () => {
    it("flags an amount under the floor as below the minimum, even when it covers the fee", () => {
      expect(classify(F)).toEqual(result(DepositFeeWarning.BelowMinimum))
      expect(classify(MIN - 1)).toEqual(result(DepositFeeWarning.BelowMinimum))
    })

    it("warns about the fee from exactly the floor", () => {
      expect(classify(MIN)).toEqual(result(DepositFeeWarning.ConsumedByFee))
    })

    it("warns up to one sat under the multiplier band", () => {
      expect(classify(F * N - 1)).toEqual(result(DepositFeeWarning.ConsumedByFee))
    })

    it("stops warning at the multiplier band", () => {
      expect(classify(F * N)).toBeNull()
    })
  })

  describe("with the floor under the fee", () => {
    const low = { minimumSats: 1000 }

    it("flags an amount under the floor as below the minimum", () => {
      expect(classify(999, low)).toEqual(
        result(DepositFeeWarning.BelowMinimum, { minimum: 1000 }),
      )
    })

    it("flags an amount the fee would take entirely", () => {
      expect(classify(1000, low)).toEqual(
        result(DepositFeeWarning.AllConsumedByFee, { minimum: 1000 }),
      )
      expect(classify(F - 1, low)?.type).toBe(DepositFeeWarning.AllConsumedByFee)
    })

    it("flags an amount equal to the fee, which the backend credits as nothing", () => {
      expect(classify(F, low)?.type).toBe(DepositFeeWarning.AllConsumedByFee)
    })

    it("warns about the fee from one sat over the fee", () => {
      expect(classify(F + 1, low)?.type).toBe(DepositFeeWarning.ConsumedByFee)
    })
  })

  it("falls back to 2,500 when feesInformation has not resolved", () => {
    expect(classify(F * N - 1, { deposit: undefined })).toEqual(
      result(DepositFeeWarning.ConsumedByFee),
    )
    expect(classify(F * N, { deposit: undefined })).toBeNull()
  })

  it("uses the fee of the tier the amount lands in", () => {
    const steep = {
      ...deposit,
      tiers: [
        { maxAmount: "6000", amount: "100" },
        { maxAmount: null, amount: "8000" },
      ],
    }
    expect(classify(5999, { deposit: steep })).toBeNull()
    expect(classify(6001, { deposit: steep })).toEqual(
      result(DepositFeeWarning.AllConsumedByFee, { fee: 8000 }),
    )
    expect(classify(8001, { deposit: steep })?.type).toBe(DepositFeeWarning.ConsumedByFee)
  })

  it("narrows the band with a smaller multiplier", () => {
    expect(classify(F * 3, { multiplier: 3 })).toBeNull()
    expect(classify(F * 3 - 1, { multiplier: 3 })?.type).toBe(
      DepositFeeWarning.ConsumedByFee,
    )
  })

  it("only checks the floor when the tier charges no fee", () => {
    const free = { deposit: { ...deposit, tiers: [{ maxAmount: null, amount: "0" }] } }
    expect(classify(MIN - 1, free)?.type).toBe(DepositFeeWarning.BelowMinimum)
    expect(classify(MIN, free)).toBeNull()
  })
})

describe("depositFeeForAmount", () => {
  it("treats a tier's maxAmount as inclusive, like the backend", () => {
    const deposit = {
      minBankFee: "2500",
      minBankFeeThreshold: "1000000",
      tiers: [
        { maxAmount: "1000000", amount: "2500" },
        { maxAmount: null, amount: "5000" },
      ],
    }
    expect(depositFeeForAmount(1_000_000, deposit)).toBe(2500)
    expect(depositFeeForAmount(1_000_001, deposit)).toBe(5000)
  })
})
