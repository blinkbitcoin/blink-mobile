import { buildFeeTierOptions } from "@app/screens/send-bitcoin-screen/fee-tier-options"
import { FeeUnit } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test",
}))

jest.mock("@app/utils/date", () => ({
  formatDuration: (value: number, opts: { unit: string }) =>
    `${value}${opts.unit === "minute" ? "m" : "h"}`,
}))

describe("buildFeeTierOptions", () => {
  const tiers = {
    fast: { feeAmount: 500, feeUnit: FeeUnit.Sats, etaMinutes: 10 },
    medium: { feeAmount: 300, feeUnit: FeeUnit.Sats, etaMinutes: 30 },
    slow: { feeAmount: 100, feeUnit: FeeUnit.Sats, etaMinutes: 60 },
  }

  const labels = {
    fast: "Fast",
    medium: "Medium",
    slow: "Slow",
  }

  it("formats options with label, detail, and id", () => {
    const result = buildFeeTierOptions({
      tiers,
      labels,
      formatFee: ({ feeAmount }) => `${feeAmount} sats`,
      locale: "en",
    })

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      id: "fast",
      label: "Fast (500 sats)",
      detail: "~ 10m",
    })
    expect(result[1]).toEqual({
      id: "medium",
      label: "Medium (300 sats)",
      detail: "~ 30m",
    })
    expect(result[2]).toEqual({
      id: "slow",
      label: "Slow (100 sats)",
      detail: "~ 60m",
    })
  })

  it("uses custom formatFee function", () => {
    const result = buildFeeTierOptions({
      tiers,
      labels,
      formatFee: ({ feeAmount }) => `${feeAmount} sat/vB`,
      locale: "en",
    })

    expect(result[0].label).toBe("Fast (500 sat/vB)")
  })

  it("renders the 24-hour payout queue in hours rather than minutes", () => {
    const result = buildFeeTierOptions({
      tiers: {
        ...tiers,
        slow: { feeAmount: 100, feeUnit: FeeUnit.Sats, etaMinutes: 1440 },
      },
      labels,
      formatFee: ({ feeAmount }) => `${feeAmount} sats`,
      locale: "en",
    })

    expect(result[2].detail).toBe("~ 24h")
  })

  it("keeps the existing 60-minute tier in minutes", () => {
    const result = buildFeeTierOptions({
      tiers,
      labels,
      formatFee: ({ feeAmount }) => `${feeAmount} sats`,
      locale: "en",
    })

    expect(result[2].detail).toBe("~ 60m")
  })

  it("keeps minutes when the eta is not a whole number of hours", () => {
    const result = buildFeeTierOptions({
      tiers: {
        ...tiers,
        medium: { feeAmount: 300, feeUnit: FeeUnit.Sats, etaMinutes: 90 },
      },
      labels,
      formatFee: ({ feeAmount }) => `${feeAmount} sats`,
      locale: "en",
    })

    expect(result[1].detail).toBe("~ 90m")
  })

  it("omits the fee from the label until a fee is known", () => {
    const result = buildFeeTierOptions({
      tiers: {
        fast: { feeAmount: 0, feeUnit: FeeUnit.Sats, etaMinutes: 10 },
        medium: { feeAmount: 0, feeUnit: FeeUnit.Sats, etaMinutes: 60 },
        slow: { feeAmount: 0, feeUnit: FeeUnit.Sats, etaMinutes: 1440 },
      },
      labels,
      formatFee: ({ feeAmount }) => `${feeAmount} sats`,
      locale: "en",
    })

    expect(result.map((option) => option.label)).toEqual(["Fast", "Medium", "Slow"])
    expect(result.map((option) => option.detail)).toEqual(["~ 10m", "~ 60m", "~ 24h"])
  })
})
