import { RateFreshness, type PriceRates, type PriceSource } from "@app/types/price"

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
 * Always {@link RateFreshness.Fresh} when it has rates. Unlike the SDK feed there is no
 * persisted copy to inherit, so anything this source returns was fetched this session.
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
