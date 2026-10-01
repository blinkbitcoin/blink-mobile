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
 * **Units are the whole difficulty here, and the two sources disagree.** Breez reports
 * `Rate.value` as the price of one whole BTC in whole units of `coin` — 10,118,784 for
 * naira. The app works in *minor* units throughout: a `DisplayCurrency` money amount
 * holds kobo, not naira (`moneyAmountToMajorUnitOrSats` divides by `fractionDigits` on
 * the way out), and the backend's own `realtimePrice` says so in its type names —
 * `PriceOfOneSatInMinorUnit`, `PriceOfOneUsdCentInMinorUnit`. So every rate out of the
 * Breez feed has to be scaled by `10 ** fractionDigits` to mean the same thing as one
 * out of the backend. Without it every self-custodial fiat amount reads 100× too small
 * on a two-decimal currency.
 *
 * `fractionDigits` is therefore required, not defaulted: guessing two would silently
 * misprice the zero-decimal currencies (yen, won, franc CFA) rather than failing.
 *
 * The cent ratio needs the USD rate as well, since the app's USD wallet is denominated
 * in cents rather than in the display currency. A display currency of USD short-circuits
 * rather than dividing the same rate by itself, which would leave float noise in every
 * dollar amount on screen.
 */
export const toPriceRates = (
  rates: readonly FiatRate[],
  displayCurrency: string,
  fractionDigits: number,
): PriceRates | undefined => {
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0) return undefined

  const displayRate = findUsableRate(rates, displayCurrency)
  if (displayRate === undefined) return undefined

  /** Whole display units per BTC → minor display units per sat. */
  const minorUnitsPerMajor = 10 ** fractionDigits
  const displayCurrencyPerSat = (displayRate * minorUnitsPerMajor) / SATS_PER_BTC

  if (displayCurrency.toUpperCase() === USD) {
    // One US cent priced in US cents. Exactly one, whatever the float would have said.
    return { displayCurrencyPerSat, displayCurrencyPerCent: 1 }
  }

  const usdRate = findUsableRate(rates, USD)
  if (usdRate === undefined) return undefined

  return {
    displayCurrencyPerSat,
    /** Whole display units per USD → minor display units per US cent. */
    displayCurrencyPerCent:
      ((displayRate / usdRate) * minorUnitsPerMajor) / CENTS_PER_USD,
  }
}
