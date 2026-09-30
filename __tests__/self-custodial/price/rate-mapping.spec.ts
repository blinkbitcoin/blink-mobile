import { describe, expect, it } from "@jest/globals"

import { toPriceRates } from "@app/self-custodial/price/rate-mapping"
import { type FiatRate } from "@app/types/price"

const SATS_PER_BTC = 100_000_000

/** `Rate.value` is the price of one whole BTC denominated in `coin`. */
const feed: FiatRate[] = [
  { coin: "USD", value: 100_000 },
  { coin: "NGN", value: 150_000_000 },
  { coin: "EUR", value: 90_000 },
]

describe("toPriceRates", () => {
  it("prices a sat in the display currency", () => {
    const rates = toPriceRates(feed, "NGN")

    expect(rates?.displayCurrencyPerSat).toBeCloseTo(150_000_000 / SATS_PER_BTC, 12)
  })

  it("prices a USD cent in the display currency via the USD anchor", () => {
    const rates = toPriceRates(feed, "NGN")

    // One USD is 1500 NGN here, so one cent is 15 NGN.
    expect(rates?.displayCurrencyPerCent).toBeCloseTo(15, 12)
  })

  it("gives USD an exact hundredth rather than dividing the rate by itself", () => {
    const rates = toPriceRates(feed, "USD")

    // Not `toBeCloseTo`: the point of the short-circuit is that there is no float noise
    // left to round away in every dollar amount on screen.
    expect(rates?.displayCurrencyPerCent).toBe(0.01)
    expect(rates?.displayCurrencyPerSat).toBe(100_000 / SATS_PER_BTC)
  })

  it("matches the currency code regardless of the feed's casing", () => {
    const rates = toPriceRates([{ coin: "ngn", value: 150_000_000 }, feed[0]], "NGN")

    expect(rates?.displayCurrencyPerSat).toBeCloseTo(150_000_000 / SATS_PER_BTC, 12)
  })

  it("returns undefined when the feed cannot price the display currency", () => {
    // Nothing, rather than zero: every amount derived from a missing rate would
    // otherwise read as free.
    expect(toPriceRates(feed, "ZWL")).toBeUndefined()
  })

  it("returns undefined when the USD anchor is missing", () => {
    expect(toPriceRates([{ coin: "NGN", value: 150_000_000 }], "NGN")).toBeUndefined()
  })

  it("rejects a zero USD anchor instead of dividing into Infinity", () => {
    const broken: FiatRate[] = [
      { coin: "USD", value: 0 },
      { coin: "NGN", value: 150_000_000 },
    ]

    expect(toPriceRates(broken, "NGN")).toBeUndefined()
  })

  it("rejects a negative or non-finite rate for the display currency", () => {
    expect(toPriceRates([{ coin: "USD", value: -1 }], "USD")).toBeUndefined()
    expect(toPriceRates([{ coin: "USD", value: Number.NaN }], "USD")).toBeUndefined()
    expect(
      toPriceRates([{ coin: "USD", value: Number.POSITIVE_INFINITY }], "USD"),
    ).toBeUndefined()
  })

  it("returns undefined for an empty feed", () => {
    expect(toPriceRates([], "USD")).toBeUndefined()
  })
})
