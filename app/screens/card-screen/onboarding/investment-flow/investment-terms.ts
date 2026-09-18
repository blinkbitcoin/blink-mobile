import { formatUnixTimestampYMDHM } from "@app/utils/date"
import { toMajorUnit } from "@app/utils/helper"

/**
 * The economics of one investment, derived from the single figure the user picks: what the
 * signer receives, and what they owe for it.
 */
export type InvestmentTerms = {
  totalUsd: number
  units: number
  pricePerUnitUsd: number
  preMoneyValuationUsd: number
  /** The three below are absent until the price feed has answered. The agreement fixes a
   *  rate the payment is then owed at, so a guessed one would be worse than none. */
  btcUsdRate?: number
  settlementBtc?: number
  rateTimestamp?: string
}

/** What the agreement's BTC figures are quoted against: a rate, and the moment it held. */
export type SettlementQuote = {
  btcUsdRate: number
  at: Date
}

/** One unit per dollar, which is what the flow's own copy states ("$10,000 Investment …
 *  You receive 10,000 units"). */
const PRICE_PER_UNIT_USD = 1

/** The valuation every option on the select screen is priced against: $1,000 buys 0.01%
 *  and $100,000 buys 1%, so the whole company is $10M pre-money. */
const PRE_MONEY_VALUATION_USD = 10_000_000

/** The amounts on offer, in dollars. The share of the company each buys is not written
 *  beside them: it follows from the valuation above through `resolveEquityPercent`, the
 *  same way the term sheet states it, so the two screens cannot describe different deals. */
export const INVESTMENT_OPTIONS = [1000, 2500, 5000, 10000, 25000, 50000, 100000]

/** So the figure the signer commits to is exact to the satoshi, not to whatever a float
 *  happens to print. */
export const BTC_DECIMALS = 8

/** The zone the agreement is dated in: the host's, which the document names. Passed
 *  to the formatter by name so the clock is not shifted by hand, and so the stamp stays
 *  right should the zone ever observe daylight saving again. */
const AGREEMENT_TIMEZONE = "America/Tegucigalpa"

/**
 * The price of one bitcoin, taken in whole cents so the rate the agreement states is the
 * one the feed gave, cents included; a price per satoshi to eight decimals would only
 * hold whole dollars. Answers null rather than a zero or a NaN, so the caller has one
 * thing to check before quoting a rate a signature will be bound to.
 */
export const resolveSettlementQuote = (
  usdCentsPerBtc: number | null,
  at: Date,
): SettlementQuote | null => {
  if (usdCentsPerBtc === null || !Number.isFinite(usdCentsPerBtc)) return null
  if (usdCentsPerBtc <= 0) return null

  return { btcUsdRate: toMajorUnit(usdCentsPerBtc), at }
}

const formatAgreementTime = (at: Date): string =>
  formatUnixTimestampYMDHM({
    timestampSeconds: at.getTime() / 1000,
    timezone: AGREEMENT_TIMEZONE,
  })

export const resolveInvestmentTerms = (
  totalUsd: number,
  settlement: SettlementQuote | null = null,
): InvestmentTerms => ({
  totalUsd,
  units: totalUsd / PRICE_PER_UNIT_USD,
  pricePerUnitUsd: PRICE_PER_UNIT_USD,
  preMoneyValuationUsd: PRE_MONEY_VALUATION_USD,
  ...(settlement
    ? {
        btcUsdRate: settlement.btcUsdRate,
        settlementBtc: Number((totalUsd / settlement.btcUsdRate).toFixed(BTC_DECIMALS)),
        rateTimestamp: formatAgreementTime(settlement.at),
      }
    : {}),
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
