import { type FiatRate } from "@app/self-custodial/price/rate-mapping"
import {
  getSelfCustodialFiatRates,
  withSelfCustodialFiatRates,
} from "@app/store/persistent-state/self-custodial-fiat-rates"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"

const rates: FiatRate[] = [
  { coin: "USD", value: 100_000 },
  { coin: "NGN", value: 150_000_000 },
]

describe("getSelfCustodialFiatRates", () => {
  it("returns undefined before any feed has been stored", () => {
    expect(getSelfCustodialFiatRates(defaultPersistentState)).toBeUndefined()
  })

  it("returns the stored feed with the timestamp it was read at", () => {
    const state = withSelfCustodialFiatRates(defaultPersistentState, {
      rates,
      fetchedAt: 1_700_000_000_000,
    })

    expect(getSelfCustodialFiatRates(state)).toEqual({
      rates,
      fetchedAt: 1_700_000_000_000,
    })
  })
})

describe("withSelfCustodialFiatRates", () => {
  it("replaces the feed rather than merging it, so a dropped currency disappears", () => {
    const first = withSelfCustodialFiatRates(defaultPersistentState, {
      rates,
      fetchedAt: 1,
    })
    const second = withSelfCustodialFiatRates(first, {
      rates: [{ coin: "USD", value: 110_000 }],
      fetchedAt: 2,
    })

    expect(getSelfCustodialFiatRates(second)).toEqual({
      rates: [{ coin: "USD", value: 110_000 }],
      fetchedAt: 2,
    })
  })

  it("ignores an empty feed so a bad read cannot erase a good one", () => {
    const stored = withSelfCustodialFiatRates(defaultPersistentState, {
      rates,
      fetchedAt: 1,
    })

    expect(withSelfCustodialFiatRates(stored, { rates: [], fetchedAt: 2 })).toBe(stored)
  })

  it("caps an implausibly large feed", () => {
    const huge = Array.from({ length: 900 }, (_, index) => ({
      coin: `C${index}`,
      value: index + 1,
    }))

    const state = withSelfCustodialFiatRates(defaultPersistentState, {
      rates: huge,
      fetchedAt: 1,
    })

    // The whole persistent-state blob is rewritten on every change, so an unbounded
    // feed would be paid for on every unrelated setting the user touches.
    expect(getSelfCustodialFiatRates(state)?.rates).toHaveLength(500)
  })

  it("does not mutate the state it was given", () => {
    const before = { ...defaultPersistentState }

    withSelfCustodialFiatRates(defaultPersistentState, { rates, fetchedAt: 1 })

    expect(defaultPersistentState).toEqual(before)
  })
})
