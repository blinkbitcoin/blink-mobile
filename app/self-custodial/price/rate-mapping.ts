import { type FiatRate, type PriceRates } from "@app/types/price"

/**
 * Translates the Breez SDK's fiat feed into the app's own price shape.
 *
 * Only the translation lives here. What a price *is* — {@link PriceRates}, the freshness
 * windows, {@link FiatRate} itself — is in `app/types/price.ts`, so shared code and the
 * custodial adapter can speak it without depending on this module.
 *
 * Pure: no SDK, no storage, no React. The provider owns fetching and persistence.
 */

const SATS_PER_BTC = 100_000_000
const CENTS_PER_USD = 100
const USD = "USD"

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
