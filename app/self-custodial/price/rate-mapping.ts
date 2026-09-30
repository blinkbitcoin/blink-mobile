/**
 * Turns the SDK's fiat feed into the two ratios `usePriceConversion` works in, and
 * decides how old a stored feed may be before the amounts priced off it stop being
 * presented as current.
 *
 * Pure: no SDK, no storage, no React. The provider owns fetching and persistence.
 */

/** One entry of the SDK's feed: the price of a whole BTC, denominated in `coin`. */
export type FiatRate = {
  coin: string
  value: number
}

/** What the conversion layer actually consumes. Both are "how much display currency", so
 *  a display currency of USD gives `displayCurrencyPerCent` of exactly 0.01. */
export type PriceRates = {
  displayCurrencyPerSat: number
  displayCurrencyPerCent: number
}

export type StoredFiatRates = {
  rates: FiatRate[]
  /** Unix milliseconds, from the device clock at the moment the feed was read. */
  fetchedAt: number
}

const SATS_PER_BTC = 100_000_000
const CENTS_PER_USD = 100
const USD = "USD"

/** Fresh enough to show without qualification. */
export const RATES_FRESH_MS = 60 * 60 * 1000

/**
 * Past {@link RATES_FRESH_MS} and within this, amounts are still shown but marked as
 * priced off an old rate. Beyond it the fiat figure is withheld and amounts fall back to
 * sats, because a day-old rate presented as today's is worse than no figure at all.
 *
 * A day rather than an hour because the people most likely to be offline for long — a
 * merchant at a stall, anyone on intermittent signal — would rather see yesterday's
 * number than a blank, and because the alternative is not a better number but none.
 */
export const RATES_USABLE_MS = 24 * 60 * 60 * 1000

export const RateFreshness = {
  Fresh: "fresh",
  Stale: "stale",
  Expired: "expired",
} as const

export type RateFreshness = (typeof RateFreshness)[keyof typeof RateFreshness]

export const rateFreshness = (fetchedAt: number, now: number): RateFreshness => {
  /** A clock that moved backwards (travel, NTP correction, a user setting the date) puts
   *  the read in the future. Treat that as fresh rather than expired: the feed was read
   *  this session, and expiring it would blank a figure the app just fetched. */
  const age = now - fetchedAt
  if (age < RATES_FRESH_MS) return RateFreshness.Fresh
  if (age < RATES_USABLE_MS) return RateFreshness.Stale
  return RateFreshness.Expired
}

/** Currency codes are ASCII and the feed's casing is not guaranteed, so compare folded. */
const matchesCoin = (rate: FiatRate, coin: string): boolean =>
  rate.coin.toUpperCase() === coin.toUpperCase()

const findUsableRate = (rates: readonly FiatRate[], coin: string): number | undefined => {
  const match = rates.find((rate) => matchesCoin(rate, coin))
  if (!match) return undefined
  /** A zero or negative rate is not a cheap bitcoin, it is a broken feed entry, and a
   *  zero USD anchor would divide into Infinity rather than fail. */
  if (!Number.isFinite(match.value) || match.value <= 0) return undefined
  return match.value
}

/**
 * Undefined when the feed cannot price this display currency, which the caller must
 * treat as "no price" rather than as zero: every amount derived from a missing rate
 * would otherwise read as free.
 *
 * The cent ratio needs the USD rate as well, since the app's USD wallet is denominated
 * in cents rather than in the display currency. A display currency of USD short-circuits
 * to an exact hundredth instead of dividing the same rate by itself, which would leave
 * float noise in every dollar amount on screen.
 */
export const toPriceRates = (
  rates: readonly FiatRate[],
  displayCurrency: string,
): PriceRates | undefined => {
  const displayRate = findUsableRate(rates, displayCurrency)
  if (displayRate === undefined) return undefined

  const displayCurrencyPerSat = displayRate / SATS_PER_BTC

  if (displayCurrency.toUpperCase() === USD) {
    return { displayCurrencyPerSat, displayCurrencyPerCent: 1 / CENTS_PER_USD }
  }

  const usdRate = findUsableRate(rates, USD)
  if (usdRate === undefined) return undefined

  return {
    displayCurrencyPerSat,
    displayCurrencyPerCent: displayRate / usdRate / CENTS_PER_USD,
  }
}

/** The same two ratios as they arrive from the backend's `realtimePrice`, so both
 *  sources reach the conversion layer in one shape. */
export const toPriceRatesFromRealtimePrice = (price: {
  btcSatPrice: { base: number; offset: number }
  usdCentPrice: { base: number; offset: number }
}): PriceRates | undefined => {
  const displayCurrencyPerSat = price.btcSatPrice.base / 10 ** price.btcSatPrice.offset
  const displayCurrencyPerCent = price.usdCentPrice.base / 10 ** price.usdCentPrice.offset
  if (!Number.isFinite(displayCurrencyPerSat) || displayCurrencyPerSat <= 0) {
    return undefined
  }
  if (!Number.isFinite(displayCurrencyPerCent) || displayCurrencyPerCent <= 0) {
    return undefined
  }
  return { displayCurrencyPerSat, displayCurrencyPerCent }
}
