import { describe, expect, it } from "@jest/globals"

import {
  rateFreshness,
  RateFreshness,
  RATES_FRESH_MS,
  RATES_USABLE_MS,
} from "@app/types/price"

describe("rateFreshness", () => {
  const now = 1_700_000_000_000

  it("reads a just-fetched feed as fresh", () => {
    expect(rateFreshness(now, now)).toBe(RateFreshness.Fresh)
  })

  it("reads a feed one tick inside the fresh window as fresh", () => {
    expect(rateFreshness(now - (RATES_FRESH_MS - 1), now)).toBe(RateFreshness.Fresh)
  })

  it("reads a feed at the fresh boundary as stale", () => {
    expect(rateFreshness(now - RATES_FRESH_MS, now)).toBe(RateFreshness.Stale)
  })

  it("reads a feed one tick inside the usable window as stale", () => {
    expect(rateFreshness(now - (RATES_USABLE_MS - 1), now)).toBe(RateFreshness.Stale)
  })

  it("reads a feed at the usable boundary as expired", () => {
    expect(rateFreshness(now - RATES_USABLE_MS, now)).toBe(RateFreshness.Expired)
  })

  it("treats a feed read 'in the future' as fresh", () => {
    // A clock correction or a user setting the date backwards puts the read ahead of
    // now. Expiring a feed the app fetched this session would blank a figure it just
    // got, which is worse than trusting it.
    expect(rateFreshness(now + 60_000, now)).toBe(RateFreshness.Fresh)
  })
})
