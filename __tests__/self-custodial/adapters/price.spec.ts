import { describe, expect, it } from "@jest/globals"

import { createSelfCustodialPriceSource } from "@app/self-custodial/adapters/price"
import { RateFreshness, type FiatRate } from "@app/types/price"

const feed: FiatRate[] = [
  { coin: "USD", value: 100_000 },
  { coin: "NGN", value: 150_000_000 },
]

const source = (freshness: RateFreshness, hasSettled = true, rates = feed) =>
  createSelfCustodialPriceSource({ rates, freshness, hasSettled }, "NGN")

describe("createSelfCustodialPriceSource", () => {
  it("prices the display currency off the feed", () => {
    expect(source(RateFreshness.Fresh).rates?.displayCurrencyPerSat).toBeCloseTo(1.5, 12)
  })

  it("still prices off a stale feed, and says it is stale", () => {
    // An old rate is a caveat on a number, not a reason to withhold it.
    const stale = source(RateFreshness.Stale)

    expect(stale.rates).toBeDefined()
    expect(stale.freshness).toBe(RateFreshness.Stale)
  })

  it("prices nothing off an expired feed", () => {
    // A day-old rate presented as today's is worse than no figure at all; the caller
    // falls back to sats.
    expect(source(RateFreshness.Expired).rates).toBeUndefined()
  })

  it("keeps reporting that it has settled even when too old to use", () => {
    // "Too old" must stay distinguishable from "still loading", or the balance spins.
    expect(source(RateFreshness.Expired).hasSettled).toBe(true)
  })

  it("carries the feed's pending state through", () => {
    expect(source(RateFreshness.Expired, false).hasSettled).toBe(false)
  })

  it("prices nothing when the feed does not carry the display currency", () => {
    expect(
      source(RateFreshness.Fresh, true, [{ coin: "USD", value: 100_000 }]).rates,
    ).toBeUndefined()
  })

  it("prices nothing from an empty feed", () => {
    expect(source(RateFreshness.Fresh, true, []).rates).toBeUndefined()
  })
})
