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

/** Whether the investor can pay for what they signed for, and what stands in the way. */
export type InvestmentFunding = {
  /** The fullest single wallet, which is the one that has to cover the payment. */
  balanceUsd: number
  shortfallUsd: number
  hasEnoughBalance: boolean
  /** Held between the two wallets, but not in either alone. */
  isSplitAcrossWallets: boolean
}

/**
 * Measured against **one** wallet, not the two added together, because that is what a
 * payment can draw on: the send flow spends from a single wallet, so an investor holding
 * half the amount in each is turned away at it however healthy the total looks.
 *
 * Dollars, which is the currency the agreement is written in: the balance is shown to the
 * investor in whatever currency they chose to read it in, and that choice has no bearing
 * on whether the amount is covered.
 *
 * The shortfall never goes below zero, so a covered investment reads as nothing missing
 * rather than as a negative sum the copy would print with a minus.
 */
export const resolveInvestmentFunding = ({
  largestWalletUsd,
  combinedUsd,
  totalUsd,
}: {
  largestWalletUsd: number
  combinedUsd: number
  totalUsd: number
}): InvestmentFunding => {
  const hasEnoughBalance = largestWalletUsd >= totalUsd

  return {
    balanceUsd: largestWalletUsd,
    shortfallUsd: Math.max(totalUsd - largestWalletUsd, 0),
    hasEnoughBalance,
    isSplitAcrossWallets: !hasEnoughBalance && combinedUsd >= totalUsd,
  }
}

/** The share of the company the terms buy, which the term sheet states beside the units. */
export const resolveEquityPercent = ({
  totalUsd,
  preMoneyValuationUsd,
}: InvestmentTerms): number => (totalUsd / preMoneyValuationUsd) * 100

/**
 * The locale every figure of the flow is written in: the one the rest of the app formats
 * money in. Left unnamed, `toLocaleString` goes through the number-format polyfill the
 * app installs in `i18n/mapping.ts`, whose default is whichever locale data loaded
 * first rather than the device's, and every phone printed $25 000 here while the rest
 * of the app printed $25,000.00.
 */
const FIGURE_LOCALE = "en-US"

/**
 * Grouped the way the select screen writes its options, so the amount the signer chose
 * reads the same on every screen of the flow, from the option they tap to the transfer.
 *
 * Cut to cents, which is as far as dollars go: the chosen amounts are whole and print
 * unchanged, but the shortfall is the amount less the balance, and that subtraction
 * leaves a floating-point tail: 25000 - 3333.76 is 21666.239999999998, which would
 * otherwise reach the screen as is.
 */
export const formatUsdAmount = (amount: number): string =>
  `$${amount.toLocaleString(FIGURE_LOCALE, { maximumFractionDigits: 2 })}`

/** Grouped for the same reason, but without the currency the units are not counted in. */
export const formatUnitCount = (units: number): string =>
  units.toLocaleString(FIGURE_LOCALE)
