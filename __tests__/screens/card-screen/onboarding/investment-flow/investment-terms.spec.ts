import {
  formatUnitCount,
  formatUsdAmount,
  resolveEquityPercent,
  resolveInvestmentFunding,
  resolveInvestmentTerms,
} from "@app/screens/card-screen/onboarding/investment-flow/investment-terms"
import { MOCK_CREDIT_LIMIT_VALUES } from "@app/screens/card-screen/onboarding/onboarding-mock-data"

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
})

describe("resolveEquityPercent", () => {
  /**
   * The select screen offers each amount alongside the equity it buys, and the term sheet
   * restates that equity for the one the investor picked. Those two have to agree, or the
   * two screens describe different deals, so the percentage derived here is checked against
   * the one every option advertises.
   */
  it("agrees with the equity percentage each option advertises", () => {
    MOCK_CREDIT_LIMIT_VALUES.forEach(({ value, percent }) => {
      expect(resolveEquityPercent(resolveInvestmentTerms(value))).toBeCloseTo(percent, 10)
    })
  })
})

describe("the figures as they are written", () => {
  it("groups an amount the way the select screen groups its options", () => {
    expect(formatUsdAmount(25000)).toBe("$25,000")
  })

  /** A balance converted from satoshis lands on a fraction of a cent, and dollars do not
   *  go that far. A whole amount still prints without a decimal point. */
  it("cuts a converted balance to cents", () => {
    expect(formatUsdAmount(3333.756)).toBe("$3,333.76")
  })

  /** Units are a count, not money, and carry no currency of their own. */
  it("groups a unit count without a currency", () => {
    expect(formatUnitCount(25000)).toBe("25,000")
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
   * Seen on device: an investor holding $370 in dollars and $154 in bitcoin was told the
   * investment was covered and then turned away by the send flow, which spends from one
   * wallet. What one wallet holds is what decides it.
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
