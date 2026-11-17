import {
  rateFreshness,
  RateFreshness,
  type PriceRates,
  type PriceSource,
} from "@app/types/price"

const MS_PER_SECOND = 1000

/**
 * Translates the backend's `realtimePrice` into the app's own price shape, so both
 * sources reach the conversion layer identically.
 *
 * It lives beside the other custodial adapters because `realtimePrice` is the custodial
 * backend's shape; it spent one release under `app/self-custodial/` purely because that
 * is where the second source was being built at the time.
 */
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

export type RealtimePrice = {
  denominatorCurrency: string
  /** When the backend served it, in Unix seconds like every backend `Timestamp`. */
  timestamp: number
  btcSatPrice: { base: number; offset: number }
  usdCentPrice: { base: number; offset: number }
}

/**
 * A {@link PriceSource} over the backend's `realtimePrice`.
 *
 * A price whose denominator disagrees with the active preference is discarded rather
 * than converted: the cache can still be serving the previous currency's answer just
 * after the user changes it, and converting with it would silently quote the wrong
 * money.
 *
 * Always {@link RateFreshness.Fresh} when it has rates, which is how a custodial session
 * reads it: the backend is its only source and there is no sats fallback behind it, so
 * withholding an old price would leave every amount on a spinner, and judging the
 * server's timestamp against the device clock would let a wrong clock do the same.
 */
export const createCustodialPriceSource = (
  price: RealtimePrice | undefined,
  displayCurrency: string,
  hasSettled: boolean,
): PriceSource => {
  const usable = price?.denominatorCurrency === displayCurrency ? price : undefined
  const rates = usable ? toPriceRatesFromRealtimePrice(usable) : undefined
  return {
    rates,
    freshness: rates ? RateFreshness.Fresh : RateFreshness.Expired,
    hasSettled,
  }
}

/**
 * The backend's price as a self-custodial session reads it: behind the SDK feed, and
 * aged by its own timestamp under the same windows as that feed.
 *
 * The Apollo cache keeps the last answer when a refresh fails, so with the feed expired
 * and Blink unreachable the answer still on hand can be days old. Read as current, it
 * would keep pricing indefinitely; aged, it reads stale past an hour and is withheld
 * past a day, which lets sats-only mode take over. A wrong device clock costs a
 * self-custodial session the fallback, not its amounts: they are then stated in sats.
 */
export const createFallbackPriceSource = ({
  price,
  displayCurrency,
  hasSettled,
  now,
}: {
  price: RealtimePrice | undefined
  displayCurrency: string
  hasSettled: boolean
  /** Unix milliseconds, the clock the timestamp is aged against. */
  now: number
}): PriceSource => {
  const source = createCustodialPriceSource(price, displayCurrency, hasSettled)
  if (!price || !source.rates) return source

  const freshness = rateFreshness(price.timestamp * MS_PER_SECOND, now)
  return {
    rates: freshness === RateFreshness.Expired ? undefined : source.rates,
    freshness,
    hasSettled,
  }
}
