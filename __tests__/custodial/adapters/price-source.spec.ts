import { describe, expect, it } from "@jest/globals"

import {
  createCustodialPriceSource,
  createFallbackPriceSource,
} from "@app/custodial/adapters/price"
import { RateFreshness } from "@app/types/price"

const NOW_MS = 1_800_000_000_000
const NOW_SECONDS = NOW_MS / 1000
const SECONDS_PER_HOUR = 60 * 60

const ngnPrice = {
  denominatorCurrency: "NGN",
  timestamp: NOW_SECONDS,
  btcSatPrice: { base: 1_500_000_000, offset: 12 },
  usdCentPrice: { base: 1_500_000_000, offset: 8 },
}

describe("createCustodialPriceSource", () => {
  it("prices the display currency off the backend's answer", () => {
    const source = createCustodialPriceSource(ngnPrice, "NGN", true)

    expect(source.rates?.displayCurrencyPerSat).toBeCloseTo(0.0015, 12)
    expect(source.freshness).toBe(RateFreshness.Fresh)
  })

  it("discards a price whose denominator disagrees with the preference", () => {
    // The cache can still be serving the previous currency just after the user changes
    // it; converting with it would quote the wrong money without saying so.
    expect(createCustodialPriceSource(ngnPrice, "EUR", true).rates).toBeUndefined()
  })

  it("prices nothing when the backend has answered nothing", () => {
    const source = createCustodialPriceSource(undefined, "NGN", true)

    expect(source.rates).toBeUndefined()
    expect(source.freshness).toBe(RateFreshness.Expired)
  })

  it("reports that it is still trying while the query is in flight", () => {
    expect(createCustodialPriceSource(undefined, "NGN", false).hasSettled).toBe(false)
  })

  it("never reads stale, since a custodial session has no fallback behind it", () => {
    const servedTwoDaysAgo = {
      ...ngnPrice,
      timestamp: NOW_SECONDS - 48 * SECONDS_PER_HOUR,
    }

    expect(createCustodialPriceSource(servedTwoDaysAgo, "NGN", true).freshness).toBe(
      RateFreshness.Fresh,
    )
  })
})

describe("createFallbackPriceSource", () => {
  const servedHoursAgo = (hours: number) => ({
    ...ngnPrice,
    timestamp: NOW_SECONDS - hours * SECONDS_PER_HOUR,
  })

  it("prices off an answer served within the hour as fresh", () => {
    const source = createFallbackPriceSource({
      price: servedHoursAgo(0.5),
      displayCurrency: "NGN",
      hasSettled: true,
      now: NOW_MS,
    })

    expect(source.rates?.displayCurrencyPerSat).toBeCloseTo(0.0015, 12)
    expect(source.freshness).toBe(RateFreshness.Fresh)
  })

  it("still prices off an answer served hours ago, and says it is stale", () => {
    const source = createFallbackPriceSource({
      price: servedHoursAgo(3),
      displayCurrency: "NGN",
      hasSettled: true,
      now: NOW_MS,
    })

    expect(source.rates).toBeDefined()
    expect(source.freshness).toBe(RateFreshness.Stale)
  })

  it("withholds an answer older than a day, as the feed does", () => {
    const source = createFallbackPriceSource({
      price: servedHoursAgo(48),
      displayCurrency: "NGN",
      hasSettled: true,
      now: NOW_MS,
    })

    expect(source.rates).toBeUndefined()
    expect(source.freshness).toBe(RateFreshness.Expired)
    expect(source.hasSettled).toBe(true)
  })

  it("reads an answer stamped ahead of the device clock as fresh", () => {
    const source = createFallbackPriceSource({
      price: servedHoursAgo(-2),
      displayCurrency: "NGN",
      hasSettled: true,
      now: NOW_MS,
    })

    expect(source.freshness).toBe(RateFreshness.Fresh)
  })

  it("discards a price whose denominator disagrees with the preference", () => {
    expect(
      createFallbackPriceSource({
        price: ngnPrice,
        displayCurrency: "EUR",
        hasSettled: true,
        now: NOW_MS,
      }).rates,
    ).toBeUndefined()
  })

  it("prices nothing and keeps trying while the backend has answered nothing", () => {
    const source = createFallbackPriceSource({
      price: undefined,
      displayCurrency: "NGN",
      hasSettled: false,
      now: NOW_MS,
    })

    expect(source.rates).toBeUndefined()
    expect(source.hasSettled).toBe(false)
  })
})
