import {
  formatUnitCount,
  formatUsdAmount,
  resolveEquityPercent,
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

  /** Units are a count, not money, and carry no currency of their own. */
  it("groups a unit count without a currency", () => {
    expect(formatUnitCount(25000)).toBe("25,000")
  })
})
