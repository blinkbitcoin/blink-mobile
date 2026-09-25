import {
  INVESTMENT_OPTIONS,
  resolveEquityPercent,
  resolveInvestmentFunding,
  resolveInvestmentTerms,
  resolveSettlementQuote,
} from "@app/screens/card-screen/onboarding/investment-flow/investment-terms"

describe("resolveInvestmentTerms", () => {
  it("keeps the chosen amount as the total", () => {
    expect(resolveInvestmentTerms(25000).totalUsd).toBe(25000)
  })

  it("gives one unit per dollar", () => {
    expect(resolveInvestmentTerms(25000)).toMatchObject({
      units: 25000,
      pricePerUnitUsd: 1,
    })
  })

  it("prices every investment against the same company valuation", () => {
    expect(resolveInvestmentTerms(1000).preMoneyValuationUsd).toBe(10_000_000)
    expect(resolveInvestmentTerms(100000).preMoneyValuationUsd).toBe(10_000_000)
  })

  describe("the settlement quote", () => {
    /** 2026-09-07 15:09 UTC, which Honduras reads six hours earlier. */
    const AT = new Date("2026-09-07T15:09:30.000Z")
    const quote = { btcUsdRate: 100000, at: AT }

    it("converts the total at the quoted rate", () => {
      expect(resolveInvestmentTerms(25000, quote).settlementBtc).toBe(0.25)
    })

    /** The signer commits to a figure that has to be payable to the satoshi, not to
     *  whatever a float happens to print. */
    it("quotes the settlement to the satoshi", () => {
      expect(
        resolveInvestmentTerms(1000, { ...quote, btcUsdRate: 63333 }).settlementBtc,
      ).toBe(0.01578956)
    })

    it("carries the rate it quoted against", () => {
      expect(resolveInvestmentTerms(25000, quote).btcUsdRate).toBe(100000)
    })

    /** The document names the zone, and Honduras holds UTC-6 all year. */
    it("stamps the rate in Honduras time", () => {
      expect(resolveInvestmentTerms(25000, quote).rateTimestamp).toBe("2026-09-07 09:09")
    })

    /**
     * The agreement fixes a rate its payment is then owed at, so an invented one would be
     * worse than none: without a price the three BTC figures are simply absent.
     */
    it("leaves the btc figures out when there is no price", () => {
      const terms = resolveInvestmentTerms(25000, null)

      expect(terms.settlementBtc).toBeUndefined()
      expect(terms.btcUsdRate).toBeUndefined()
      expect(terms.rateTimestamp).toBeUndefined()
    })
  })
})

describe("resolveEquityPercent", () => {
  /**
   * The select screen and the term sheet both derive the share from here, so this is the
   * one place the advertised figures are pinned: $1,000 buys 0.01% and $100,000 buys 1%
   * of a $10M company. A change to the valuation shows up here first, on purpose.
   */
  it("states the share each amount on offer buys", () => {
    const advertised = new Map([
      [1000, 0.01],
      [2500, 0.025],
      [5000, 0.05],
      [10000, 0.1],
      [25000, 0.25],
      [50000, 0.5],
      [100000, 1],
    ])

    expect(INVESTMENT_OPTIONS).toEqual([...advertised.keys()])
    INVESTMENT_OPTIONS.forEach((usd) => {
      expect(resolveEquityPercent(resolveInvestmentTerms(usd))).toBe(advertised.get(usd))
    })
  })
})

describe("resolveInvestmentFunding at the split boundary", () => {
  /** The investor who converts exactly what they are short holds, between the two
   *  wallets, exactly the amount: that is split, not short. */
  it("counts the two wallets adding up to exactly the amount as split", () => {
    expect(
      resolveInvestmentFunding({
        largestWalletUsd: 3000,
        combinedUsd: 5000,
        totalUsd: 5000,
      }).isSplitAcrossWallets,
    ).toBe(true)
  })
})

