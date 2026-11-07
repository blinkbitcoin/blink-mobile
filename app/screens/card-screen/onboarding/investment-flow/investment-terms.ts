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

/** The stamp is the bare "YYYY-MM-DD HH:mm" the host checks the figures against, which it
 *  reads in that zone and refuses with anything appended. The document names the zone in
 *  the field's own label ("Rate Timestamp (Honduras Time)"), so the value carries none. */
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
  /** The wallet the payment would draw on: the one that covers it, or the fullest. */
  balanceUsd: number
  shortfallUsd: number
  hasEnoughBalance: boolean
  /** Held between the two wallets, but not in either alone. */
  isSplitAcrossWallets: boolean
}

/**
 * What a conversion costs on the way, as a share of the amount: the spread between the
 * two sides of the price. Funds spread over both wallets are only worth consolidating
 * when the two together clear the debt by at least this much, or the investor converts,
 * lands short by the spread, and the card they followed turns from "convert" into
 * "deposit the remaining amount".
 */
export const CONVERSION_SPREAD_ALLOWANCE = 0.01

/**
 * Measured against **one** wallet, not the two added together, because that is what a
 * payment can draw on: the send flow spends from a single wallet, so an investor holding
 * half the amount in each is turned away at it however healthy the total looks.
 *
 * Dollars, which is the currency the agreement is written in: the balance is shown to the
 * investor in whatever currency they chose to read it in, and that choice has no bearing
 * on whether the amount is covered. Whether the wallet covers the debt is decided by the
 * caller, which knows the debt in the wallet's own currency; here it is only carried.
 *
 * The shortfall never goes below zero, so a covered investment reads as nothing missing
 * rather than as a negative sum the copy would print with a minus.
 */
export const resolveInvestmentFunding = ({
  balanceUsd,
  isBalanceCovering,
  combinedUsd,
  totalUsd,
}: {
  balanceUsd: number
  isBalanceCovering: boolean
  combinedUsd: number
  totalUsd: number
}): InvestmentFunding => ({
  balanceUsd,
  shortfallUsd: Math.max(totalUsd - balanceUsd, 0),
  hasEnoughBalance: isBalanceCovering,
  isSplitAcrossWallets:
    !isBalanceCovering && combinedUsd >= totalUsd * (1 + CONVERSION_SPREAD_ALLOWANCE),
})

/** The share of the company the terms buy, which the term sheet states beside the units. */
export const resolveEquityPercent = ({
  totalUsd,
  preMoneyValuationUsd,
}: InvestmentTerms): number => (totalUsd / preMoneyValuationUsd) * 100
