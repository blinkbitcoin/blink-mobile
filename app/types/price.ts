/**
 * What a price is to this app, independent of who supplies one.
 *
 * Statements about money and time, not about Breez or about Blink: both the SDK feed
 * and the backend's `realtimePrice` are translated into these by their own adapters
 * (`app/self-custodial/adapters/price.ts`, `app/custodial/adapters/price.ts`), so shared
 * code can price an amount without knowing which account type is active.
 */

/** One entry of a fiat feed: the price of a whole BTC, denominated in `coin`. */
export type FiatRate = {
  coin: string
  value: number
}

/** What the conversion layer consumes. Both are "how much display currency", so a
 *  display currency of USD gives `displayCurrencyPerCent` of exactly 0.01. */
export type PriceRates = {
  displayCurrencyPerSat: number
  displayCurrencyPerCent: number
}

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

/**
 * A place a price can come from — the port both account types implement.
 *
 * `app/self-custodial/adapters/price.ts` builds one over the Breez feed and the copy
 * this device persisted; `app/custodial/adapters/price.ts` over the backend's
 * `realtimePrice`. Shared code selects between them and never learns which answered.
 */
export type PriceSource = {
  /** Undefined when this source cannot price the display currency. Never zero: an
   *  amount derived from a missing rate would read as free. */
  rates: PriceRates | undefined
  freshness: RateFreshness
  /** Whether this source has finished trying, so a caller can tell "not yet" from
   *  "not coming" and stop spinning on a rate that will never arrive. */
  hasSettled: boolean
}

/** A source that can price nothing and has nothing left to try. */
export const noPriceSource: PriceSource = Object.freeze({
  rates: undefined,
  freshness: RateFreshness.Expired,
  hasSettled: true,
})

/**
 * The first source that could price the currency, or — when none could — the last, so
 * the caller still learns whether anything is still trying.
 *
 * Order is preference. Adding a third source is appending to the call, which is the
 * whole reason this is a list rather than a chain of `??`.
 */
export const firstPricedSource = (...sources: PriceSource[]): PriceSource =>
  sources.find((source) => source.rates !== undefined) ??
  sources[sources.length - 1] ??
  noPriceSource
