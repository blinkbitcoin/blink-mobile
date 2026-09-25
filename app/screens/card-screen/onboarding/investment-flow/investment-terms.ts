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

/** How the stamp names that zone on the document: as its offset, which reads the same
 *  to every party and is the same on every device, where a zone's short name is
 *  whatever the phone's own locale data says, or nothing at all. Fixed, because
 *  Honduras keeps UTC-6 all year; the clock above is still shifted by zone name, so
 *  the time stays right should the zone ever observe daylight saving again, and this
 *  label is what would then have to move with it. */
const AGREEMENT_TIMEZONE_LABEL = "UTC-06:00"

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

/** The stamp says which clock fixed the rate; a bare wall-clock time on a binding
 *  document says nothing. */
const formatAgreementTime = (at: Date): string =>
  `${formatUnixTimestampYMDHM({
    timestampSeconds: at.getTime() / 1000,
    timezone: AGREEMENT_TIMEZONE,
  })} ${AGREEMENT_TIMEZONE_LABEL}`

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
