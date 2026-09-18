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

    expect(MOCK_CREDIT_LIMIT_VALUES).toEqual([...advertised.keys()])
    MOCK_CREDIT_LIMIT_VALUES.forEach((value) => {
      expect(resolveEquityPercent(resolveInvestmentTerms(value))).toBe(
        advertised.get(value),
      )
    })
  })
})

describe("the figures as they are written", () => {
  it("groups an amount the way the select screen groups its options", () => {
    expect(formatUsdAmount(25000)).toBe("$25,000")
    expect(formatUsdAmount(100000)).toBe("$100,000")
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
