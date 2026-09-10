/**
 * The economics of one investment, derived from the single figure the user picks: what the
 * signer receives, and what they owe for it.
 */
export type InvestmentTerms = {
  totalUsd: number
  units: number
  pricePerUnitUsd: number
  preMoneyValuationUsd: number
}

/** One unit per dollar, which is what the flow's own copy states ("$10,000 Investment …
 *  You receive 10,000 units"). */
const PRICE_PER_UNIT_USD = 1

/** The valuation every option on the select screen is priced against: $1,000 buys 0.01%
 *  and $100,000 buys 1%, so the whole company is $10M pre-money. */
const PRE_MONEY_VALUATION_USD = 10_000_000

export const resolveInvestmentTerms = (totalUsd: number): InvestmentTerms => ({
  totalUsd,
  units: totalUsd / PRICE_PER_UNIT_USD,
  pricePerUnitUsd: PRICE_PER_UNIT_USD,
  preMoneyValuationUsd: PRE_MONEY_VALUATION_USD,
})

/** Whether the investor can pay for what they signed for, and what is missing if not. */
export type InvestmentFunding = {
  balanceUsd: number
  shortfallUsd: number
  hasEnoughBalance: boolean
}

/**
 * Measured in dollars, which is the currency the agreement is written in: the balance is
 * shown to the investor in whatever currency they chose to read it in, and that choice
 * has no bearing on whether the amount is covered.
 *
 * The shortfall never goes below zero, so a covered investment reads as nothing missing
 * rather than as a negative sum the copy would print with a minus.
 */
export const resolveInvestmentFunding = ({
  balanceUsd,
  totalUsd,
}: {
  balanceUsd: number
  totalUsd: number
}): InvestmentFunding => ({
  balanceUsd,
  shortfallUsd: Math.max(totalUsd - balanceUsd, 0),
  hasEnoughBalance: balanceUsd >= totalUsd,
})

/** The share of the company the terms buy, which the term sheet states beside the units. */
export const resolveEquityPercent = ({
  totalUsd,
  preMoneyValuationUsd,
}: InvestmentTerms): number => (totalUsd / preMoneyValuationUsd) * 100

/**
 * Grouped the way the select screen writes its options, so the amount the signer chose
 * reads the same on the screens that follow.
 *
 * Cut to cents, which is as far as dollars go: the chosen amounts are whole and print
 * unchanged, but a balance converted from satoshis carries a tail that would otherwise
 * reach the screen as $3,333.756.
 */
export const formatUsdAmount = (amount: number): string =>
  `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

/** Grouped for the same reason, but without the currency the units are not counted in. */
export const formatUnitCount = (units: number): string => units.toLocaleString()
