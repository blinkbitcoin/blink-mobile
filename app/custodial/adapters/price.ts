import { type PriceRates } from "@app/types/price"

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
