import { describe, expect, it } from "@jest/globals"

import { toPriceRatesFromRealtimePrice } from "@app/custodial/adapters/price"

describe("toPriceRatesFromRealtimePrice", () => {
  it("applies the offset to both legs", () => {
    const rates = toPriceRatesFromRealtimePrice({
      btcSatPrice: { base: 1_500_000_000, offset: 12 },
      usdCentPrice: { base: 1_500_000_000, offset: 8 },
    })

    expect(rates?.displayCurrencyPerSat).toBeCloseTo(0.0015, 12)
    expect(rates?.displayCurrencyPerCent).toBeCloseTo(15, 12)
  })

  it("returns undefined when a leg is zero, which is what an empty cache reads as", () => {
    expect(
      toPriceRatesFromRealtimePrice({
        btcSatPrice: { base: 0, offset: 12 },
        usdCentPrice: { base: 1_500_000_000, offset: 8 },
      }),
    ).toBeUndefined()
    expect(
      toPriceRatesFromRealtimePrice({
        btcSatPrice: { base: 1_500_000_000, offset: 12 },
        usdCentPrice: { base: 0, offset: 8 },
      }),
    ).toBeUndefined()
  })
})