describe("resolveSettlementQuote", () => {
  const AT = new Date("2026-09-07T15:09:30.000Z")

  /** The app prices in cents; the agreement is written in dollars. */
  it("reads the dollar rate off the price in cents", () => {
    expect(resolveSettlementQuote(10_000_000, AT)).toEqual({
      btcUsdRate: 100000,
      at: AT,
    })
  })

  /** The rate the document states has to be the one the feed gave, cents included; a
   *  price per satoshi to eight decimals would have held whole dollars only. */
  it("keeps the cents of the rate", () => {
    expect(resolveSettlementQuote(6_712_345, AT)?.btcUsdRate).toBe(67123.45)
  })

  it("has nothing to quote before the price feed answers", () => {
    expect(resolveSettlementQuote(null, AT)).toBeNull()
  })

  /** A zero would divide the settlement by zero, and a NaN would reach the document as
   *  the string "NaN": neither may be quoted. */
  it("refuses a zero price", () => {
    expect(resolveSettlementQuote(0, AT)).toBeNull()
  })

  it("refuses a price that is not a number", () => {
    expect(resolveSettlementQuote(Number.NaN, AT)).toBeNull()
  })
})

describe("resolveInvestmentFunding", () => {
  it("names what is missing when the investor is short", () => {
    expect(
      resolveInvestmentFunding({
        largestWalletUsd: 3333,
        combinedUsd: 3333,
        totalUsd: 25000,
      }),
    ).toEqual({
      balanceUsd: 3333,
      shortfallUsd: 21667,
      hasEnoughBalance: false,
      isSplitAcrossWallets: false,
    })
  })

  it("counts an exact balance as covered", () => {
    expect(
      resolveInvestmentFunding({
        largestWalletUsd: 25000,
        combinedUsd: 25000,
        totalUsd: 25000,
      }).hasEnoughBalance,
    ).toBe(true)
  })

  /** Reported as nothing missing rather than as a negative sum, which the copy would
   *  print with a minus in front of it. */
  it("reports no shortfall when the balance is more than enough", () => {
    expect(
      resolveInvestmentFunding({
        largestWalletUsd: 30000,
        combinedUsd: 30000,
        totalUsd: 25000,
      }),
    ).toEqual({
      balanceUsd: 30000,
      shortfallUsd: 0,
      hasEnoughBalance: true,
      isSplitAcrossWallets: false,
    })
  })

  it("counts an empty balance as the whole amount missing", () => {
    expect(
      resolveInvestmentFunding({ largestWalletUsd: 0, combinedUsd: 0, totalUsd: 25000 })
        .shortfallUsd,
    ).toBe(25000)
  })

  /**
   * An investor holding $370 in dollars and $154 in bitcoin does not hold $500 in any
   * wallet, and the send flow spends from one. What one wallet holds is what decides it.
   */
  it("does not count two wallets added together as covered", () => {
    const funding = resolveInvestmentFunding({
      largestWalletUsd: 370,
      combinedUsd: 524,
      totalUsd: 500,
    })

    expect(funding.hasEnoughBalance).toBe(false)
    expect(funding.shortfallUsd).toBe(130)
  })

  /** The same investor can pay after converting, which is a different answer from
   *  needing to deposit, and the screen offers each in its own case. */
  it("marks a balance that only needs consolidating", () => {
    expect(
      resolveInvestmentFunding({
        largestWalletUsd: 370,
        combinedUsd: 524,
        totalUsd: 500,
      }).isSplitAcrossWallets,
    ).toBe(true)
  })

  it("is not split when neither wallet nor both together are enough", () => {
    expect(
      resolveInvestmentFunding({
        largestWalletUsd: 100,
        combinedUsd: 200,
        totalUsd: 500,
      }).isSplitAcrossWallets,
    ).toBe(false)
  })

  it("is not split when one wallet already covers it", () => {
    expect(
      resolveInvestmentFunding({
        largestWalletUsd: 500,
        combinedUsd: 900,
        totalUsd: 500,
      }).isSplitAcrossWallets,
    ).toBe(false)
  })
})
