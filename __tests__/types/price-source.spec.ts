import { describe, expect, it } from "@jest/globals"

import {
  firstPricedSource,
  noPriceSource,
  RateFreshness,
  type PriceSource,
} from "@app/types/price"

/**
 * The selection rule that used to be a chain of `??` in the middle of a 220-line hook.
 * Pure, so these need no mocks and no React.
 */

const source = (
  rates: PriceSource["rates"],
  freshness: RateFreshness = RateFreshness.Fresh,
  hasSettled = true,
): PriceSource => ({ rates, freshness, hasSettled })

const priced = { displayCurrencyPerSat: 1.5, displayCurrencyPerCent: 15 }
const otherPriced = { displayCurrencyPerSat: 0.75, displayCurrencyPerCent: 7.5 }

describe("firstPricedSource", () => {
  it("takes the first source that can price the currency", () => {
    expect(firstPricedSource(source(priced), source(otherPriced)).rates).toBe(priced)
  })

  it("falls through a source that cannot", () => {
    expect(firstPricedSource(source(undefined), source(otherPriced)).rates).toBe(
      otherPriced,
    )
  })

  it("carries the freshness of whichever answered, not of the first", () => {
    const stale = source(priced, RateFreshness.Stale)
    const fresh = source(otherPriced, RateFreshness.Fresh)

    expect(firstPricedSource(stale, fresh).freshness).toBe(RateFreshness.Stale)
    expect(firstPricedSource(source(undefined), fresh).freshness).toBe(
      RateFreshness.Fresh,
    )
  })

  it("returns the last source when none can price, so the caller still learns whether anything is trying", () => {
    const stillTrying = source(undefined, RateFreshness.Expired, false)

    expect(firstPricedSource(source(undefined), stillTrying).hasSettled).toBe(false)
  })

  it("reads as settled when every source has given up", () => {
    expect(firstPricedSource(source(undefined), source(undefined)).hasSettled).toBe(true)
  })

  it("takes a third source as an extra argument", () => {
    // The reason this is a list rather than a chain: a cached third-party feed or a
    // terminal's own rate is an append here, not an edit downstream.
    expect(
      firstPricedSource(source(undefined), source(undefined), source(priced)).rates,
    ).toBe(priced)
  })

  it("degrades to nothing when given no sources at all", () => {
    expect(firstPricedSource()).toBe(noPriceSource)
  })
})

describe("noPriceSource", () => {
  it("prices nothing and has nothing left to try", () => {
    expect(noPriceSource.rates).toBeUndefined()
    expect(noPriceSource.hasSettled).toBe(true)
  })

  it("never wins a selection against a source that can price", () => {
    expect(firstPricedSource(noPriceSource, source(priced)).rates).toBe(priced)
  })
})
