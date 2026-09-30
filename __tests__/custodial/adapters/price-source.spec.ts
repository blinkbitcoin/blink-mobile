import { describe, expect, it } from "@jest/globals"

import { createCustodialPriceSource } from "@app/custodial/adapters/price"
import { RateFreshness } from "@app/types/price"

const ngnPrice = {
  denominatorCurrency: "NGN",
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

  it("never reads stale, having no persisted copy to inherit", () => {
    expect(createCustodialPriceSource(ngnPrice, "NGN", true).freshness).toBe(
      RateFreshness.Fresh,
    )
  })
})
