import { describe, expect, it } from "@jest/globals"

import { createSelfCustodialPriceSource } from "@app/self-custodial/adapters/price"
import { RateFreshness, type FiatRate } from "@app/types/price"

const feed: FiatRate[] = [
  { coin: "USD", value: 100_000 },
  { coin: "NGN", value: 150_000_000 },
]

/** Breez quotes whole units; the fraction size is what turns them into the minor ones
 *  the app works in, so the adapter cannot price without it. */
const source = ({
  freshness,
  hasSettled = true,
  rates = feed,
  fractionDigits = 2,
}: {
  freshness: RateFreshness
  hasSettled?: boolean
  rates?: FiatRate[]
  fractionDigits?: number
}) =>
  createSelfCustodialPriceSource({ rates, freshness, hasSettled }, "NGN", fractionDigits)

describe("createSelfCustodialPriceSource", () => {
  it("prices the display currency off the feed, in its minor unit", () => {
    // 150,000,000 naira per BTC is 1.5 naira — 150 kobo — per sat.
    expect(
      source({ freshness: RateFreshness.Fresh }).rates?.displayCurrencyPerSat,
    ).toBeCloseTo(150, 12)
  })

  it("prices nothing when no list could supply the fraction size", () => {
    // Called directly: passing `undefined` to the helper's defaulted parameter would
    // quietly restore the default and test nothing.
    const withoutFractionDigits = createSelfCustodialPriceSource(
      { rates: feed, freshness: RateFreshness.Fresh, hasSettled: true },
      "NGN",
      undefined,
    )

    // Guessing two decimals here would be wrong for yen and wrong by a hundredfold.
    expect(withoutFractionDigits.rates).toBeUndefined()
    // Still settled: "cannot price" is not "still loading".
    expect(withoutFractionDigits.hasSettled).toBe(true)
  })

  it("still prices off a stale feed, and says it is stale", () => {
    // An old rate is a caveat on a number, not a reason to withhold it.
    const stale = source({ freshness: RateFreshness.Stale })

    expect(stale.rates).toBeDefined()
    expect(stale.freshness).toBe(RateFreshness.Stale)
  })

  it("prices nothing off an expired feed", () => {
    // A day-old rate presented as today's is worse than no figure at all; the caller
    // falls back to sats.
    expect(source({ freshness: RateFreshness.Expired }).rates).toBeUndefined()
  })

  it("keeps reporting that it has settled even when too old to use", () => {
    // "Too old" must stay distinguishable from "still loading", or the balance spins.
    expect(source({ freshness: RateFreshness.Expired }).hasSettled).toBe(true)
  })

  it("carries the feed's pending state through", () => {
    expect(
      source({ freshness: RateFreshness.Expired, hasSettled: false }).hasSettled,
    ).toBe(false)
  })

  it("prices nothing when the feed does not carry the display currency", () => {
    expect(
      source({ freshness: RateFreshness.Fresh, rates: [{ coin: "USD", value: 100_000 }] })
        .rates,
    ).toBeUndefined()
  })

  it("prices nothing from an empty feed", () => {
    expect(source({ freshness: RateFreshness.Fresh, rates: [] }).rates).toBeUndefined()
  })
})
