import { SATS_PER_BTC } from "@app/hooks/use-price-conversion"
import { formatUnixTimestampYMDHM } from "@app/utils/date"

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

/** So the figure the signer commits to is exact to the satoshi, not to whatever a float
 *  happens to print. */
const BTC_DECIMALS = 8

/** Honduras keeps a fixed UTC-6 the year round, so the stamp is shifted by hand and then
 *  rendered as UTC. Naming the zone instead would make this the first production caller to
 *  pass one, which `formatUnixTimestampYMDHM` documents as test-only. */
const HONDURAS_UTC_OFFSET_MS = -6 * 60 * 60 * 1000

/**
 * The app prices in satoshis; the agreement is written in bitcoin. Answers null rather
 * than a zero or a NaN, so the caller has one thing to check before quoting a rate a
 * signature will be bound to.
 */
export const resolveSettlementQuote = (
  usdPerSat: string | null,
  at: Date,
): SettlementQuote | null => {
  const btcUsdRate = Number(usdPerSat) * SATS_PER_BTC

  return usdPerSat && btcUsdRate > 0 ? { btcUsdRate, at } : null
}

const formatHondurasTime = (at: Date): string =>
  formatUnixTimestampYMDHM({
    timestampSeconds: (at.getTime() + HONDURAS_UTC_OFFSET_MS) / 1000,
    timezone: "UTC",
  })

export const resolveInvestmentTerms = (
  totalUsd: number,
  settlement: SettlementQuote | null = null,
): InvestmentTerms => ({
  totalUsd,
  units: totalUsd / PRICE_PER_UNIT_USD,
  pricePerUnitUsd: PRICE_PER_UNIT_USD,
  preMoneyValuationUsd: PRE_MONEY_VALUATION_USD,
  ...(settlement && settlement.btcUsdRate > 0
    ? {
        btcUsdRate: settlement.btcUsdRate,
        settlementBtc: Number((totalUsd / settlement.btcUsdRate).toFixed(BTC_DECIMALS)),
        rateTimestamp: formatHondurasTime(settlement.at),
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
