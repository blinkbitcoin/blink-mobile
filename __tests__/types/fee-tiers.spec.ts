import { buildZeroTiers, FeeTierOption, FeeUnit } from "@app/types/fee-tiers"

describe("buildZeroTiers", () => {
  const etaMinutes = {
    [FeeTierOption.Fast]: 10,
    [FeeTierOption.Medium]: 30,
    [FeeTierOption.Slow]: 60,
  }

  it("quotes a zero fee on every tier with that tier's eta", () => {
    expect(buildZeroTiers(etaMinutes, FeeUnit.Sats)).toEqual({
      fast: { feeAmount: 0, feeUnit: FeeUnit.Sats, etaMinutes: 10 },
      medium: { feeAmount: 0, feeUnit: FeeUnit.Sats, etaMinutes: 30 },
      slow: { feeAmount: 0, feeUnit: FeeUnit.Sats, etaMinutes: 60 },
    })
  })

  it("carries the unit it is given on every tier", () => {
    const tiers = buildZeroTiers(etaMinutes, FeeUnit.SatPerVbyte)

    expect(Object.values(tiers).map((tier) => tier.feeUnit)).toEqual([
      FeeUnit.SatPerVbyte,
      FeeUnit.SatPerVbyte,
      FeeUnit.SatPerVbyte,
    ])
  })

  it("covers exactly the three tiers", () => {
    expect(Object.keys(buildZeroTiers(etaMinutes, FeeUnit.Cents))).toEqual([
      FeeTierOption.Fast,
      FeeTierOption.Medium,
      FeeTierOption.Slow,
    ])
  })
})
