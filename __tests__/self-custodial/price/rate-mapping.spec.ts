import { describe, expect, it } from "@jest/globals"

import { toPriceRatesFromRealtimePrice } from "@app/custodial/adapters/price"
import { toPriceRates } from "@app/self-custodial/price/rate-mapping"
import { type FiatRate } from "@app/types/price"

const SATS_PER_BTC = 100_000_000

/**
 * Breez reports `Rate.value` as the price of one whole BTC in whole units of `coin`.
 * The app works in minor units — the backend says so in its own type names,
 * `PriceOfOneSatInMinorUnit` and `PriceOfOneUsdCentInMinorUnit` — so the feed has to be
 * scaled on the way in. These numbers are the same market as `mockPriceData` in
 * `__tests__/hooks/use-price-conversion.spec.ts`, so the two sources can be compared
 * directly below.
 */
const NGN_PER_BTC = 10_118_784
const NGN_PER_USD = 460.434879
const feed: FiatRate[] = [
  { coin: "USD", value: NGN_PER_BTC / NGN_PER_USD },
  { coin: "NGN", value: NGN_PER_BTC },
]

/** Blink's own answer for that market, in minor units, from the same fixture. */
const blink = toPriceRatesFromRealtimePrice({
  btcSatPrice: { base: 10118784000000, offset: 12 },
  usdCentPrice: { base: 460434879, offset: 6 },
})

describe("toPriceRates", () => {
  /**
   * The regression that motivated this file's shape. The mapping originally divided the
   * whole-unit rate by `SATS_PER_BTC` and stopped, which gives naira per sat where the
   * app wants kobo per sat — every self-custodial fiat amount read 100× too small, and
   * no test noticed because they all asserted the same wrong arithmetic. Comparing
   * against the other source for the same market is what makes that impossible.
   */
  it("agrees with the backend's own numbers for the same market", () => {
    const rates = toPriceRates(feed, "NGN", 2)

    expect(rates?.displayCurrencyPerSat).toBeCloseTo(blink!.displayCurrencyPerSat, 6)
    expect(rates?.displayCurrencyPerCent).toBeCloseTo(blink!.displayCurrencyPerCent, 6)
  })

  it("prices a sat in the display currency's minor unit", () => {
    const rates = toPriceRates(feed, "NGN", 2)

    // 10,118,784 naira per BTC is 1,011,878,400 kobo per BTC, so ~10.12 kobo per sat.
    expect(rates?.displayCurrencyPerSat).toBeCloseTo(
      (NGN_PER_BTC * 100) / SATS_PER_BTC,
      9,
    )
  })

  it("prices a US cent in the display currency's minor unit, via the USD anchor", () => {
    const rates = toPriceRates(feed, "NGN", 2)

    // 460.43 naira per dollar is 4.60 naira per cent, so ~460 kobo per cent.
    expect(rates?.displayCurrencyPerCent).toBeCloseTo(NGN_PER_USD, 6)
  })

  it("prices a US cent in US cents as exactly one", () => {
    const rates = toPriceRates([{ coin: "USD", value: 100_000 }], "USD", 2)

    // Not `toBeCloseTo`: the short-circuit exists so no float noise reaches a dollar
    // amount on screen.
    expect(rates?.displayCurrencyPerCent).toBe(1)
    expect(rates?.displayCurrencyPerSat).toBe((100_000 * 100) / SATS_PER_BTC)
  })

  it("scales by the currency's own fraction size, not a fixed two", () => {
    // Yen has none. Guessing two would have overstated every amount a hundredfold.
    const jpy: FiatRate[] = [
      { coin: "USD", value: 100_000 },
      { coin: "JPY", value: 15_000_000 },
    ]

    expect(toPriceRates(jpy, "JPY", 0)?.displayCurrencyPerSat).toBeCloseTo(0.15, 12)
    expect(toPriceRates(jpy, "JPY", 0)?.displayCurrencyPerCent).toBeCloseTo(1.5, 12)
  })

  it("refuses a fraction size that is not a whole count", () => {
    expect(toPriceRates(feed, "NGN", -1)).toBeUndefined()
    expect(toPriceRates(feed, "NGN", 1.5)).toBeUndefined()
  })

  it("matches the currency code regardless of the feed's casing", () => {
    const rates = toPriceRates([{ coin: "ngn", value: NGN_PER_BTC }, feed[0]], "NGN", 2)

    expect(rates?.displayCurrencyPerSat).toBeCloseTo(
      (NGN_PER_BTC * 100) / SATS_PER_BTC,
      9,
    )
  })

  it("returns undefined when the feed cannot price the display currency", () => {
    // Nothing, rather than zero: every amount derived from a missing rate would
    // otherwise read as free.
    expect(toPriceRates(feed, "ZWL", 2)).toBeUndefined()
  })

  it("returns undefined when the USD anchor is missing", () => {
    expect(toPriceRates([{ coin: "NGN", value: NGN_PER_BTC }], "NGN", 2)).toBeUndefined()
  })

  it("rejects a zero USD anchor instead of dividing into Infinity", () => {
    const broken: FiatRate[] = [
      { coin: "USD", value: 0 },
      { coin: "NGN", value: NGN_PER_BTC },
    ]

    expect(toPriceRates(broken, "NGN", 2)).toBeUndefined()
  })

  it("rejects a negative or non-finite rate for the display currency", () => {
    expect(toPriceRates([{ coin: "USD", value: -1 }], "USD", 2)).toBeUndefined()
    expect(toPriceRates([{ coin: "USD", value: Number.NaN }], "USD", 2)).toBeUndefined()
    expect(
      toPriceRates([{ coin: "USD", value: Number.POSITIVE_INFINITY }], "USD", 2),
    ).toBeUndefined()
  })

  it("returns undefined for an empty feed", () => {
    expect(toPriceRates([], "USD", 2)).toBeUndefined()
  })
})
